import { createServerClient } from "@supabase/ssr";
import { env } from "./env";
import { QuotaExceededError } from "./errors";

export interface QuotaStatus {
  metric: string;
  currentUsage: number;
  limit: number | null; // null = unlimited
  remaining: number | null;
  periodStart: string;
  periodEnd: string;
}

/**
 * Check whether a tenant still has quota remaining for a given metric.
 *
 * Reads from `billing_usage_counters` (current usage) and
 * `subscription_plans.quota_policy` (limits).
 *
 * Returns the quota status. Does NOT throw -- use `enforceQuota` for that.
 */
export async function checkQuota(
  tenantId: string,
  metric: string
): Promise<QuotaStatus> {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

  const admin = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { cookies: { getAll: () => [], setAll() {} } }
  );

  // Get current usage for this period
  const now = new Date().toISOString();
  const { data: usage } = await admin
    .from("billing_usage_counters")
    .select("count, period_start, period_end")
    .eq("tenant_id", tenantId)
    .eq("metric", metric)
    .lte("period_start", now)
    .gte("period_end", now)
    .order("period_start", { ascending: false })
    .limit(1)
    .single();

  // Get the tenant's subscription and plan
  const { data: subscription } = await admin
    .from("tenant_subscriptions")
    .select("plan_id, subscription_plans(quota_policy)")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .limit(1)
    .single();

  const quotaPolicy = (
    subscription?.subscription_plans as unknown as {
      quota_policy: Record<string, number> | null;
    }
  )?.quota_policy;
  const limit = quotaPolicy?.[metric] ?? null;
  const currentUsage = usage?.count ?? 0;

  return {
    metric,
    currentUsage,
    limit,
    remaining: limit !== null ? Math.max(0, limit - currentUsage) : null,
    periodStart: usage?.period_start ?? now,
    periodEnd: usage?.period_end ?? now,
  };
}

/**
 * Enforce quota -- throws `QuotaExceededError` if usage is at or above limit.
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
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

  const admin = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { cookies: { getAll: () => [], setAll() {} } }
  );

  const now = new Date().toISOString();

  // Try to find the current period counter
  const { data: existing } = await admin
    .from("billing_usage_counters")
    .select("id, count")
    .eq("tenant_id", tenantId)
    .eq("metric", metric)
    .lte("period_start", now)
    .gte("period_end", now)
    .limit(1)
    .single();

  if (existing) {
    await admin
      .from("billing_usage_counters")
      .update({
        count: existing.count + amount,
        updated_at: now,
      })
      .eq("id", existing.id);
  } else {
    // Create a new counter for this billing period (calendar month)
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await admin.from("billing_usage_counters").insert({
      tenant_id: tenantId,
      metric,
      count: amount,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    });
  }
}
