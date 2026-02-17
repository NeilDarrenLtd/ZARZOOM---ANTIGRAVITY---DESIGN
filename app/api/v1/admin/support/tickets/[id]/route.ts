import { createApiHandler, ok } from "@/lib/api";
import { ValidationError, NotFoundError } from "@/lib/api/errors";
import { updateTicketSchema } from "@/lib/validation/support";

/**
 * PATCH /api/v1/admin/support/tickets/[id]
 * Update ticket fields (admin only).
 */
export const PATCH = createApiHandler({
  requiredRole: "admin",
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

    // Update ticket
    const { data: ticket, error } = await ctx.supabase!
      .from("support_tickets")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq("ticket_id", ticketId)
      .select("ticket_id, subject, status, priority, category, updated_at, last_activity_at")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new NotFoundError("Ticket");
      }
      throw new Error(`Failed to update ticket: ${error.message}`);
    }

    return ok(
      {
        ticket,
      },
      ctx.requestId
    );
  },
});
