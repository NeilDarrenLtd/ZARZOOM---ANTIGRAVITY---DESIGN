// Dynamic import of unpdf to avoid bundling issues in dev server
let _unpdf: typeof import("unpdf") | null = null;
async function getUnpdf() {
  if (!_unpdf) {
    _unpdf = await import("unpdf");
  }
  return _unpdf;
}

// File validation constants
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_MIME_TYPES = ["application/pdf", "text/plain"];

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
 * Extract text from a PDF buffer using unpdf (built on pdf.js, works in serverless)
 */
async function extractFromPdf(
  buffer: Buffer
): Promise<ExtractedContent | ExtractionError> {
  try {
    const unpdf = await getUnpdf();
    const pdf = await unpdf.getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text } = await unpdf.extractText(pdf, { mergePages: true });

    if (!text || text.trim().length === 0) {
      return {
        error:
          "Could not extract text from PDF. The file may be image-based or empty.",
        code: "NO_TEXT_EXTRACTED",
      };
    }

    return {
      text: text.trim(),
      metadata: {
        fileType: "application/pdf",
        originalLength: text.length,
        truncated: false,
        pageCount: totalPages,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[fileExtractor] PDF parse error:", message);
    return {
      error: `Failed to parse PDF: ${message}`,
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
  const isPdf =
    mimeType === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf");
  const isTxt =
    mimeType === "text/plain" || fileName.toLowerCase().endsWith(".txt");

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
