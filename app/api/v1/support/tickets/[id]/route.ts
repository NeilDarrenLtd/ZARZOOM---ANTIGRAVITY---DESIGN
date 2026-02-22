import { createApiHandler, ok } from "@/lib/api";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { verifyTicketOwnership, isUserAdmin } from "@/lib/auth/support";
import { z } from "zod";

const updateTicketSchema = z.object({
  status: z.enum(["open", "closed"]).optional(),
  close_reason: z.string().max(500).optional(),
});

/**
 * GET /api/v1/support/tickets/[id]
 * Get ticket details with comments and attachments.
 */
export const GET = createApiHandler({
  auth: true,
  tenantOptional: true, // Support tickets are user-scoped, not tenant-scoped
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
      .select("id, subject, status, priority, category, last_activity_at, created_at, updated_at")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new NotFoundError("Ticket");
    }

    // Fetch comments with attachments
    const { data: comments, error: commentsError } = await ctx.supabase!
      .from("support_comments")
      .select(`
        id,
        message,
        author_role,
        author_user_id,
        created_at,
        support_attachments (
          id,
          file_name,
          mime_type,
          file_size,
          file_path,
          created_at
        )
      `)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (commentsError) {
      throw new Error(`Failed to fetch comments: ${commentsError.message}`);
    }

    // Transform the nested structure to match frontend expectations
    const formattedComments = (comments ?? []).map((comment: any) => ({
      id: comment.id,
      message: comment.message,
      author_role: comment.author_role,
      created_at: comment.created_at,
      attachments: comment.support_attachments || [],
    }));

    return ok(
      {
        ticket,
        comments: formattedComments,
      },
      ctx.requestId
    );
  },
});

/**
 * PATCH /api/v1/support/tickets/[id]
 * Update ticket status (close ticket with optional reason).
 * Users can only close their own tickets.
 */
export const PATCH = createApiHandler({
  auth: true,
  tenantOptional: true,
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const ticketId = ctx.req.nextUrl.pathname.split("/").pop()!;
    const userId = ctx.user!.id;

    // Verify ownership
    await verifyTicketOwnership(ctx.supabase!, userId, ticketId);

    // Parse request body
    const body = await ctx.req.json();
    const parsed = updateTicketSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { status, close_reason } = parsed.data;

    // Users can only close tickets (not reopen)
    if (status && status !== "closed") {
      throw new ValidationError({ status: ["Users can only close tickets"] });
    }

    // Update ticket
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updates.status = status;
    }

    const { data: ticket, error } = await ctx.supabase!
      .from("support_tickets")
      .update(updates)
      .eq("id", ticketId)
      .select("id, subject, status, priority, category, last_activity_at, created_at")
      .single();

    if (error || !ticket) {
      throw new Error(`Failed to update ticket: ${error?.message}`);
    }

    // If closing with a reason, add a system comment
    if (status === "closed" && close_reason) {
      await ctx.supabase!.from("support_comments").insert({
        ticket_id: ticketId,
        message: `Ticket closed by user. Reason: ${close_reason}`,
        author_role: "system",
        author_user_id: userId,
      });
    }

    return ok({ ticket }, ctx.requestId);
  },
});
