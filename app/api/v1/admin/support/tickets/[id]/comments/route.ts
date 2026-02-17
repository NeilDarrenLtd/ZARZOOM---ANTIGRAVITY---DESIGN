import { createApiHandler, ok } from "@/lib/api";
import { ValidationError, NotFoundError } from "@/lib/api/errors";
import { addCommentSchema } from "@/lib/validation/support";

/**
 * POST /api/v1/admin/support/tickets/[id]/comments
 * Add an admin comment to a ticket.
 */
export const POST = createApiHandler({
  requiredRole: "admin",
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

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await ctx.supabase!
      .from("support_tickets")
      .select("ticket_id")
      .eq("ticket_id", ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new NotFoundError("Ticket");
    }

    // Add admin comment
    const { data: comment, error: commentError } = await ctx.supabase!
      .from("support_comments")
      .insert({
        ticket_id: ticketId,
        author_id: userId,
        author_role: "admin",
        message,
      })
      .select("comment_id, message, author_role, created_at")
      .single();

    if (commentError || !comment) {
      throw new Error(`Failed to add comment: ${commentError?.message ?? "unknown"}`);
    }

    // Update ticket's last_activity_at
    await ctx.supabase!
      .from("support_tickets")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("ticket_id", ticketId);

    return ok(
      {
        comment,
      },
      ctx.requestId
    );
  },
});
