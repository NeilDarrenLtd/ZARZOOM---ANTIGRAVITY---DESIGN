import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAuthenticatedUser,
  getPromptSettings,
  analyzeContentWithOpenRouter,
  persistAutofillResults,
  logAutofillAudit,
} from "@/lib/wizard/autofillServer";
import { fetchSiteContent } from "@/lib/siteFetcher";
import { validateURL } from "@/lib/siteFetcher/urlValidator";
import {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
} from "@/lib/security/rateLimiter";
import {
  getCachedWebsiteAnalysis,
  cacheWebsiteAnalysis,
} from "@/lib/security/analysisCache";
import {
  checkAutofillUsage,
  incrementAutofillUsage,
  freeBasicAnalysis,
} from "@/lib/wizard/usageGuard";
import { createAdminClient } from "@/lib/supabase/server";

// ──────────────────────────────────────────────
// POST /api/v1/onboarding/autofill/website
// Fetches website content, analyzes with OpenRouter,
// and populates wizard fields
// ──────────────────────────────────────────────

const requestSchema = z.object({
  url: z.string().url("Must provide a valid URL"),
});

export async function POST(request: Request) {
  const startTime = Date.now();
  let userId: string | undefined;
  let url: string | undefined;

  try {
    console.log("[v0] Starting website autofill...");

    // 1. Authenticate user
    const { supabase, user } = await requireAuthenticatedUser();
    userId = user.id;

    // 2. Check autofill usage (2/day combined, degrade after 10 lifetime)
    const usage = await checkAutofillUsage(supabase, userId);

    if (!usage.allowed) {
      const messages: Record<string, string> = {
        daily_limit:
          "You have reached your daily limit of 2 auto-fill analyses. Please try again tomorrow.",
        blocked:
          "Auto-fill has been disabled for your account. Please contact support for assistance.",
        suspended:
          "Your account has been suspended. Please contact support for assistance.",
        profile_not_found: "User profile not found.",
      };

      return NextResponse.json(
        {
          status: "fail",
          message: messages[usage.reason || "daily_limit"] || "Auto-fill unavailable",
          error: usage.reason || "daily_limit",
          dailyRemaining: usage.dailyRemaining,
          lifetimeTotal: usage.lifetimeTotal,
        },
        { status: 429 }
      );
    }

    // 3. Check rate limit
    const rateLimit = checkRateLimit(
      userId,
      "website-autofill",
      RATE_LIMIT_CONFIGS.WEBSITE_AUTOFILL
    );

    if (!rateLimit.allowed) {
      const resetDate = new Date(rateLimit.resetAt);
      const minutesRemaining = Math.ceil(
        (rateLimit.resetAt - Date.now()) / 60000
      );

      console.log(`[v0] Rate limit exceeded for user ${userId}`);

      return NextResponse.json(
        {
          status: "fail",
          message: "Too many requests",
          error: `You've reached the limit of ${RATE_LIMIT_CONFIGS.WEBSITE_AUTOFILL.maxRequests} website analyses per ${RATE_LIMIT_CONFIGS.WEBSITE_AUTOFILL.windowMs / 60000} minutes. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}.`,
          resetAt: resetDate.toISOString(),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(RATE_LIMIT_CONFIGS.WEBSITE_AUTOFILL.maxRequests),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(rateLimit.resetAt),
          },
        }
      );
    }

    console.log(`[v0] Rate limit check passed. Remaining: ${rateLimit.remaining}`);

    // 3. Validate request body
    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          status: "fail",
          message: "Invalid request",
          error: validation.error.issues[0].message,
        },
        { status: 422 }
      );
    }

    url = validation.data.url;

    // 4. Enforce SSRF protection server-side
    try {
      validateURL(url);
      console.log(`[v0] URL passed SSRF validation: ${url}`);
    } catch (ssrfError: any) {
      console.error(`[v0] SSRF validation failed for ${url}:`, ssrfError.message);

      await logAutofillAudit(
        supabase,
        userId,
        "website",
        url,
        "fail",
        `SSRF blocked: ${ssrfError.message}`
      );

      return NextResponse.json(
        {
          status: "fail",
          message: "Invalid or blocked URL",
          error: "This URL cannot be accessed for security reasons. Private IPs, localhost, and internal networks are not allowed.",
        },
        { status: 422 }
      );
    }

    // 5. Check cache for recent analysis
    const cachedResult = getCachedWebsiteAnalysis(userId, url);
    if (cachedResult) {
      console.log(`[v0] Returning cached result for ${url}`);
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    console.log(`[v0] Analyzing website: ${url}`);

    // 6. Fetch website content
    const siteResult = await fetchSiteContent(url, {
      maxPages: 5,
      timeout: 10000,
      maxTotalBytes: 2 * 1024 * 1024, // 2MB
    });

    if (!siteResult.combinedText || siteResult.combinedText.length < 100) {
      await logAutofillAudit(
        supabase,
        userId,
        "website",
        url,
        "fail",
        "Insufficient content extracted from website"
      );

      return NextResponse.json(
        {
          status: "fail",
          message: "Could not extract enough content from the website",
          error: "The website did not have enough readable text to analyze",
        },
        { status: 422 }
      );
    }

    console.log(
      `[v0] Extracted ${siteResult.combinedText.length} characters from ${siteResult.pages.length} pages`
    );

    // 7. Branch: degraded (free) vs premium (OpenRouter)
    let analysisStatus: "success" | "partial" | "fail";
    let analysisData: Record<string, unknown> | undefined;
    let analysisMissing: string[] = [];
    let analysisConfidence: Record<string, number> | undefined;
    let analysisMessage: string;
    let isDegraded = usage.degraded;

    if (isDegraded) {
      // ── DEGRADED: free basic analysis (no OpenRouter cost) ──
      console.log("[v0] User is degraded, using free basic analysis");
      const basic = freeBasicAnalysis(siteResult.combinedText, "website");
      analysisStatus = basic.fieldsPopulated > 0 ? "partial" : "fail";
      analysisData = basic.data as Record<string, unknown>;
      analysisMissing = basic.missingFields;
      analysisMessage =
        basic.fieldsPopulated > 0
          ? `Basic analysis extracted ${basic.fieldsPopulated} fields. Upgrade or contact support for full AI-powered analysis.`
          : "Basic analysis could not extract fields from this website.";
    } else {
      // ── PREMIUM: full OpenRouter analysis ──
      // Use admin client to read settings (RLS only allows admin reads)
      const adminSupabase = await createAdminClient();
      const prompts = await getPromptSettings(adminSupabase);
      const analysis = await analyzeContentWithOpenRouter(
        prompts.website_prompt_text,
        siteResult.combinedText,
        "website",
        url // pass URL for [WEBSITE-URL] placeholder substitution
      );

      if (analysis.status === "fail" || !analysis.data) {
        await logAutofillAudit(
          supabase,
          userId,
          "website",
          url,
          "fail",
          analysis.error || analysis.message
        );

        return NextResponse.json(
          {
            status: "fail",
            message: analysis.message,
            error: analysis.error,
          },
          { status: 500 }
        );
      }

      analysisStatus = analysis.status;
      analysisData = analysis.data as Record<string, unknown>;
      analysisMissing = analysis.missingFields || [];
      analysisConfidence = analysis.confidence;
      analysisMessage = analysis.message;
    }

    // 8. Persist results to database
    if (analysisData && Object.keys(analysisData).length > 0) {
      await persistAutofillResults(
        supabase,
        userId,
        analysisData as any,
        "website",
        url
      );
    }

    // 9. Increment usage counter (counts regardless of degraded/premium)
    await incrementAutofillUsage(supabase, userId);

    // 10. Log audit
    await logAutofillAudit(
      supabase,
      userId,
      "website",
      url,
      analysisStatus,
      undefined,
      analysisData ? Object.keys(analysisData).length : 0,
      analysisConfidence
    );

    const duration = Date.now() - startTime;

    // 11. Build and cache response
    const responseData = {
      status: analysisStatus,
      message: analysisMessage,
      missingFields: analysisMissing,
      fieldsPopulated: analysisData ? Object.keys(analysisData).length : 0,
      confidence: analysisConfidence,
      processingTime: duration,
      degraded: isDegraded,
      dailyRemaining: usage.dailyRemaining - 1,
      lifetimeTotal: usage.lifetimeTotal + 1,
    };

    cacheWebsiteAnalysis(userId, url, responseData);

    return NextResponse.json(responseData);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[v0] Website autofill error:", error);

    // Log failure if we have user context
    if (userId && url) {
      try {
        const { supabase } = await requireAuthenticatedUser();
        await logAutofillAudit(
          supabase,
          userId,
          "website",
          url,
          "fail",
          error instanceof Error ? error.message : "Unknown error"
        );
      } catch (auditError) {
        console.error("[v0] Failed to log audit:", auditError);
      }
    }

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json(
          { status: "fail", message: "Unauthorized", error: "Please sign in" },
          { status: 401 }
        );
      }

      if (error.message.includes("SSRF") || error.message.includes("blocked")) {
        return NextResponse.json(
          {
            status: "fail",
            message: "Invalid URL",
            error: "This URL cannot be accessed for security reasons",
          },
          { status: 422 }
        );
      }

      if (error.message.includes("timeout")) {
        return NextResponse.json(
          {
            status: "fail",
            message: "Website took too long to respond",
            error: "The website request timed out. Please try again.",
          },
          { status: 504 }
        );
      }
    }

    return NextResponse.json(
      {
        status: "fail",
        message: "Failed to analyze website",
        error: error instanceof Error ? error.message : "Unknown error",
        processingTime: duration,
      },
      { status: 500 }
    );
  }
}
