import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAuthenticatedUser,
  getPromptSettings,
  analyzeContentWithOpenRouter,
  persistAutofillResults,
  logAutofillAudit,
} from "@/lib/wizard/autofillServer";
import {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
} from "@/lib/security/rateLimiter";
import {
  checkAutofillUsage,
  incrementAutofillUsage,
  freeBasicAnalysis,
} from "@/lib/wizard/usageGuard";
import { createAdminClient } from "@/lib/supabase/server";

// ──────────────────────────────────────────────
// POST /api/v1/onboarding/autofill/file
// Analyzes uploaded file content with OpenRouter
// and populates wizard fields
// ──────────────────────────────────────────────

const requestSchema = z.object({
  storageFilePath: z.string().min(1, "Storage file path is required"),
  extractedText: z.string().min(100, "Insufficient text content in file"),
  fileName: z.string().min(1, "File name is required"),
});

export async function POST(request: Request) {
  const startTime = Date.now();
  let userId: string | undefined;
  let fileName: string | undefined;

  try {
    console.log("[v0] Starting file autofill...");

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
      "file-autofill",
      RATE_LIMIT_CONFIGS.FILE_AUTOFILL
    );

    if (!rateLimit.allowed) {
      const minutesRemaining = Math.ceil(
        (rateLimit.resetAt - Date.now()) / 60000
      );

      console.log(`[v0] Rate limit exceeded for user ${userId}`);

      return NextResponse.json(
        {
          status: "fail",
          message: "Too many requests",
          error: `You've reached the limit of ${RATE_LIMIT_CONFIGS.FILE_AUTOFILL.maxRequests} file analyses per ${RATE_LIMIT_CONFIGS.FILE_AUTOFILL.windowMs / 60000} minutes. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}.`,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(RATE_LIMIT_CONFIGS.FILE_AUTOFILL.maxRequests),
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

    const { storageFilePath, extractedText, fileName: originalFileName } = validation.data;
    fileName = originalFileName;

    console.log(
      `[v0] Analyzing file: ${fileName} (${extractedText.length} characters)`
    );

    // 4. Verify file access (ensure user owns this file via RLS)
    const { data: fileMetadata, error: fileError } = await supabase.storage
      .from("wizard-uploads")
      .list(user.id, {
        search: storageFilePath.split("/").pop(),
      });

    if (fileError || !fileMetadata || fileMetadata.length === 0) {
      console.error("[v0] File access denied or not found");
      return NextResponse.json(
        {
          status: "fail",
          message: "File not found or access denied",
          error: "Could not verify file ownership",
        },
        { status: 403 }
      );
    }

    // 5. Validate extracted text length (additional server-side check)
    if (extractedText.length < 100) {
      await logAutofillAudit(
        supabase,
        userId,
        "file",
        fileName,
        "fail",
        "Insufficient text content extracted from file"
      );

      return NextResponse.json(
        {
          status: "fail",
          message: "Could not extract enough content from the file",
          error: "The file did not contain enough readable text to analyze",
        },
        { status: 422 }
      );
    }

    // Enforce max text length for safety
    const MAX_TEXT_LENGTH = 50000;
    const textToAnalyze = extractedText.length > MAX_TEXT_LENGTH 
      ? extractedText.slice(0, MAX_TEXT_LENGTH)
      : extractedText;

    if (extractedText.length > MAX_TEXT_LENGTH) {
      console.log(`[v0] Truncated file text from ${extractedText.length} to ${MAX_TEXT_LENGTH} characters`);
    }

    // 6. Branch: degraded (free) vs premium (OpenRouter)
    let analysisStatus: "success" | "partial" | "fail";
    let analysisData: Record<string, unknown> | undefined;
    let analysisMissing: string[] = [];
    let analysisConfidence: Record<string, number> | undefined;
    let analysisMessage: string;
    let analysisDebug: { promptSent?: string; responseReceived?: string; fieldsExtracted?: Record<string, unknown> } | undefined;
    let isDegraded = usage.degraded;

    if (isDegraded) {
      // ── DEGRADED: free basic analysis ──
      console.log("[v0] User is degraded, using free basic analysis for file");
      const basic = freeBasicAnalysis(textToAnalyze, "file");
      analysisStatus = basic.fieldsPopulated > 0 ? "partial" : "fail";
      analysisData = basic.data as Record<string, unknown>;
      analysisMissing = basic.missingFields;
      analysisMessage =
        basic.fieldsPopulated > 0
          ? `Basic analysis extracted ${basic.fieldsPopulated} fields. Upgrade or contact support for full AI-powered analysis.`
          : "Basic analysis could not extract fields from this file.";
    } else {
      // ── PREMIUM: full OpenRouter analysis ──
      // Use admin client to read settings (RLS only allows admin reads)
      const adminSupabase = await createAdminClient();
      const prompts = await getPromptSettings(adminSupabase);
      const analysis = await analyzeContentWithOpenRouter(
        prompts.file_prompt_text,
        textToAnalyze,
        "file",
        fileName // pass filename for [FILE-NAME] placeholder substitution
      );

      if (analysis.status === "fail" || !analysis.data) {
        await logAutofillAudit(
          supabase,
          userId,
          "file",
          fileName,
          "fail",
          analysis.error || analysis.message,
          0,
          undefined,
          analysis.debug
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
      analysisDebug = analysis.debug;
    }

    // 7. Persist results to database
    let persistError: string | undefined;
    if (analysisData && Object.keys(analysisData).length > 0) {
      try {
        await persistAutofillResults(
          supabase,
          userId,
          analysisData as any,
          "file",
          fileName
        );
      } catch (err) {
        persistError = err instanceof Error ? err.message : "Unknown persist error";
        console.error("[v0] Persist failed but analysis succeeded:", persistError);
      }
    }

    // 8. Increment usage counter
    await incrementAutofillUsage(supabase, userId);

    // 9. Log audit with debug data
    await logAutofillAudit(
      supabase,
      userId,
      "file",
      fileName,
      persistError ? "partial" : analysisStatus,
      persistError,
      analysisData ? Object.keys(analysisData).length : 0,
      analysisConfidence,
      analysisDebug
    );

    const duration = Date.now() - startTime;
    console.log(`[v0] File autofill completed in ${duration}ms`);

    // 10. Return response
    return NextResponse.json({
      status: analysisStatus,
      message: analysisMessage,
      missingFields: analysisMissing,
      fieldsPopulated: analysisData ? Object.keys(analysisData).length : 0,
      confidence: analysisConfidence,
      processingTime: duration,
      degraded: isDegraded,
      dailyRemaining: usage.dailyRemaining - 1,
      lifetimeTotal: usage.lifetimeTotal + 1,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[v0] File autofill error:", error);

    // Log failure if we have user context
    if (userId && fileName) {
      try {
        const { supabase } = await requireAuthenticatedUser();
        await logAutofillAudit(
          supabase,
          userId,
          "file",
          fileName,
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

      if (error.message.includes("OpenRouter")) {
        return NextResponse.json(
          {
            status: "fail",
            message: "AI analysis service unavailable",
            error: "The AI service is temporarily unavailable. Please try again later.",
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        status: "fail",
        message: "Failed to analyze file",
        error: error instanceof Error ? error.message : "Unknown error",
        processingTime: duration,
      },
      { status: 500 }
    );
  }
}
