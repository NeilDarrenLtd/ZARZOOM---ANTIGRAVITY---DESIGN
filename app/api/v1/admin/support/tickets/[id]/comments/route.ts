import { createApiHandler, ok } from "@/lib/api";
import { ValidationError, NotFoundError } from "@/lib/api/errors";
import { addCommentSchema } from "@/lib/validation/support";
import { sendAdminCommentNotification } from "@/lib/email/supportMailer";

/**
 * POST /api/v1/admin/support/tickets/[id]/comments
 * Add an admin comment to a ticket.
 */
export const POST = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true, // Admins can access support tickets without tenant membership
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const ticketId = ctx.req.nextUrl.pathname.split("/")[6]!;
    const userId = ctx.user!.id;

    const body = await ctx.req.json();
    const parsed = addCommentSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { message } = parsed.data;

    // Verify ticket exists and fetch details for email
    const { data: ticket, error: ticketError } = await ctx.supabase!
      .from("support_tickets")
      .select("id, subject, user_id")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new NotFoundError("Ticket");
    }

    // Add admin comment
    const { data: comment, error: commentError } = await ctx.supabase!
      .from("support_comments")
      .insert({
        ticket_id: ticketId,
        author_user_id: userId,
        author_role: "admin",
        message,
      })
      .select("id, message, author_role, created_at")
      .single();

    if (commentError || !comment) {
      throw new Error(`Failed to add comment: ${commentError?.message ?? "unknown"}`);
    }

    // Update ticket's last_activity_at
    await ctx.supabase!
      .from("support_tickets")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", ticketId);

    // Send email notification to ticket owner
    const userEmail = ctx.user!.email || 'unknown@example.com';
    sendAdminCommentNotification({
      ticketId,
      ticketSubject: ticket.subject,
      userEmail,
      adminComment: message,
    }).catch((err) => {
      console.error("[Support] Failed to send admin comment email:", err);
    });

    return ok(
      {
        comment,
      },
      ctx.requestId
    );
  },
});
