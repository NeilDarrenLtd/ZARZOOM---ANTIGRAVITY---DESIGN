import { z } from "zod";

/**
 * Validation schemas for support ticket system.
 */

export const supportStatusEnum = z.enum([
  "open",
  "investigating",
  "waiting_on_user",
  "resolved",
  "closed",
]);

export const supportPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

export const supportCategoryEnum = z.enum([
  "technical",
  "billing",
  "feature_request",
  "bug_report",
  "general",
  "other",
]);

export const authorRoleEnum = z.enum(["user", "admin", "system"]);

/**
 * Schema for creating a new ticket.
 */
export const createTicketSchema = z.object({
  subject: z.string().min(1, "support.validation.subjectRequired").max(200),
  description: z.string().min(1, "support.validation.descriptionRequired"),
  category: supportCategoryEnum.optional(),
  priority: supportPriorityEnum.optional().default("medium"),
});

/**
 * Schema for adding a comment to a ticket.
 */
export const addCommentSchema = z.object({
  message: z.string().min(1, "support.validation.messageRequired").max(10000),
});

/**
 * Schema for admin updating a ticket.
 */
export const updateTicketSchema = z.object({
  status: supportStatusEnum.optional(),
  priority: supportPriorityEnum.optional(),
  category: supportCategoryEnum.optional(),
});

/**
 * Schema for admin updating support settings.
 */
export const updateSettingsSchema = z.object({
  support_recipient_email: z
    .string()
    .email("support.validation.invalidEmail")
    .min(1, "support.validation.emailRequired"),
});

/**
 * Schema for admin ticket list filters.
 */
export const ticketFiltersSchema = z.object({
  status: supportStatusEnum.optional(),
  search: z.string().optional(),
  priority: supportPriorityEnum.optional(),
  category: supportCategoryEnum.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * File validation constants.
 */
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_ATTACHMENTS_PER_COMMENT = 3;

/**
 * Validate attachment file.
 */
export function validateAttachmentFile(file: File): {
  valid: boolean;
  error?: string;
} {
  // Check file type
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: "support.validation.invalidFileType",
    };
  }

  // Check file size
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return {
      valid: false,
      error: "support.validation.fileTooLarge",
    };
  }

  return { valid: true };
}
