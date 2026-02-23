/**
 * lib/billing/queries.ts
 * 
 * Canonical pricing queries using the new schema (plans + plan_prices tables).
 * These queries replace the legacy subscription_plans structure.
 */

import { createClient } from "@/lib/supabase/server";
import type { Plan, PlanPrice, PlanWithPrices, TenantSubscriptionRow } from "./types";

/**
 * Fetch all active plans with their prices.
 * Used by the public GET /api/plans endpoint.
 * 
 * @returns Array of plans with associated prices, sorted by sort_order
 */
export async function getActivePlansWithPrices(): Promise<PlanWithPrices[]> {
  const supabase = await createClient();

  // Fetch plans
  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (plansError) {
    console.error("[v0] Error fetching plans:", plansError);
    throw new Error(`Failed to fetch plans: ${plansError.message}`);
  }

  if (!plans || plans.length === 0) {
    return [];
  }

  const planIds = plans.map((p) => p.id);

  // Fetch all active prices for these plans
  const { data: prices, error: pricesError } = await supabase
    .from("plan_prices")
    .select("*")
    .in("plan_id", planIds)
    .eq("is_active", true)
    .lte("effective_from", new Date().toISOString())
    .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString()}`);

  if (pricesError) {
    console.error("[v0] Error fetching prices:", pricesError);
    throw new Error(`Failed to fetch prices: ${pricesError.message}`);
  }

  // Group prices by plan_id
  const pricesByPlanId = new Map<string, PlanPrice[]>();
  (prices || []).forEach((price) => {
    const existing = pricesByPlanId.get(price.plan_id) || [];
    pricesByPlanId.set(price.plan_id, [...existing, price as PlanPrice]);
  });

  // Combine plans with their prices
  const plansWithPrices: PlanWithPrices[] = plans.map((plan) => ({
    ...(plan as Plan),
    prices: pricesByPlanId.get(plan.id) || [],
  }));

  return plansWithPrices;
}

/**
 * Fetch a single plan by plan_key with its prices.
 * 
 * @param planKey - The plan_key identifier (e.g., 'basic', 'pro')
 * @returns Plan with prices or null if not found
 */
export async function getPlanByKey(planKey: string): Promise<PlanWithPrices | null> {
  const supabase = await createClient();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("*")
    .eq("plan_key", planKey)
    .eq("is_active", true)
    .single();

  if (planError || !plan) {
    return null;
  }

  const { data: prices, error: pricesError } = await supabase
    .from("plan_prices")
    .select("*")
    .eq("plan_id", plan.id)
    .eq("is_active", true)
    .lte("effective_from", new Date().toISOString())
    .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString()}`);

  if (pricesError) {
    console.error("[v0] Error fetching prices for plan:", pricesError);
    return { ...(plan as Plan), prices: [] };
  }

  return {
    ...(plan as Plan),
    prices: (prices || []) as PlanPrice[],
  };
}

/**
 * Fetch all active plans (without prices).
 * Useful for admin interfaces or when prices aren't needed.
 */
export async function getActivePlans(): Promise<Plan[]> {
  const supabase = await createClient();

  const { data: plans, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[v0] Error fetching plans:", error);
    throw new Error(`Failed to fetch plans: ${error.message}`);
  }

  return (plans || []) as Plan[];
}

/**
 * Get plan by ID with prices.
 */
