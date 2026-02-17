import { createApiHandler, ok } from "@/lib/api";
import { NotFoundError } from "@/lib/api/errors";
import { verifyTicketOwnership, isUserAdmin } from "@/lib/auth/support";

/**
 * GET /api/v1/support/tickets/[id]
 * Get ticket details with comments and attachments.
 */
export const GET = createApiHandler({
  auth: true,
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const ticketId = ctx.req.nextUrl.pathname.split("/").pop()!;
    const userId = ctx.user!.id;

    // Check if user is admin
    const isAdmin = await isUserAdmin(ctx.supabase!, userId);

    // Verify ownership (or admin access)
    if (!isAdmin) {
      await verifyTicketOwnership(ctx.supabase!, userId, ticketId);
    }

    // Fetch ticket details
    const { data: ticket, error: ticketError } = await ctx.supabase!
      .from("support_tickets")
      .select("ticket_id, subject, status, priority, category, last_activity_at, created_at, updated_at")
      .eq("ticket_id", ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new NotFoundError("Ticket");
    }

    // Fetch comments with attachments
    const { data: comments, error: commentsError } = await ctx.supabase!
      .from("support_comments")
      .select(`
        comment_id,
        message,
        author_role,
        created_at,
        support_attachments (
          attachment_id,
          file_name,
          file_type,
          file_size,
          created_at
        )
      `)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (commentsError) {
      throw new Error(`Failed to fetch comments: ${commentsError.message}`);
    }

    return ok(
      {
        ticket,
        comments: comments ?? [],
      },
      ctx.requestId
    );
  },
});
