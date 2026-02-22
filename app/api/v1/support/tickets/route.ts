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
  tenantOptional: true, // Support tickets are user-scoped, not tenant-scoped
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
  tenantOptional: true, // Support tickets are user-scoped, not tenant-scoped
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    console.log("[v0] Create ticket: Starting request");
    const body = await ctx.req.json();
    console.log("[v0] Create ticket: Body received:", {
      subject: body.subject?.substring(0, 50),
      hasDescription: !!body.description,
      category: body.category,
      priority: body.priority,
    });
    
    const parsed = createTicketSchema.safeParse(body);

    if (!parsed.success) {
      console.log("[v0] Create ticket: Validation failed:", parsed.error.flatten());
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { subject, description, category, priority } = parsed.data;
    const userId = ctx.user!.id;
    console.log("[v0] Create ticket: User ID:", userId);

    // Create ticket (support_tickets has: id, user_id, subject, status, priority, category, last_activity_at, created_at, updated_at)
    console.log("[v0] Create ticket: Inserting into database");
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
      console.log("[v0] Create ticket: Insert failed:", ticketError);
      throw new Error(`Failed to create ticket: ${ticketError?.message ?? "unknown"}`);
    }
    
    console.log("[v0] Create ticket: Ticket created successfully, ID:", ticket.id);

    // Create initial comment with description
    // support_comments has: id, ticket_id, author_user_id, author_role, message, created_at
    console.log("[v0] Create ticket: Creating initial comment");
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
      console.log("[v0] Create ticket: Comment creation failed:", commentError);
      // Rollback ticket if comment creation fails
      await ctx.supabase!
        .from("support_tickets")
        .delete()
        .eq("id", ticket.id);

      throw new Error(`Failed to create initial comment: ${commentError?.message ?? "unknown"}`);
    }
    
    console.log("[v0] Create ticket: Comment created successfully, ID:", comment.id);

    // Send email notification to support team (async, don't block response)
    console.log("[v0] Create ticket: Sending email notification");
    sendNewTicketNotification({
      ticketId: ticket.id,
      ticketSubject: ticket.subject,
      userEmail: ctx.user!.email || "Unknown",
      firstMessage: description,
    }).catch((err) => {
      console.error("[Support] Failed to send new ticket email:", err);
    });

    console.log("[v0] Create ticket: Returning success response");
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
