import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  validateFile,
  extractTextFromFile,
  type ExtractionError,
  type ExtractedContent,
} from "@/lib/fileExtractor";
import {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
} from "@/lib/security/rateLimiter";

/**
 * POST /api/v1/onboarding/upload-file
 * Receive a file (PDF or TXT), extract text in memory, and return it.
 * No file is stored — the text is used for AI analysis only.
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check rate limit
    const rateLimit = checkRateLimit(
      user.id,
      "file-upload",
      RATE_LIMIT_CONFIGS.FILE_UPLOAD
    );

    if (!rateLimit.allowed) {
      const minutesRemaining = Math.ceil(
        (rateLimit.resetAt - Date.now()) / 60000
      );
      return NextResponse.json(
        {
          error: `Too many requests. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}.`,
        },
        { status: 429 }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type and size
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Read file into memory (no storage)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text
    const extracted = await extractTextFromFile(buffer, file.name, file.type);

    // Check if extraction failed
    if ("error" in extracted) {
      const err = extracted as ExtractionError;
      return NextResponse.json({ error: err.error }, { status: 400 });
    }

    const content = extracted as ExtractedContent;

    // Return the extracted text — no file is persisted
    return NextResponse.json({
      success: true,
      data: {
        fileId: `temp-${Date.now()}`,
        fileName: file.name,
        extractedText: content.text,
        metadata: content.metadata,
        analysisReady: true,
      },
    });
  } catch (error: any) {
    console.error("[upload-file] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
