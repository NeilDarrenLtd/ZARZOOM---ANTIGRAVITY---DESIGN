import { z } from "zod";
import { createApiHandler, ok, badRequest } from "@/lib/api";

/**
 * GET /api/v1/jobs
 *
 * List jobs for the authenticated tenant.
 * Supports filters: type, status, created_after, created_before.
 * Cursor pagination via `cursor` (job id) + `limit`.
 */

const filtersSchema = z.object({
  type: z.string().optional(),
  provider: z.string().optional(),
  status: z
    .enum(["pending", "scheduled", "running", "completed", "failed", "cancelled"])
    .optional(),
  created_after: z.string().datetime({ offset: true }).optional(),
  created_before: z.string().datetime({ offset: true }).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const GET = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const params = Object.fromEntries(ctx.req.nextUrl.searchParams);
    const parsed = filtersSchema.safeParse(params);

    if (!parsed.success) {
      return badRequest(ctx.requestId, "Invalid query parameters", parsed.error.flatten().fieldErrors);
    }

    const { type, provider, status, created_after, created_before, cursor, limit } = parsed.data;
    const tenantId = ctx.membership!.tenantId;

    let query = ctx.supabase!
      .from("jobs")
      .select("id, type, status, priority, payload, result, error, attempt, max_attempts, created_at, updated_at, scheduled_for")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit + 1); // fetch one extra to detect next page

    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);
    if (created_after) query = query.gte("created_at", created_after);
    if (created_before) query = query.lte("created_at", created_before);

    // Provider filter: payload->provider
    if (provider) query = query.eq("payload->>provider", provider);

    // Cursor-based pagination: get rows created before the cursor row
    if (cursor) {
      // Fetch the cursor row's created_at to paginate
      const { data: cursorRow } = await ctx.supabase!
        .from("jobs")
        .select("created_at")
        .eq("id", cursor)
        .eq("tenant_id", tenantId)
        .single();

      if (cursorRow) {
        query = query.lt("created_at", cursorRow.created_at);
      }
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error(`[API] jobs list error (${ctx.requestId}):`, error.message);
      return badRequest(ctx.requestId, "Failed to query jobs");
    }

    const hasMore = (rows?.length ?? 0) > limit;
    const items = (rows ?? []).slice(0, limit);
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    const jobs = items.map((row) => ({
      job_id: row.id,
      type: row.type,
      provider: (row.payload as Record<string, unknown>)?.provider ?? null,
      status: row.status,
      progress: row.status === "completed" ? 100 : row.status === "running" ? 50 : 0,
      attempt: row.attempt,
      max_attempts: row.max_attempts,
      created_at: row.created_at,
      updated_at: row.updated_at,
      scheduled_for: row.scheduled_for,
      error: row.error,
    }));

    return ok({
      jobs,
      pagination: {
        limit,
        has_more: hasMore,
        next_cursor: nextCursor,
      },
    }, ctx.requestId);
  },
});
