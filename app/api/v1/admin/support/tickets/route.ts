import { createApiHandler, ok } from "@/lib/api";
import { ValidationError } from "@/lib/api/errors";
import { ticketFiltersSchema } from "@/lib/validation/support";
import { createAdminClient } from "@/lib/supabase/server";

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

    // Use admin client to bypass RLS and avoid FK join issues
    const adminClient = await createAdminClient();

    // Build query - fetch tickets without FK join to avoid relationship errors
    let query = adminClient
      .from("support_tickets")
      .select(
        "id, subject, status, priority, category, last_activity_at, created_at, user_id",
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
      console.error("[v0] Admin tickets query error:", error);
      throw new Error(`Failed to fetch tickets: ${error.message}`);
    }

    // Batch-fetch user emails for all tickets
    const userIds = [...new Set((tickets ?? []).map((t: any) => t.user_id))];
    let emailMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, email")
        .in("id", userIds);

      if (profiles) {
        emailMap = Object.fromEntries(
          profiles.map((p: any) => [p.id, p.email])
        );
      }
    }

    // Map to expected frontend format
    const mappedTickets = (tickets ?? []).map((t: any) => ({
      id: t.id,
      ticket_id: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      category: t.category,
      created_at: t.created_at,
      last_activity_at: t.last_activity_at,
      user_id: t.user_id,
      profiles: { email: emailMap[t.user_id] || "Unknown" },
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
