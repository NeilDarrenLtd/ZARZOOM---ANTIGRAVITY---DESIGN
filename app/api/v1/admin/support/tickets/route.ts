import { createApiHandler, ok } from "@/lib/api";
import { ValidationError } from "@/lib/api/errors";
import { ticketFiltersSchema } from "@/lib/validation/support";

/**
 * GET /api/v1/admin/support/tickets
 * List all tickets with filters (admin only).
 */
export const GET = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const searchParams = Object.fromEntries(ctx.req.nextUrl.searchParams.entries());
    const parsed = ticketFiltersSchema.safeParse(searchParams);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { status, search, priority, category, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    // Build query
    let query = ctx.supabase!
      .from("support_tickets")
      .select(
        `
        ticket_id,
        subject,
        status,
        priority,
        category,
        last_activity_at,
        created_at,
        user_id,
        profiles!support_tickets_user_id_fkey (
          email,
          full_name
        )
      `,
        { count: "exact" }
      );

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }

    if (priority) {
      query = query.eq("priority", priority);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (search) {
      // Search in ticket_id, subject, or user email
      query = query.or(
        `ticket_id.ilike.%${search}%,subject.ilike.%${search}%,profiles.email.ilike.%${search}%`
      );
    }

    // Apply pagination and sorting
    query = query
      .order("last_activity_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: tickets, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch tickets: ${error.message}`);
    }

    return ok(
      {
        tickets: tickets ?? [],
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages: Math.ceil((count ?? 0) / limit),
        },
      },
      ctx.requestId
    );
  },
});