export async function getPlanById(planId: string): Promise<PlanWithPrices | null> {
  const supabase = await createClient();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (planError || !plan) {
    return null;
  }

  const { data: prices, error: pricesError } = await supabase
    .from("plan_prices")
    .select("*")
    .eq("plan_id", plan.id)
    .eq("is_active", true)
    .lte("effective_from", new Date().toISOString())
    .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString()}`);

  if (pricesError) {
    console.error("[v0] Error fetching prices:", pricesError);
    return { ...(plan as Plan), prices: [] };
  }

  return {
    ...(plan as Plan),
    prices: (prices || []) as PlanPrice[],
  };
}

/* ------------------------------------------------------------------ */
/*  ADMIN FUNCTIONS                                                     */
/* ------------------------------------------------------------------ */

/**
 * Get all plans (admin only) - includes inactive
 */
export async function getAllPlansWithPrices(): Promise<PlanWithPrices[]> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("*")
    .order("sort_order", { ascending: true });

  if (plansError) {
    console.error("[v0] Error fetching all plans:", plansError);
    throw new Error(`Failed to fetch plans: ${plansError.message}`);
  }

  if (!plans || plans.length === 0) {
    return [];
  }

  const planIds = plans.map((p) => p.id);

  const { data: prices, error: pricesError } = await supabase
    .from("plan_prices")
    .select("*")
    .in("plan_id", planIds);

  if (pricesError) {
    console.error("[v0] Error fetching prices:", pricesError);
    throw new Error(`Failed to fetch prices: ${pricesError.message}`);
  }

  const pricesByPlanId = new Map<string, PlanPrice[]>();
  (prices || []).forEach((price) => {
    const existing = pricesByPlanId.get(price.plan_id) || [];
    pricesByPlanId.set(price.plan_id, [...existing, price as PlanPrice]);
  });

  return plans.map((plan) => ({
    ...(plan as Plan),
    prices: pricesByPlanId.get(plan.id) || [],
  }));
}

/**
 * Create a new plan with prices (admin only)
 */
export async function createPlanWithPrices(
  planData: {
    plan_key: string;
    name: string;
    description: string | null;
    is_active: boolean;
    sort_order: number;
    entitlements: Record<string, boolean>;
    quota_policy: Record<string, number>;
    features: string[];
  },
  prices: {
    currency: string;
    interval: string;
    amount_minor: number;
  }[]
): Promise<PlanWithPrices> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .insert(planData)
    .select()
    .single();

  if (planError) {
    console.error("[v0] Error creating plan:", planError);
    throw planError;
  }

  const priceRows = prices.map((p) => ({
    plan_id: plan.id,
    currency: p.currency,
    interval: p.interval,
    amount_minor: p.amount_minor,
    is_active: true,
  }));

  const { data: insertedPrices, error: pricesError } = await supabase
    .from("plan_prices")
    .insert(priceRows)
    .select();

  if (pricesError) {
    console.error("[v0] Error creating prices:", pricesError);
    throw pricesError;
  }

  return {
    ...plan,
    prices: insertedPrices as PlanPrice[],
  };
}

/**
 * Update plan data (admin only)
 */
export async function updatePlanData(
  planId: string,
  updates: Partial<{
    name: string;
    description: string | null;
    is_active: boolean;
    sort_order: number;
    entitlements: Record<string, boolean>;
    quota_policy: Record<string, number>;
    features: string[];
  }>
): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  const { error } = await supabase
    .from("plans")
    .update(updates)
    .eq("id", planId);

  if (error) {
    console.error("[v0] Error updating plan:", error);
    throw error;
  }
}

/**
 * Toggle plan active status (admin only)
 */
export async function togglePlanStatus(
  planId: string,
  isActive: boolean
): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  const { error } = await supabase
    .from("plans")
    .update({ is_active: isActive })
    .eq("id", planId);

  if (error) {
    console.error("[v0] Error toggling plan status:", error);
    throw error;
  }
}

/**
 * LEGACY: Get plans using old schema (subscription_plans).
 * @deprecated Use getActivePlansWithPrices() instead
 */
export async function getPlans(opts?: { status?: "active" | "all" | "archived" }) {
  const supabase = await createClient();
  
  let query = supabase
    .from("subscription_plans")
    .select(`
      *,
      plan_prices:plan_prices(*)
    `)
    .order("display_order", { ascending: true });

  if (opts?.status === "active") {
    query = query.eq("is_active", true);
  } else if (opts?.status === "archived") {
    query = query.eq("is_active", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[v0] Error fetching legacy plans:", error);
    throw new Error(`Failed to fetch plans: ${error.message}`);
  }

  return data || [];
}

/**
 * LEGACY: Create plan using old schema
 * @deprecated Use createPlanWithPrices() instead
 */
export async function createPlan(
  planData: Record<string, unknown>,
  prices: Array<{ currency: string; interval: string; unit_amount: number }>
): Promise<{ id: string; plan_prices: unknown[] } & Record<string, unknown>> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  const { data: plan, error: planError } = await supabase
    .from("subscription_plans")
    .insert(planData)
    .select()
    .single();

  if (planError) {
    console.error("[v0] Error creating legacy plan:", planError);
    throw planError;
  }

  const priceRows = prices.map((p) => ({
    plan_id: plan.id,
    currency: p.currency,
    interval: p.interval,
    unit_amount: p.unit_amount,
  }));

  const { data: insertedPrices, error: pricesError } = await supabase
    .from("plan_prices")
    .insert(priceRows)
    .select();

  if (pricesError) {
    console.error("[v0] Error creating legacy prices:", pricesError);
    throw pricesError;
  }

  return {
    ...plan,
    plan_prices: insertedPrices || [],
  };
}

/**
 * LEGACY: Update plan using old schema
 * @deprecated Use updatePlanData() instead
 */
export async function updatePlan(
  planId: string,
  updates: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from("subscription_plans")
    .update(updates)
    .eq("id", planId)
    .select()
    .single();

  if (error) {
    console.error("[v0] Error updating legacy plan:", error);
    throw error;
  }

  return data;
}

/**
 * LEGACY: Archive plan using old schema
 * @deprecated Use togglePlanStatus() instead
 */
export async function archivePlan(planId: string): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  const { error } = await supabase
    .from("subscription_plans")
    .update({ is_active: false })
    .eq("id", planId);

  if (error) {
    console.error("[v0] Error archiving legacy plan:", error);
    throw error;
  }
}

/**
 * LEGACY: Get tenant subscription
 * @deprecated Implement proper subscription queries
 */
export async function getTenantSubscription(
  tenantId: string
): Promise<Record<string, unknown> | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tenant_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[v0] Error fetching tenant subscription:", error);
    return null;
  }

  return data;
}

/**
 * LEGACY: Get subscription stats
 * @deprecated Implement proper analytics queries
 */
export async function getSubscriptionStats(): Promise<Record<string, number>> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  const { count: activeCount } = await supabase
    .from("tenant_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const { count: totalCount } = await supabase
    .from("tenant_subscriptions")
    .select("*", { count: "exact", head: true });

  return {
    active: activeCount || 0,
    total: totalCount || 0,
  };
}

/**
 * LEGACY: List subscriptions
 * @deprecated Implement proper subscription queries
 */
export async function listSubscriptions(opts: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{
  subscriptions: TenantSubscriptionRow[];
  count: number;
}> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  let query = supabase
    .from("tenant_subscriptions")
    .select("*", { count: "exact" });

  if (opts.status) {
    query = query.eq("status", opts.status);
  }

  if (opts.limit) {
    query = query.limit(opts.limit);
  }

  if (opts.offset) {
    query = query.range(opts.offset, opts.offset + (opts.limit || 10) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[v0] Error listing subscriptions:", error);
    throw error;
  }

  return {
    subscriptions: (data || []) as TenantSubscriptionRow[],
    count: count || 0,
  };
}

/**
 * LEGACY: Version a price
 * @deprecated Implement proper price versioning
 */
export async function versionPrice(
  priceId: string,
  updates: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from("plan_prices")
    .update(updates)
    .eq("id", priceId)
    .select()
    .single();

  if (error) {
    console.error("[v0] Error versioning price:", error);
    throw error;
  }

  return data;
}

/**
 * LEGACY: Deactivate a price
 * @deprecated Use direct database updates
 */
export async function deactivatePrice(priceId: string): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  const { error } = await supabase
    .from("plan_prices")
    .update({ is_active: false })
    .eq("id", priceId);

  if (error) {
    console.error("[v0] Error deactivating price:", error);
    throw error;
  }
}
