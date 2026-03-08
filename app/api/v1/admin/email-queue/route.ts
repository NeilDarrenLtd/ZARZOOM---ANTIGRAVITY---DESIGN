import { createApiHandler, ok } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/v1/admin/email-queue
 * List email queue entries with optional filters (admin only).
 */
export const GET = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true,
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const params = ctx.req.nextUrl.searchParams;
    const status = params.get("status") || undefined;
    const emailType = params.get("email_type") || undefined;
    const search = params.get("search") || undefined;
    const page = Math.max(1, parseInt(params.get("page") || "1", 10));
    const limit = Math.min(500, Math.max(1, parseInt(params.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;

    const supabase = await createAdminClient();

    let query = supabase
      .from("email_queue")
      .select(
        "id, status, to_email, to_name, from_email, from_name, subject, email_type, related_type, related_id, tenant_id, created_by, retry_count, max_retries, error_message, priority, created_at, updated_at, queued_at, scheduled_for, sent_at, failed_at",
        { count: "exact" }
      );

    if (status) {
      query = query.eq("status", status);
    }
    if (emailType) {
      query = query.eq("email_type", emailType);
    }
    if (search) {
      const safe = search.replace(/[,()"']/g, "");
      if (safe) {
        query = query.or(
          `to_email.ilike.%${safe}%,subject.ilike.%${safe}%`
        );
      }
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: emails, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch email queue: ${error.message}`);
    }

    const [pendingRes, processingRes, failedRes] = await Promise.all([
      supabase.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "processing"),
      supabase.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
    ]);

    const statusCounts: Record<string, number> = {
      pending: pendingRes.count ?? 0,
      processing: processingRes.count ?? 0,
      failed: failedRes.count ?? 0,
    };

    return ok(
      {
        emails: emails ?? [],
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages: Math.ceil((count ?? 0) / limit),
        },
        statusCounts,
      },
      ctx.requestId
    );
  },
});

/**
 * GET /api/v1/admin/email-queue/[id] is handled by the [id] route.
 * PATCH: cancel a pending email.
 */
export const PATCH = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true,
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const body = await ctx.req.json();
    const { id, action } = body as { id?: string; action?: string };

    if (!id || action !== "cancel") {
      throw new Error("Invalid request. Provide { id, action: 'cancel' }.");
    }

    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from("email_queue")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("status", "pending")
      .select("id, status")
      .single();

    if (error) {
      throw new Error(`Failed to cancel email: ${error.message}`);
    }

    if (!data) {
      throw new Error("Email not found or is not in pending status.");
    }

    return ok({ email: data }, ctx.requestId);
  },
});
