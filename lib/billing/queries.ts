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

/** Update a plan and replace its prices */
export async function updatePlan(
  id: string,
  updates: Partial<Omit<PlanRow, "id" | "created_at" | "updated_at">>,
  prices?: { currency: Currency; interval: BillingInterval; unit_amount: number }[]
): Promise<PlanWithPrices> {
  const supabase = await createAdminClient();

  const { data: planData, error: planError } = await supabase
    .from("subscription_plans")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (planError) throw planError;

  if (prices) {
    // Delete existing prices and re-insert
    const { error: deleteError } = await supabase
      .from("plan_prices")
      .delete()
      .eq("plan_id", id);

    if (deleteError) throw deleteError;

    const priceRows = prices.map((p) => ({
      plan_id: id,
      currency: p.currency,
      interval: p.interval,
      unit_amount: p.unit_amount,
    }));

    const { error: insertError } = await supabase
      .from("plan_prices")
      .insert(priceRows);

    if (insertError) throw insertError;
  }

  return getPlanById(id) as Promise<PlanWithPrices>;
}

/** Archive a plan (soft delete) */
export async function archivePlan(id: string): Promise<void> {
  const supabase = await createAdminClient();
  const { error } = await supabase
    .from("subscription_plans")
    .update({ status: "archived", updated_at: new Date().toISOString() })
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
