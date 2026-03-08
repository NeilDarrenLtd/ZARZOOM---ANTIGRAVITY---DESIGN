import { createApiHandler, ok } from "@/lib/api";
import { ValidationError } from "@/lib/api/errors";
import { createTicketSchema } from "@/lib/validation/support";
import { sendNewTicketNotification } from "@/lib/email/supportMailer";

/**
 * GET /api/v1/support/tickets
 * List tickets for the active workspace.
 */
export const GET = createApiHandler({
  auth: true,
  tenantOptional: false,
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const tenantId = ctx.membership!.tenantId;
    const { data: tickets, error } = await ctx.supabase!
      .from("support_tickets")
      .select("id, subject, status, priority, category, last_activity_at, created_at")
      .eq("tenant_id", tenantId)
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
 * Create a new support ticket with initial comment, scoped to the active workspace.
 */
export const POST = createApiHandler({
  auth: true,
  tenantOptional: false,
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const body = await ctx.req.json();
    const parsed = createTicketSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { subject, description, category, priority } = parsed.data;
    const userId = ctx.user!.id;
    const tenantId = ctx.membership!.tenantId;

    const { data: ticket, error: ticketError } = await ctx.supabase!
      .from("support_tickets")
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        subject,
        status: "open",
        priority: priority || "normal",
        category: category || "general_question",
        last_activity_at: new Date().toISOString(),
      })
      .select("id, subject, status, priority, category, created_at")
      .single();

    if (ticketError || !ticket) {
      throw new Error(`Failed to create ticket: ${ticketError?.message ?? "unknown"}`);
    }

    // Create initial comment with description
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

    // Queue email notification for support team (async, don't block response)
    sendNewTicketNotification({
      ticketId: ticket.id,
      ticketSubject: ticket.subject,
      userEmail: ctx.user!.email || "Unknown",
      firstMessage: description,
      tenantId,
      createdBy: userId,
    }).catch((err) => {
      console.error("[Support] Failed to queue new ticket email:", err);
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
