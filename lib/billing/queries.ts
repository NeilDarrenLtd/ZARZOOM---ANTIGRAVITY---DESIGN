/**
 * lib/billing/queries.ts
 * 
 * Canonical pricing queries using the new schema (plans + plan_prices tables).
 * These queries replace the legacy subscription_plans structure.
 */

import { createClient } from "@/lib/supabase/server";
import type { Plan, PlanPrice, PlanWithPrices } from "./types";

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
export async function getPlans(opts?: { status?: "active" | "all" }) {
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
  }

  const { data, error } = await query;

  if (error) {
    console.error("[v0] Error fetching legacy plans:", error);
    throw new Error(`Failed to fetch plans: ${error.message}`);
  }

  return data || [];
}
