import { createAdminClient } from "@/lib/supabase/server";
import type {
  PlanWithPrices,
  PlanRow,
  PlanPriceRow,
  TenantSubscriptionRow,
  SubscriptionWithPlan,
  PlanStatus,
  Currency,
  BillingInterval,
} from "./types";

/* ------------------------------------------------------------------ */
/*  Plans                                                              */
/* ------------------------------------------------------------------ */

/** Fetch all plans with their prices, ordered by display_order */
export async function getPlans(
  opts: { status?: PlanStatus } = {}
): Promise<PlanWithPrices[]> {
  const supabase = await createAdminClient();

  let query = supabase
    .from("subscription_plans")
    .select("*, plan_prices(*)")
    .order("display_order", { ascending: true });

  if (opts.status === "active") {
    query = query.eq("is_active", true);
  } else if (opts.status === "archived") {
    query = query.eq("is_active", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PlanWithPrices[];
}

/** Fetch a single plan by ID with prices */
export async function getPlanById(
  id: string
): Promise<PlanWithPrices | null> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*, plan_prices(*)")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as PlanWithPrices) ?? null;
}

/** Fetch a single plan by slug with prices */
export async function getPlanBySlug(
  slug: string
): Promise<PlanWithPrices | null> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*, plan_prices(*)")
    .eq("slug", slug)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as PlanWithPrices) ?? null;
}

/** Create a new plan with prices */
export async function createPlan(
  plan: Omit<PlanRow, "id" | "created_at" | "updated_at">,
  prices: { currency: Currency; interval: BillingInterval; unit_amount: number }[]
): Promise<PlanWithPrices> {
  const supabase = await createAdminClient();

  const { data: planData, error: planError } = await supabase
    .from("subscription_plans")
    .insert({
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      is_active: plan.is_active ?? true,
      display_order: plan.display_order,
      highlight: plan.highlight ?? false,
      quota_policy: plan.quota_policy,
      features: plan.features ?? [],
      entitlements: plan.entitlements ?? {},
    })
    .select()
    .single();

  if (planError) throw planError;

  const priceRows = prices.map((p) => ({
    plan_id: planData.id,
    currency: p.currency,
    interval: p.interval,
    unit_amount: p.unit_amount,
  }));

  const { data: priceData, error: priceError } = await supabase
    .from("plan_prices")
    .insert(priceRows)
    .select();

  if (priceError) throw priceError;

  return {
    ...(planData as PlanRow),
    plan_prices: (priceData ?? []) as PlanPriceRow[],
  };
}

/** Update plan metadata (not prices -- use versionPrice for that). */
export async function updatePlan(
  id: string,
  updates: Partial<Omit<PlanRow, "id" | "created_at" | "updated_at">>
): Promise<PlanWithPrices> {
  const supabase = await createAdminClient();

  const { error: planError } = await supabase
    .from("subscription_plans")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (planError) throw planError;

  return getPlanById(id) as Promise<PlanWithPrices>;
}

/**
 * Add a new price version for a plan.
 * Sets `effective_to` on the old active price for the same
 * (plan_id, currency, interval) combination -- never overwrites.
 */
export async function versionPrice(
  planId: string,
  price: {
    currency: Currency;
    interval: BillingInterval;
    unit_amount: number;
    billing_provider_price_id?: string | null;
    created_by?: string;
  }
): Promise<PlanPriceRow> {
  const supabase = await createAdminClient();
  const now = new Date().toISOString();

  // Deactivate the current active price for this slot
  await supabase
    .from("plan_prices")
    .update({ effective_to: now, is_active: false, updated_at: now })
    .eq("plan_id", planId)
    .eq("currency", price.currency)
    .eq("interval", price.interval)
    .eq("is_active", true);

  // Insert the new version
  const { data, error } = await supabase
    .from("plan_prices")
    .insert({
      plan_id: planId,
      currency: price.currency,
      interval: price.interval,
      unit_amount: price.unit_amount,
      billing_provider_price_id: price.billing_provider_price_id ?? null,
      is_active: true,
      effective_from: now,
      created_by: price.created_by ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as PlanPriceRow;
}

/** Deactivate (soft-disable) a specific price version. */
export async function deactivatePrice(priceId: string): Promise<void> {
  const supabase = await createAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("plan_prices")
    .update({ is_active: false, effective_to: now, updated_at: now })
    .eq("id", priceId);

  if (error) throw error;
}

/** Archive a plan (soft-disable, never hard-delete) */
export async function archivePlan(id: string): Promise<void> {
  const supabase = await createAdminClient();
  const { error } = await supabase
    .from("subscription_plans")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Subscriptions                                                      */
/* ------------------------------------------------------------------ */

/** Get a tenant's active subscription with plan details */
export async function getTenantSubscription(
  tenantId: string
): Promise<SubscriptionWithPlan | null> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("tenant_subscriptions")
    .select("*, plan:subscription_plans(*)")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as unknown as SubscriptionWithPlan) ?? null;
}

/** List all subscriptions (admin view) */
export async function listSubscriptions(opts: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ subscriptions: TenantSubscriptionRow[]; count: number }> {
  const supabase = await createAdminClient();

  let query = supabase
    .from("tenant_subscriptions")
    .select("*, plan:subscription_plans(name, slug)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (opts.status) query = query.eq("status", opts.status);
  if (opts.limit) query = query.limit(opts.limit);
  if (opts.offset) query = query.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    subscriptions: (data ?? []) as TenantSubscriptionRow[],
    count: count ?? 0,
  };
}

/** Get subscription counts by status (for dashboard) */
export async function getSubscriptionStats(): Promise<
  Record<string, number>
> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("tenant_subscriptions")
    .select("status");

  if (error) throw error;

  const stats: Record<string, number> = {};
  for (const row of data ?? []) {
    stats[row.status] = (stats[row.status] ?? 0) + 1;
  }
  return stats;
}
