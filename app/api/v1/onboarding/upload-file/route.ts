import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  validateFile,
  extractTextFromFile,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  type ExtractionError,
  type ExtractedContent,
} from "@/lib/fileExtractor";
import {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
} from "@/lib/security/rateLimiter";
import { randomUUID } from "crypto";

/**
 * POST /api/v1/onboarding/upload-file
 * Upload and parse a file (PDF/DOC/DOCX) for wizard auto-fill
 * 
 * Security:
 * - Requires authentication
 * - Files stored in private "wizard-uploads" bucket
 * - User can only access their own files (RLS enforced)
 * - Validates file type and size
 * - Extracts text for AI analysis (does not call AI yet)
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
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
          error: "Too many requests",
          message: `You've reached the limit of ${RATE_LIMIT_CONFIGS.FILE_UPLOAD.maxRequests} file uploads per ${RATE_LIMIT_CONFIGS.FILE_UPLOAD.windowMs / 60000} minutes. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}.`,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(RATE_LIMIT_CONFIGS.FILE_UPLOAD.maxRequests),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(rateLimit.resetAt),
          },
        }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    console.log("[v0] File upload:", {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      userId: user.id,
    });

    // Upload to Supabase Storage using admin client
    const adminClient = await createAdminClient();
    const fileExt = file.name.split(".").pop() || "pdf";
    const fileName = `${randomUUID()}.${fileExt}`;
    const storagePath = `${user.id}/${fileName}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to storage
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from("wizard-uploads")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
        cacheControl: "3600",
      });

    if (uploadError || !uploadData) {
      console.error("[v0] Upload error:", uploadError);
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError?.message ?? "unknown"}` },
        { status: 500 }
      );
    }

    console.log("[v0] File uploaded successfully:", storagePath);

    // Extract text from file
    const extracted = await extractTextFromFile(buffer, file.name, file.type);

    // Check if extraction failed
    if ("error" in extracted) {
      const error = extracted as ExtractionError;
      console.error("[v0] Extraction error:", error);

      // Clean up uploaded file if extraction fails
      await adminClient.storage
        .from("wizard-uploads")
        .remove([storagePath]);

      return NextResponse.json(
        {
          error: error.error,
          code: error.code,
        },
        { status: 400 }
      );
    }

    const content = extracted as ExtractedContent;

    console.log("[v0] Text extracted:", {
      fileType: content.metadata.fileType,
      textLength: content.text.length,
      truncated: content.metadata.truncated,
    });

    // Return extracted content for AI analysis
    // (AI analysis will be implemented in next step)
    return NextResponse.json({
      success: true,
      data: {
        fileId: uploadData.path,
        fileName: file.name,
        fileType: content.metadata.fileType,
        extractedText: content.text,
        metadata: {
          originalLength: content.metadata.originalLength,
          truncated: content.metadata.truncated,
          pageCount: content.metadata.pageCount,
          author: content.metadata.author,
          title: content.metadata.title,
        },
        // Placeholder for AI analysis results
        // This will be populated when we integrate OpenRouter
        analysisReady: true,
      },
    });
  } catch (error: any) {
    console.error("[v0] File upload error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/onboarding/upload-file
 * Get info about uploaded files for current user
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // List user's uploaded files
    const adminClient = await createAdminClient();
    const { data: files, error: listError } = await adminClient.storage
      .from("wizard-uploads")
      .list(user.id, {
        limit: 10,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (listError) {
      console.error("[v0] List files error:", listError);
      return NextResponse.json(
        { error: "Failed to list files" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        files: files || [],
        count: files?.length || 0,
      },
    });
  } catch (error: any) {
    console.error("[v0] List files error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/onboarding/upload-file
 * Delete uploaded file (cleanup)
 */
export async function DELETE(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json(
        { error: "File path required" },
        { status: 400 }
      );
    }

    // Verify the file belongs to the user
    if (!filePath.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { error: "Unauthorized to delete this file" },
        { status: 403 }
      );
    }

    // Delete from storage
    const adminClient = await createAdminClient();
    const { error: deleteError } = await adminClient.storage
      .from("wizard-uploads")
      .remove([filePath]);

    if (deleteError) {
      console.error("[v0] Delete file error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete file" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error: any) {
    console.error("[v0] Delete file error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
