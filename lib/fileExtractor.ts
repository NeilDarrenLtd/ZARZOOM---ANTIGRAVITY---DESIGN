// File validation constants
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
];

export interface ExtractedContent {
  text: string;
  metadata: {
    fileType: string;
    originalLength: number;
    truncated: boolean;
    pageCount?: number;
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
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    };
  }

  // Also accept .txt files that might have generic mime type
  const isTxt = file.name.toLowerCase().endsWith(".txt");
  const isPdf = file.name.toLowerCase().endsWith(".pdf");

  if (!ALLOWED_MIME_TYPES.includes(file.type) && !isTxt && !isPdf) {
    return {
      valid: false,
      error: "Unsupported file type. Please use PDF or TXT files.",
    };
  }

  return { valid: true };
}

/**
 * Extract text from a plain text buffer
 */
function extractFromText(buffer: Buffer): ExtractedContent {
  const text = buffer.toString("utf-8");
  return {
    text: text.trim(),
    metadata: {
      fileType: "text/plain",
      originalLength: text.length,
      truncated: false,
    },
  };
}

/**
 * Extract text from a PDF buffer using pdf-parse
 * Uses the internal module path to avoid the known entry-point bug
 */
async function extractFromPdf(buffer: Buffer): Promise<ExtractedContent | ExtractionError> {
  try {
    // Use the internal module to avoid the "Object.defineProperty" entry-point bug
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js");
    const data = await pdfParse(buffer);

    if (!data.text || data.text.trim().length === 0) {
      return {
        error: "Could not extract text from PDF. The file may be image-based or empty.",
        code: "NO_TEXT_EXTRACTED",
      };
    }

    return {
      text: data.text.trim(),
      metadata: {
        fileType: "application/pdf",
        originalLength: data.text.length,
        truncated: false,
        pageCount: data.numpages,
      },
    };
  } catch (err: any) {
    console.error("[fileExtractor] PDF parse error:", err);
    return {
      error: "Failed to read PDF. Please ensure the file is not corrupted.",
      code: "PDF_PARSE_ERROR",
    };
  }
}

/**
 * Extract text from file buffer based on type.
 * No files are stored — everything is processed in memory.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ExtractedContent | ExtractionError> {
  const isPdf = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  const isTxt = mimeType === "text/plain" || fileName.toLowerCase().endsWith(".txt");

  let result: ExtractedContent | ExtractionError;

  if (isPdf) {
    result = await extractFromPdf(buffer);
  } else if (isTxt) {
    result = extractFromText(buffer);
  } else {
    return {
      error: "Unsupported file type. Please use PDF or TXT files.",
      code: "UNSUPPORTED_FORMAT",
    };
  }

  // If extraction succeeded, truncate if needed
  if ("text" in result) {
    const MAX_CHARS = 50000; // ~12k tokens
    if (result.text.length > MAX_CHARS) {
      result.text = result.text.substring(0, MAX_CHARS);
      result.metadata.truncated = true;
    }
  }

  return result;
}
