import { createApiHandler, ok } from "@/lib/api";
import { ValidationError } from "@/lib/api/errors";
import { addCommentSchema } from "@/lib/validation/support";
import { verifyTicketOwnership, isUserAdmin } from "@/lib/auth/support";
import {
  sendUserCommentNotification,
  sendAdminCommentNotification,
} from "@/lib/email/supportMailer";

/**
 * POST /api/v1/support/tickets/[id]/comments
 * Add a comment to a ticket.
 */
export const POST = createApiHandler({
  auth: true,
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const ticketId = ctx.req.nextUrl.pathname.split("/")[5]!;
    const userId = ctx.user!.id;

    const body = await ctx.req.json();
    const parsed = addCommentSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { message } = parsed.data;

    // Check if user is admin
    const isAdmin = await isUserAdmin(ctx.supabase!, userId);

    // Verify ownership (or admin access)
    if (!isAdmin) {
      await verifyTicketOwnership(ctx.supabase!, userId, ticketId);
    }

    // Add comment
    const { data: comment, error: commentError } = await ctx.supabase!
      .from("support_comments")
      .insert({
        ticket_id: ticketId,
        author_user_id: userId,
        author_role: isAdmin ? "admin" : "user",
        message,
      })
      .select("id, message, author_role, created_at")
      .single();

    if (commentError || !comment) {
      throw new Error(`Failed to add comment: ${commentError?.message ?? "unknown"}`);
    }

    // Update ticket's last_activity_at (trigger should handle this, but be explicit)
    await ctx.supabase!
      .from("support_tickets")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", ticketId);

    // Fetch ticket details for email notification
    const { data: ticket } = await ctx.supabase!
      .from("support_tickets")
      .select("subject, user_id")
      .eq("id", ticketId)
      .single();

    if (ticket) {
      const ticketOwnerEmail = ctx.user!.email || 'unknown@example.com';

      if (isAdmin) {
        // Admin comment → Email to user
        sendAdminCommentNotification({
          ticketId,
          ticketSubject: ticket.subject,
          userEmail: ticketOwnerEmail,
          adminComment: message,
        }).catch((err) => {
          console.error("[Support] Failed to send admin comment email:", err);
        });
      } else {
        // User comment → Email to support team
        sendUserCommentNotification({
          ticketId,
          ticketSubject: ticket.subject,
          userEmail: ctx.user!.email || "Unknown",
          commentText: message,
        }).catch((err) => {
          console.error("[Support] Failed to send user comment email:", err);
        });
      }
    }

    return ok(
      {
        comment,
      },
      ctx.requestId
    );
  },
});
