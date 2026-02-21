import { createApiHandler, ok } from "@/lib/api";
import { ValidationError, NotFoundError } from "@/lib/api/errors";
import { updateTicketSchema } from "@/lib/validation/support";
import { sendStatusChangeNotification } from "@/lib/email/supportMailer";

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

    // Send email notification if status changed
    if (updates.status && oldStatus && oldStatus !== updates.status) {
      const userEmail = ctx.user!.email || 'unknown@example.com';
      sendStatusChangeNotification({
        ticketId: ticket.id,
        ticketSubject: ticket.subject,
        userEmail,
        oldStatus,
        newStatus: updates.status,
      }).catch((err) => {
        console.error("[Support] Failed to send status change email:", err);
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
