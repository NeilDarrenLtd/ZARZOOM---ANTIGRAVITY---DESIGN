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

    // 2. Validate request body
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
    console.log(`[v0] Analyzing website: ${url}`);

    // 3. Fetch website content
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

    // 4. Load admin-configured prompts
    const prompts = await getPromptSettings(supabase);

    // 5. Analyze with OpenRouter
    const analysis = await analyzeContentWithOpenRouter(
      prompts.website_prompt_text,
      siteResult.combinedText,
      "website"
    );

    // 6. Handle analysis failure
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

    // 7. Persist results to database
    await persistAutofillResults(
      supabase,
      userId,
      analysis.data,
      "website",
      url
    );

    // 8. Log audit
    await logAutofillAudit(
      supabase,
      userId,
      "website",
      url,
      analysis.status,
      undefined,
      Object.keys(analysis.data).length,
      analysis.confidence
    );

    const duration = Date.now() - startTime;
    console.log(`[v0] Website autofill completed in ${duration}ms`);

    // 9. Return success response
    return NextResponse.json({
      status: analysis.status,
      message: analysis.message,
      missingFields: analysis.missingFields || [],
      fieldsPopulated: Object.keys(analysis.data).length,
      confidence: analysis.confidence,
      processingTime: duration,
    });
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
