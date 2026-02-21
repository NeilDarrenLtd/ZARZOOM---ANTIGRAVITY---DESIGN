/**
 * File Extractor for Wizard Auto-fill
 * 
 * Extracts text content from PDF, DOC, and DOCX files for AI analysis.
 * Uses pdf-parse for PDFs and mammoth for Word documents.
 * 
 * Security features:
 * - File size limits (10MB max)
 * - MIME type validation
 * - Text content caps (50k characters)
 * - Safe error handling
 */

import { z } from "zod";

// ============================================================================
// Constants and Configuration
// ============================================================================

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
] as const;

export const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_TEXT_LENGTH = 50_000; // 50k characters for LLM

// ============================================================================
// Types
// ============================================================================

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: AllowedMimeType;
  extension?: AllowedExtension;
  size?: number;
}

export interface ExtractedContent {
  text: string;
  metadata: {
    fileType: "pdf" | "doc" | "docx";
    originalLength: number;
    truncated: boolean;
    pageCount?: number;
    author?: string;
    title?: string;
    createdAt?: Date;
  };
}

export interface ExtractionError {
  error: string;
  code: "INVALID_FILE" | "PARSE_ERROR" | "SIZE_EXCEEDED" | "UNSUPPORTED_FORMAT";
}

// ============================================================================
// Validation
// ============================================================================

export function validateFile(
  file: File | { name: string; size: number; type: string }
): FileValidationResult {
  // Check size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type}. Allowed types: PDF, DOC, DOCX`,
    };
  }

  // Check extension
  const extension = file.name
    .toLowerCase()
    .substring(file.name.lastIndexOf(".")) as AllowedExtension;

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Unsupported file extension: ${extension}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    };
  }

  // Validate MIME and extension match
  const mimeExtensionMap: Record<AllowedMimeType, AllowedExtension[]> = {
    "application/pdf": [".pdf"],
    "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
      ".docx",
    ],
  };

  const expectedExtensions = mimeExtensionMap[file.type as AllowedMimeType];
  if (!expectedExtensions?.includes(extension)) {
    return {
      valid: false,
      error: `File extension ${extension} does not match MIME type ${file.type}`,
    };
  }

  return {
    valid: true,
    mimeType: file.type as AllowedMimeType,
    extension,
    size: file.size,
  };
}

// ============================================================================
// Text Extraction
// ============================================================================

/**
 * Extract text from PDF using pdf-parse
 */
async function extractFromPDF(buffer: Buffer): Promise<ExtractedContent> {
  try {
    // Dynamic import to keep bundle size down
    const pdfParse = (await import("pdf-parse")).default;
    
    const data = await pdfParse(buffer);

    return {
      text: data.text,
      metadata: {
        fileType: "pdf",
        originalLength: data.text.length,
        truncated: false,
        pageCount: data.numpages,
        author: data.info?.Author,
        title: data.info?.Title,
        createdAt: data.info?.CreationDate
          ? new Date(data.info.CreationDate)
          : undefined,
      },
    };
  } catch (error: any) {
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * Extract text from DOC/DOCX using mammoth
 */
async function extractFromWord(
  buffer: Buffer,
  fileType: "doc" | "docx"
): Promise<ExtractedContent> {
  try {
    // Dynamic import
    const mammoth = (await import("mammoth"));

    const result = await mammoth.extractRawText({ buffer });

    return {
      text: result.value,
      metadata: {
        fileType,
        originalLength: result.value.length,
        truncated: false,
      },
    };
  } catch (error: any) {
    throw new Error(`Failed to parse ${fileType.toUpperCase()}: ${error.message}`);
  }
}

/**
 * Normalize extracted text
 * - Remove excessive whitespace
 * - Normalize line breaks
 * - Remove control characters
 */
function normalizeText(text: string): string {
  return (
    text
      // Remove control characters except newlines and tabs
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "")
      // Normalize line breaks
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Remove multiple consecutive blank lines
      .replace(/\n{3,}/g, "\n\n")
      // Normalize spaces
      .replace(/[ \t]+/g, " ")
      // Remove leading/trailing whitespace per line
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      // Final trim
      .trim()
  );
}

/**
 * Truncate text to maximum length with truncation notice
 */
function truncateText(text: string, maxLength: number): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= maxLength) {
    return { text, truncated: false };
  }

  const truncated = text.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf(".");
  const lastNewline = truncated.lastIndexOf("\n");
  
  // Try to truncate at a natural boundary
  const cutoff = Math.max(lastPeriod, lastNewline);
  const finalText = cutoff > maxLength * 0.9 ? truncated.substring(0, cutoff + 1) : truncated;

  return {
    text: finalText + "\n\n[Content truncated for length]",
    truncated: true,
  };
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract text content from a file buffer
 * 
 * @param buffer - File buffer to extract from
 * @param fileName - Original filename (for extension detection)
 * @param mimeType - MIME type of the file
 * @returns Extracted and normalized text content with metadata
 */
export async function extractTextFromFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ExtractedContent | ExtractionError> {
  // Validate file info
  const validation = validateFile({ name: fileName, size: buffer.length, type: mimeType });
  
  if (!validation.valid) {
    return {
      error: validation.error!,
      code: "INVALID_FILE",
    };
  }

  try {
    let extracted: ExtractedContent;

    // Extract based on MIME type
    switch (mimeType as AllowedMimeType) {
      case "application/pdf":
        extracted = await extractFromPDF(buffer);
        break;

      case "application/msword":
        extracted = await extractFromWord(buffer, "doc");
        break;

      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        extracted = await extractFromWord(buffer, "docx");
        break;

      default:
        return {
          error: `Unsupported MIME type: ${mimeType}`,
          code: "UNSUPPORTED_FORMAT",
        };
    }

    // Normalize text
    const normalized = normalizeText(extracted.text);

    // Truncate if necessary
    const { text: finalText, truncated } = truncateText(normalized, MAX_TEXT_LENGTH);

    return {
      text: finalText,
      metadata: {
        ...extracted.metadata,
        originalLength: normalized.length,
        truncated,
      },
    };
  } catch (error: any) {
    console.error("[v0] File extraction error:", error);
    return {
      error: error.message || "Failed to extract text from file",
      code: "PARSE_ERROR",
    };
  }
}

/**
 * Extract text from a File object (browser)
 */
export async function extractTextFromFileObject(
  file: File
): Promise<ExtractedContent | ExtractionError> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return extractTextFromFile(buffer, file.name, file.type);
}
