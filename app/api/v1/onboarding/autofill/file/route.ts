import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAuthenticatedUser,
  getPromptSettings,
  analyzeContentWithOpenRouter,
  persistAutofillResults,
  logAutofillAudit,
} from "@/lib/wizard/autofillServer";

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

    const { storageFilePath, extractedText, fileName: originalFileName } = validation.data;
    fileName = originalFileName;

    console.log(
      `[v0] Analyzing file: ${fileName} (${extractedText.length} characters)`
    );

    // 3. Verify file access (ensure user owns this file via RLS)
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

    // 4. Validate extracted text length
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

    // 5. Load admin-configured prompts
    const prompts = await getPromptSettings(supabase);

    // 6. Analyze with OpenRouter
    const analysis = await analyzeContentWithOpenRouter(
      prompts.file_prompt_text,
      extractedText,
      "file"
    );

    // 7. Handle analysis failure
    if (analysis.status === "fail" || !analysis.data) {
      await logAutofillAudit(
        supabase,
        userId,
        "file",
        fileName,
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

    // 8. Persist results to database
    await persistAutofillResults(
      supabase,
      userId,
      analysis.data,
      "file",
      fileName
    );

    // 9. Log audit
    await logAutofillAudit(
      supabase,
      userId,
      "file",
      fileName,
      analysis.status,
      undefined,
      Object.keys(analysis.data).length,
      analysis.confidence
    );

    const duration = Date.now() - startTime;
    console.log(`[v0] File autofill completed in ${duration}ms`);

    // 10. Return success response
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
