/**
 * File text extraction utility.
 * Extracts readable text from PDF and TXT files in memory.
 * No external PDF libraries — uses a built-in binary text extractor.
 * No files are stored; everything is processed in memory.
 */

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
 * Extract text from a PDF buffer without external libraries.
 *
 * This parses the raw PDF binary to find text streams, decompresses them
 * if needed (FlateDecode), and extracts text operators (Tj, TJ, ').
 * It handles the vast majority of text-based PDFs. Image-only PDFs
 * will return an empty-text error prompting users to use a text file.
 */
function extractFromPdf(buffer: Buffer): ExtractedContent | ExtractionError {
  try {
    const raw = buffer.toString("binary");
    const textChunks: string[] = [];

    // Count pages via /Type /Page (not /Pages)
    const pageMatches = raw.match(/\/Type\s*\/Page(?!s)/g);
    const pageCount = pageMatches ? pageMatches.length : undefined;

    // Strategy 1: Extract from stream objects (handles both compressed and uncompressed)
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;
    while ((match = streamRegex.exec(raw)) !== null) {
      let content = match[1];

      // Try to inflate if compressed (FlateDecode)
      try {
        const zlib = require("zlib");
        const buf = Buffer.from(content, "binary");
        const inflated = zlib.inflateSync(buf);
        content = inflated.toString("binary");
      } catch {
        // Not compressed or decompression failed — use as-is
      }

      // Extract text from PDF text operators
      // Tj operator: (text) Tj
      const tjMatches = content.match(/\(([^)]*)\)\s*Tj/g);
      if (tjMatches) {
        for (const tj of tjMatches) {
          const inner = tj.match(/\(([^)]*)\)/);
          if (inner) textChunks.push(decodePdfString(inner[1]));
        }
      }

      // TJ operator: [(text) num (text)] TJ
      const tjArrayMatches = content.match(/\[([^\]]*)\]\s*TJ/gi);
      if (tjArrayMatches) {
        for (const arr of tjArrayMatches) {
          const parts = arr.match(/\(([^)]*)\)/g);
          if (parts) {
            const line = parts
              .map((p) => decodePdfString(p.slice(1, -1)))
              .join("");
            textChunks.push(line);
          }
        }
      }

      // ' operator (move to next line and show text)
      const quoteMatches = content.match(/\(([^)]*)\)\s*'/g);
      if (quoteMatches) {
        for (const q of quoteMatches) {
          const inner = q.match(/\(([^)]*)\)/);
          if (inner) textChunks.push(decodePdfString(inner[1]));
        }
      }
    }

    // Strategy 2: Fallback — extract any printable text sequences from the raw PDF
    if (textChunks.length === 0) {
      const fallbackRegex = /\(([^()]{4,})\)/g;
      let fb;
      while ((fb = fallbackRegex.exec(raw)) !== null) {
        const decoded = decodePdfString(fb[1]);
        // Only keep strings with actual word characters
        if (/[a-zA-Z]{2,}/.test(decoded)) {
          textChunks.push(decoded);
        }
      }
    }

    // Clean up the text
    const text = textChunks
      .join("\n")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\t/g, " ")
      .replace(/\\\\/g, "\\")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text || text.length < 20) {
      return {
        error:
          "Could not extract sufficient text from PDF. The file may be image-based, scanned, or empty. Please try uploading a text-based PDF or a .txt file instead.",
        code: "NO_TEXT_EXTRACTED",
      };
    }

    return {
      text,
      metadata: {
        fileType: "application/pdf",
        originalLength: text.length,
        truncated: false,
        pageCount,
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
 * Decode common PDF string escape sequences
 */
function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
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
    result = extractFromPdf(buffer);
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
