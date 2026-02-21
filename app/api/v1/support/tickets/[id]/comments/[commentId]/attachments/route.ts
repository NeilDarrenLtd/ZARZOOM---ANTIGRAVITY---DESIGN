import { createApiHandler, ok, badRequest } from "@/lib/api";
import { ValidationError } from "@/lib/api/errors";
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENTS_PER_COMMENT,
} from "@/lib/validation/support";
import { verifyCommentOwnership, isUserAdmin } from "@/lib/auth/support";
import { createAdminClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

/**
 * POST /api/v1/support/tickets/[id]/comments/[commentId]/attachments
 * Upload attachments for a comment (server-side multipart upload).
 */
export const POST = createApiHandler({
  auth: true,
  tenantOptional: true, // Support tickets are user-scoped, not tenant-scoped
  rateLimit: { maxRequests: 20, windowMs: 60_000 },
  handler: async (ctx) => {
    const pathSegments = ctx.req.nextUrl.pathname.split("/");
    const ticketId = pathSegments[5]!; // Still refers to the ticket ID value
    const commentId = pathSegments[7]!;
    const userId = ctx.user!.id;

    // Check if user is admin
    const isAdmin = await isUserAdmin(ctx.supabase!, userId);

    // Verify ownership (or admin access)
    if (!isAdmin) {
      await verifyCommentOwnership(ctx.supabase!, userId, ticketId, commentId);
    }

    // Parse multipart form data
    const formData = await ctx.req.formData();
    const files: File[] = [];

    for (const [key, value] of formData.entries()) {
      if (value instanceof File && key.startsWith("file")) {
        files.push(value);
      }
    }

    // Validate file count
    if (files.length === 0) {
      throw new ValidationError({ files: ["support.validation.noFilesProvided"] });
    }

    if (files.length > MAX_ATTACHMENTS_PER_COMMENT) {
      throw new ValidationError({
        files: [`support.validation.tooManyFiles:${MAX_ATTACHMENTS_PER_COMMENT}`],
      });
    }

    // Validate each file
    const validationErrors: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type as any)) {
        validationErrors.push(
          `support.validation.invalidFileType:${file.name}:${file.type}`
        );
      }

      if (file.size > MAX_ATTACHMENT_SIZE) {
        validationErrors.push(
          `support.validation.fileTooLarge:${file.name}:${(file.size / 1024 / 1024).toFixed(2)}MB`
        );
      }
    }

    if (validationErrors.length > 0) {
      throw new ValidationError({ files: validationErrors });
    }

    // Upload files to Supabase Storage using service role
    const adminClient = await createAdminClient();
    const uploadedAttachments: any[] = [];
    const uploadedPaths: string[] = [];

    try {
      for (const file of files) {
        const fileExt = file.name.split(".").pop() || "png";
        const fileName = `${randomUUID()}.${fileExt}`;
        const storagePath = `${ticketId}/${commentId}/${fileName}`;

        // Upload to storage
        const arrayBuffer = await file.arrayBuffer();
        const { data: uploadData, error: uploadError } = await adminClient.storage
          .from("support-attachments")
          .upload(storagePath, arrayBuffer, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError || !uploadData) {
          throw new Error(`Failed to upload ${file.name}: ${uploadError?.message ?? "unknown"}`);
        }

        uploadedPaths.push(storagePath);

        // Insert attachment record
        const { data: attachment, error: attachmentError } = await ctx.supabase!
          .from("support_attachments")
          .insert({
            ticket_id: ticketId,
            comment_id: commentId,
            uploaded_by_user_id: userId,
            uploaded_by_role: isAdmin ? 'admin' : 'user',
            kind: 'screenshot',
            file_path: storagePath,
            file_name: file.name,
            mime_type: file.type,
            file_size: file.size,
          })
          .select("id, file_name, mime_type, file_size, file_path, created_at")
          .single();

        if (attachmentError || !attachment) {
          // If DB insert fails, delete the uploaded file to avoid orphans
          await adminClient.storage
            .from("support-attachments")
            .remove([storagePath]);

          throw new Error(
            `Failed to save attachment metadata for ${file.name}: ${attachmentError?.message ?? "unknown"}`
          );
        }

        uploadedAttachments.push(attachment);
      }

      return ok(
        {
          attachments: uploadedAttachments,
        },
        ctx.requestId
      );
    } catch (error) {
      // Cleanup: delete any uploaded files if process failed
      if (uploadedPaths.length > 0) {
        await adminClient.storage
          .from("support-attachments")
          .remove(uploadedPaths);
      }

      throw error;
    }
  },
});
