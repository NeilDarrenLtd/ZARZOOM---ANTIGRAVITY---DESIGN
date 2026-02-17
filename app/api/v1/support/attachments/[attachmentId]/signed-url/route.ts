import { createApiHandler, ok } from "@/lib/api";
import { verifyAttachmentAccess } from "@/lib/auth/support";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/v1/support/attachments/[attachmentId]/signed-url
 * Get a signed download URL for an attachment.
 */
export const GET = createApiHandler({
  auth: true,
  rateLimit: { maxRequests: 100, windowMs: 60_000 },
  handler: async (ctx) => {
    const attachmentId = ctx.req.nextUrl.pathname.split("/")[5]!;
    const userId = ctx.user!.id;

    // Verify user has access to this attachment
    const { storagePath } = await verifyAttachmentAccess(
      ctx.supabase!,
      userId,
      attachmentId
    );

    // Generate signed URL (5 minutes expiry)
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient.storage
      .from("support-attachments")
      .createSignedUrl(storagePath, 300); // 300 seconds = 5 minutes

    if (error || !data) {
      throw new Error(`Failed to generate signed URL: ${error?.message ?? "unknown"}`);
    }

    return ok(
      {
        signedUrl: data.signedUrl,
        expiresIn: 300,
      },
      ctx.requestId
    );
  },
});
