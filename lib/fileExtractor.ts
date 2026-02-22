import pdf from "pdf-parse";

// File validation constants
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

export interface ExtractedContent {
  text: string;
  metadata: {
    fileType: string;
    originalLength: number;
    truncated: boolean;
    pageCount?: number;
    author?: string;
    title?: string;
  };
}

export interface ExtractionError {
  error: string;
  code: string;
}

export interface FileValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate file size and type
 */
export function validateFile(file: File): FileValidation {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    };
  }

  // Check file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed types: PDF, TXT, DOCX.`,
    };
  }

  return { valid: true };
}

/**
 * Extract text from file buffer
 */
export async function extractTextFromFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ExtractedContent | ExtractionError> {
  try {
    let text = "";
    let metadata: ExtractedContent["metadata"] = {
      fileType: mimeType,
      originalLength: 0,
      truncated: false,
    };

    // Extract based on file type
    if (mimeType === "application/pdf") {
      try {
        const data = await pdf(buffer);
        text = data.text;
        metadata.pageCount = data.numpages;
        metadata.author = data.info?.Author;
        metadata.title = data.info?.Title;
      } catch (pdfError: any) {
        console.error("[fileExtractor] PDF parse error:", pdfError);
        return {
          error: `Failed to parse PDF: ${pdfError.message}`,
          code: "PDF_PARSE_ERROR",
        };
      }
    } else if (mimeType === "text/plain") {
      text = buffer.toString("utf-8");
    } else if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      // DOCX not yet supported
      return {
        error: "DOCX files are not yet supported. Please use PDF or TXT.",
        code: "UNSUPPORTED_FORMAT",
      };
    } else {
      return {
        error: "Unsupported file type",
        code: "UNSUPPORTED_FORMAT",
      };
    }

    // Validate extracted text
    if (!text || text.trim().length === 0) {
      return {
        error: "Could not extract text from file. The file may be empty or corrupted.",
        code: "NO_TEXT_EXTRACTED",
      };
    }

    metadata.originalLength = text.length;

    // Truncate if too long (to avoid token limits)
    const MAX_CHARS = 50000; // ~12k tokens
    if (text.length > MAX_CHARS) {
      text = text.substring(0, MAX_CHARS);
      metadata.truncated = true;
    }

    return {
      text: text.trim(),
      metadata,
    };
  } catch (error: any) {
    console.error("[fileExtractor] Extraction error:", error);
    return {
      error: error.message || "Failed to extract text from file",
      code: "EXTRACTION_ERROR",
    };
  }
}
