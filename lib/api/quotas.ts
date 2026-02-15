import { createServerClient } from "@supabase/ssr";
import { env } from "./env";
import { QuotaExceededError } from "./errors";
import { getEffectivePlanForTenant } from "@/lib/billing/entitlements";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface QuotaStatus {
  metric: string;
  currentUsage: number;
  /** null = unlimited */
  limit: number | null;
  remaining: number | null;
  periodStart: string;
  periodEnd: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function adminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  return createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { cookies: { getAll: () => [], setAll() {} } }
  );
}

/** Calendar-month billing period boundaries. */
function currentPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

/* ------------------------------------------------------------------ */
/*  Core                                                               */
/* ------------------------------------------------------------------ */

/**
 * Check whether a tenant still has quota remaining for a given metric.
 *
 * Resolves the effective plan via the entitlements cache (not raw DB),
 * then reads the current counter from `billing_usage_counters`.
 *
 * Returns the quota status. Does NOT throw -- use `enforceQuota` for that.
 */
export async function checkQuota(
  tenantId: string,
  metric: string
): Promise<QuotaStatus> {
  const admin = adminClient();

  // 1. Get the limit from the entitlements cache
  const plan = await getEffectivePlanForTenant(tenantId);
  const limit = (plan.quotaPolicy[metric] as number | undefined) ?? null;

  // 2. Get current usage for this billing period
  const { start, end } = currentPeriod();
  const { data: usage } = await admin
    .from("billing_usage_counters")
    .select("count, period_start, period_end")
    .eq("tenant_id", tenantId)
    .eq("metric", metric)
    .gte("period_start", start.toISOString())
    .lte("period_end", end.toISOString())
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentUsage = usage?.count ?? 0;

  return {
    metric,
    currentUsage,
    limit,
    remaining: limit !== null ? Math.max(0, limit - currentUsage) : null,
    periodStart: usage?.period_start ?? start.toISOString(),
    periodEnd: usage?.period_end ?? end.toISOString(),
  };
}

/**
 * Enforce quota -- throws `QuotaExceededError` (402) if usage >= limit.
 */
export async function enforceQuota(
  tenantId: string,
  metric: string
): Promise<QuotaStatus> {
  const status = await checkQuota(tenantId, metric);
  if (status.limit !== null && status.currentUsage >= status.limit) {
    throw new QuotaExceededError(metric);
  }
  return status;
}

/**
 * Increment a usage counter by `amount` (default 1).
 *
 * If no counter row exists for the current billing period, one is created.
 */
export async function incrementUsage(
  tenantId: string,
  metric: string,
  amount = 1
): Promise<void> {
  const admin = adminClient();
  const { start, end } = currentPeriod();
  const now = new Date().toISOString();

  // Try to find the current period counter
  const { data: existing } = await admin
    .from("billing_usage_counters")
    .select("id, count")
    .eq("tenant_id", tenantId)
    .eq("metric", metric)
    .gte("period_start", start.toISOString())
    .lte("period_end", end.toISOString())
    .limit(1)
    .maybeSingle();

  if (existing) {
    await admin
      .from("billing_usage_counters")
      .update({ count: existing.count + amount, updated_at: now })
      .eq("id", existing.id);
  } else {
    await admin.from("billing_usage_counters").insert({
      tenant_id: tenantId,
      metric,
      count: amount,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
    });
  }
}

/**
 * Build standard quota-status response headers.
 *
 * Attach these to any 200/202 response so callers can track usage
 * without making a separate request.
 */
export function quotaHeaders(status: QuotaStatus): Record<string, string> {
  const h: Record<string, string> = {
    "X-Quota-Metric": status.metric,
    "X-Quota-Used": String(status.currentUsage),
  };
  if (status.limit !== null) {
    h["X-Quota-Limit"] = String(status.limit);
    h["X-Quota-Remaining"] = String(status.remaining ?? 0);
  }
  return h;
}
