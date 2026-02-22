import { createApiHandler, ok } from "@/lib/api";
import { ValidationError } from "@/lib/api/errors";
import { ticketFiltersSchema } from "@/lib/validation/support";

/**
 * GET /api/v1/admin/support/tickets
 * List all tickets with filters (admin only).
 */
export const GET = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true, // Admins can access support tickets without tenant membership
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const searchParams = Object.fromEntries(ctx.req.nextUrl.searchParams.entries());
    const parsed = ticketFiltersSchema.safeParse(searchParams);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { status, search, priority, category, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    // Build query with user email
    let query = ctx.supabase!
      .from("support_tickets")
      .select(
        `
        id,
        subject,
        status,
        priority,
        category,
        last_activity_at,
        created_at,
        user_id,
        profiles!support_tickets_user_id_fkey (
          email
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
      // Search in id or subject
      query = query.or(
        `id.ilike.%${search}%,subject.ilike.%${search}%`
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

    // Map to expected frontend format
    const mappedTickets = (tickets ?? []).map((t: any) => ({
      id: t.id,
      ticket_id: t.id, // Add ticket_id for backward compatibility
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      category: t.category,
      created_at: t.created_at,
      last_activity_at: t.last_activity_at,
      user_id: t.user_id,
      profiles: t.profiles, // Keep nested profile object
    }));

    return ok(
      {
        tickets: mappedTickets,
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
