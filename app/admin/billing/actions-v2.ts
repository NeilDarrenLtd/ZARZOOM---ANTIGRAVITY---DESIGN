"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  getAllPlansWithPrices,
  createPlanWithPrices,
  updatePlanData,
  togglePlanStatus,
} from "@/lib/billing/queries";
import { createPlanSchema, updatePlanSchema } from "@/lib/billing/types";
import type { PlanWithPrices } from "@/lib/billing/types";
import { hasPlanCopy } from "@/lib/i18n/plan-copy";
import enTranslations from "@/locales/en.json";

/* ------------------------------------------------------------------ */
/*  Auth Guard                                                         */
/* ------------------------------------------------------------------ */

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  if (user.user_metadata?.is_admin === true) return user;

  const adminSupabase = await createAdminClient();
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) throw new Error("Not authorised");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Plan Management                                                    */
/* ------------------------------------------------------------------ */

export async function fetchAllPlans(): Promise<{
  plans: PlanWithPrices[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const plans = await getAllPlansWithPrices();
    
    // Check i18n availability for each plan
    const plansWithI18n = plans.map((plan) => ({
      ...plan,
      hasI18nCopy: hasPlanCopy(plan.plan_key, (key: string) => {
        const keys = key.split(".");
        let value: any = enTranslations;
        for (const k of keys) {
          value = value?.[k];
        }
        return value || key;
      }),
    }));
    
    return { plans: plansWithI18n as any };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch plans";
    return { plans: [], error: message };
  }
}

export async function createNewPlanV2(data: {
  plan_key: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  features: string[];
  entitlements: Record<string, boolean>;
  quota_policy: Record<string, number>;
  prices: Array<{
    currency: string;
    interval: string;
    amount_minor: number;
  }>;
  discount_percent?: number;
  max_ads_per_week?: number;
}): Promise<{ success?: boolean; plan?: PlanWithPrices; error?: string }> {
  try {
    await requireAdmin();

    // Validate plan_key format (slug)
    const slugRegex = /^[a-z0-9_-]+$/;
    if (!slugRegex.test(data.plan_key)) {
      return {
        error: "Plan key must be lowercase alphanumeric with dashes or underscores only",
      };
    }

    // Check uniqueness
    const supabase = await createAdminClient();
    const { data: existing } = await supabase
      .from("plans")
      .select("id")
      .eq("plan_key", data.plan_key)
      .maybeSingle();

    if (existing) {
      return { error: `A plan with key "${data.plan_key}" already exists` };
    }

    // Validate all prices > 0
    for (const price of data.prices) {
      if (price.amount_minor <= 0) {
        return {
          error: `Price for ${price.currency} ${price.interval} must be greater than 0`,
        };
      }
    }

    // Add discount configuration to quota_policy
    const quota_policy = {
      ...data.quota_policy,
      ...(data.discount_percent && {
        advertising_discount_percent: data.discount_percent,
        max_ads_per_week: data.max_ads_per_week || 7,
      }),
    };

    const plan = await createPlanWithPrices(
      {
        plan_key: data.plan_key,
        name: data.name,
        description: data.description || null,
        is_active: data.is_active,
        sort_order: data.sort_order,
        entitlements: data.entitlements,
        quota_policy,
        features: data.features,
      },
      data.prices
    );

    console.log("[v0] Admin created plan:", plan.plan_key);

    return { success: true, plan };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create plan";
    console.error("[v0] Error creating plan:", err);
    return { error: message };
  }
}

export async function updatePlanV2(
  planId: string,
  updates: {
    name?: string;
    description?: string;
    is_active?: boolean;
    sort_order?: number;
    features?: string[];
    entitlements?: Record<string, boolean>;
    quota_policy?: Record<string, number>;
  }
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireAdmin();

    await updatePlanData(planId, updates);

    console.log("[v0] Admin updated plan:", planId);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update plan";
    console.error("[v0] Error updating plan:", err);
    return { error: message };
  }
}

export async function togglePlanStatusAction(
  planId: string,
  isActive: boolean
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireAdmin();

    await togglePlanStatus(planId, isActive);

    console.log("[v0] Admin toggled plan status:", planId, "->", isActive);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to toggle plan status";
    console.error("[v0] Error toggling plan status:", err);
    return { error: message };
  }
}

export async function addPriceToPlan(
  planId: string,
  priceData: {
    currency: string;
    interval: string;
    amount_minor: number;
  }
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (priceData.amount_minor <= 0) {
      return { error: "Price must be greater than 0" };
    }

    const supabase = await createAdminClient();

    const { error } = await supabase.from("plan_prices").insert({
      plan_id: planId,
      currency: priceData.currency,
      interval: priceData.interval,
      amount_minor: priceData.amount_minor,
      is_active: true,
    });

    if (error) {
      console.error("[v0] Error adding price:", error);
      return { error: error.message };
    }

    console.log("[v0] Admin added price to plan:", planId);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add price";
    console.error("[v0] Error adding price:", err);
    return { error: message };
  }
}
