import { createApiHandler, ok } from "@/lib/api";
import { ValidationError, NotFoundError } from "@/lib/api/errors";
import { addCommentSchema } from "@/lib/validation/support";
import { isUserAdmin } from "@/lib/auth/support";
import {
  sendUserCommentNotification,
  sendAdminCommentNotification,
} from "@/lib/email/supportMailer";

/**
 * POST /api/v1/support/tickets/[id]/comments
 * Add a comment to a ticket.
 * Workspace-scoped: ticket must belong to the active workspace.
 */
export const POST = createApiHandler({
  auth: true,
  tenantOptional: false,
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const ticketId = ctx.req.nextUrl.pathname.split("/")[5]!;
    const userId = ctx.user!.id;
    const tenantId = ctx.membership!.tenantId;

    const body = await ctx.req.json();
    const parsed = addCommentSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { message } = parsed.data;

    const isAdmin = await isUserAdmin(ctx.supabase!, userId);

    // Verify ticket belongs to this workspace (or admin can access any)
    if (!isAdmin) {
      const { data: ticket, error: ticketError } = await ctx.supabase!
        .from("support_tickets")
        .select("id")
        .eq("id", ticketId)
        .eq("tenant_id", tenantId)
        .single();

      if (ticketError || !ticket) {
        throw new NotFoundError("Ticket");
      }
    }

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

    await ctx.supabase!
      .from("support_tickets")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", ticketId);

    const { data: ticket } = await ctx.supabase!
      .from("support_tickets")
      .select("subject, user_id, profiles!support_tickets_user_id_fkey(email)")
      .eq("id", ticketId)
      .single();

    if (ticket) {
      if (isAdmin) {
        const userEmail = (ticket.profiles as any)?.email || 'unknown@example.com';
        sendAdminCommentNotification({
          ticketId,
          ticketSubject: ticket.subject,
          userEmail,
          adminComment: message,
          tenantId,
          createdBy: userId,
        }).catch((err) => {
          console.error("[Support] Failed to queue admin comment email:", err);
        });
      } else {
        sendUserCommentNotification({
          ticketId,
          ticketSubject: ticket.subject,
          userEmail: ctx.user!.email || "Unknown",
          commentText: message,
          tenantId,
          createdBy: userId,
        }).catch((err) => {
          console.error("[Support] Failed to queue user comment email:", err);
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
