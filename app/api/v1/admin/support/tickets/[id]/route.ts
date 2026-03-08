import { createApiHandler, ok } from "@/lib/api";
import { ValidationError, NotFoundError } from "@/lib/api/errors";
import { updateTicketSchema } from "@/lib/validation/support";
import { sendStatusChangeNotification } from "@/lib/email/supportMailer";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/v1/admin/support/tickets/[id]
 * Get ticket details with comments and attachments (admin only).
 */
export const GET = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true,
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const ticketId = ctx.req.nextUrl.pathname.split("/").pop()!;
    const adminClient = await createAdminClient();

    // Fetch ticket
    const { data: ticket, error: ticketError } = await adminClient
      .from("support_tickets")
      .select("id, subject, status, priority, category, last_activity_at, created_at, updated_at, user_id")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new NotFoundError("Ticket");
    }

    // Fetch user email
    const { data: profile } = await adminClient
      .from("profiles")
      .select("email")
      .eq("id", ticket.user_id)
      .single();

    // Fetch comments with attachments
    const { data: comments, error: commentsError } = await adminClient
      .from("support_comments")
      .select(`
        id,
        message,
        author_role,
        author_user_id,
        created_at
      `)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (commentsError) {
      throw new Error(`Failed to fetch comments: ${commentsError.message}`);
    }

    // Fetch attachments for all comments
    const commentIds = (comments ?? []).map((c: any) => c.id);
    let attachmentsByComment: Record<string, any[]> = {};

    if (commentIds.length > 0) {
      const { data: attachments } = await adminClient
        .from("support_attachments")
        .select("id, comment_id, file_name, mime_type, file_size, file_path, created_at")
        .in("comment_id", commentIds);

      if (attachments) {
        for (const att of attachments) {
          if (!attachmentsByComment[att.comment_id]) {
            attachmentsByComment[att.comment_id] = [];
          }
          attachmentsByComment[att.comment_id].push(att);
        }
      }
    }

    const formattedComments = (comments ?? []).map((comment: any) => ({
      id: comment.id,
      message: comment.message,
      author_role: comment.author_role,
      created_at: comment.created_at,
      attachments: attachmentsByComment[comment.id] || [],
    }));

    return ok(
      {
        ticket: {
          ...ticket,
          profiles: { email: profile?.email || "Unknown" },
        },
        comments: formattedComments,
      },
      ctx.requestId
    );
  },
});

/**
 * PATCH /api/v1/admin/support/tickets/[id]
 * Update ticket fields (admin only).
 */
export const PATCH = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true, // Admins can access support tickets without tenant membership
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const ticketId = ctx.req.nextUrl.pathname.split("/").pop()!;

    const body = await ctx.req.json();
    const parsed = updateTicketSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const updates = parsed.data;

    // Check if there are any updates
    if (Object.keys(updates).length === 0) {
      throw new ValidationError({ _form: ["support.validation.noUpdatesProvided"] });
    }

    // Fetch current ticket status if status is being changed (for email notification)
    let oldStatus: string | null = null;
    if (updates.status) {
      const { data: currentTicket } = await ctx.supabase!
        .from("support_tickets")
        .select("status")
        .eq("id", ticketId)
        .single();
      oldStatus = currentTicket?.status || null;
    }

    // Update ticket
    const { data: ticket, error } = await ctx.supabase!
      .from("support_tickets")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", ticketId)
      .select("id, subject, status, priority, category, updated_at, last_activity_at, user_id")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new NotFoundError("Ticket");
      }
      throw new Error(`Failed to update ticket: ${error.message}`);
    }

    // Send email notification if status changed - send to the TICKET OWNER, not the admin
    if (updates.status && oldStatus && oldStatus !== updates.status) {
      const adminClient = await createAdminClient();
      const { data: ownerProfile } = await adminClient
        .from("profiles")
        .select("email")
        .eq("id", ticket.user_id)
        .single();

      const ownerEmail = ownerProfile?.email || 'unknown@example.com';
      sendStatusChangeNotification({
        ticketId: ticket.id,
        ticketSubject: ticket.subject,
        userEmail: ownerEmail,
        oldStatus,
        newStatus: updates.status,
        createdBy: ctx.user!.id,
      }).catch((err) => {
        console.error("[Support] Failed to queue status change email:", err);
      });
    }

    return ok(
      {
        ticket,
      },
      ctx.requestId
    );
  },
});
