import { createApiHandler, ok } from "@/lib/api";
import { ValidationError } from "@/lib/api/errors";
import { createTicketSchema } from "@/lib/validation/support";
import { sendNewTicketNotification } from "@/lib/email/supportMailer";

/**
 * GET /api/v1/support/tickets
 * List current user's tickets.
 */
export const GET = createApiHandler({
  auth: true,
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const { data: tickets, error } = await ctx.supabase!
      .from("support_tickets")
      .select("id, subject, status, priority, category, last_activity_at, created_at")
      .eq("user_id", ctx.user!.id)
      .order("last_activity_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch tickets: ${error.message}`);
    }

    return ok(
      {
        tickets: tickets ?? [],
      },
      ctx.requestId
    );
  },
});

/**
 * POST /api/v1/support/tickets
 * Create a new support ticket with initial comment.
 */
export const POST = createApiHandler({
  auth: true,
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const body = await ctx.req.json();
    const parsed = createTicketSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { subject, description, category, priority } = parsed.data;
    const userId = ctx.user!.id;

    // Create ticket (support_tickets has: id, user_id, subject, status, priority, category, last_activity_at, created_at, updated_at)
    const { data: ticket, error: ticketError } = await ctx.supabase!
      .from("support_tickets")
      .insert({
        user_id: userId,
        subject,
        status: "open",
        priority: priority || "medium",
        category: category || "general",
        last_activity_at: new Date().toISOString(),
      })
      .select("id, subject, status, priority, category, created_at")
      .single();

    if (ticketError || !ticket) {
      throw new Error(`Failed to create ticket: ${ticketError?.message ?? "unknown"}`);
    }

    // Create initial comment with description
    // support_comments has: id, ticket_id, author_user_id, author_role, message, created_at
    const { data: comment, error: commentError } = await ctx.supabase!
      .from("support_comments")
      .insert({
        ticket_id: ticket.id,
        author_user_id: userId,
        author_role: "user",
        message: description,
      })
      .select("id, message, created_at")
      .single();

    if (commentError || !comment) {
      // Rollback ticket if comment creation fails
      await ctx.supabase!
        .from("support_tickets")
        .delete()
        .eq("id", ticket.id);

      throw new Error(`Failed to create initial comment: ${commentError?.message ?? "unknown"}`);
    }

    // Send email notification to support team (async, don't block response)
    sendNewTicketNotification({
      ticketId: ticket.id,
      ticketSubject: ticket.subject,
      userEmail: ctx.user!.email || "Unknown",
      firstMessage: description,
    }).catch((err) => {
      console.error("[Support] Failed to send new ticket email:", err);
    });

    return ok(
      {
        ticket: {
          ...ticket,
          first_comment_id: comment.id,
        },
      },
      ctx.requestId
    );
  },
});
