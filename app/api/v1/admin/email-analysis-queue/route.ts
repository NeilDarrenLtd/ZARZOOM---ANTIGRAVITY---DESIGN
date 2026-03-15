/**
 * GET /api/v1/admin/email-analysis-queue
 * List analyzer fallback queue entries (admin only).
 * Used when users submit their email after the floating analyzer fails.
 */

import { createApiHandler, ok } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

export const GET = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true,
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const params = ctx.req.nextUrl.searchParams;
    const status = params.get("status") || undefined;
    const page = Math.max(1, parseInt(params.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;

    const supabase = await createAdminClient();

    let query = supabase
      .from("email_analysis_queue")
      .select("id, email, profile_url, platform, created_at, failure_type, status", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: rows, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch email analysis queue: ${error.message}`);
    }

    const pendingCount = status
      ? null
      : await supabase
          .from("email_analysis_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending_manual_analysis")
          .then((r) => r.count ?? 0);

    return ok(
      {
        items: rows ?? [],
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages: Math.ceil((count ?? 0) / limit),
        },
        pendingCount: pendingCount ?? undefined,
      },
      ctx.requestId
    );
  },
});

const ALLOWED_STATUSES = ["pending_manual_analysis", "in_progress", "completed", "cancelled"] as const;

/**
 * PATCH /api/v1/admin/email-analysis-queue
 * Update status of a queue entry (admin follow-up).
 * Body: { id: string; status: "in_progress" | "completed" | "cancelled" }
 */
export const PATCH = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true,
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const body = await ctx.req.json().catch(() => ({}));
    const { id, status } = body as { id?: string; status?: string };

    if (!id || typeof id !== "string") {
      throw new Error("Invalid request. Provide { id: string }.");
    }
    if (!status || !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
      throw new Error(`Invalid status. Use one of: ${ALLOWED_STATUSES.join(", ")}`);
    }

    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from("email_analysis_queue")
      .update({ status })
      .eq("id", id)
      .select("id, status")
      .single();

    if (error) {
      throw new Error(`Failed to update queue entry: ${error.message}`);
    }

    if (!data) {
      throw new Error("Queue entry not found.");
    }

    return ok({ item: data }, ctx.requestId);
  },
});
