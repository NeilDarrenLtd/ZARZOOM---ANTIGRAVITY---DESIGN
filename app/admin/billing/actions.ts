"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  getPlans,
  getPlanById,
  createPlan as createPlanQuery,
  updatePlan as updatePlanQuery,
  archivePlan as archivePlanQuery,
  getSubscriptionStats,
  listSubscriptions,
  createPlanSchema,
  updatePlanSchema,
} from "@/lib/billing";
import type { PlanWithPrices, TenantSubscriptionRow } from "@/lib/billing";

/* ------------------------------------------------------------------ */
/*  Auth Guard (reuses same pattern as app/admin/actions.ts)           */
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
/*  Plan CRUD                                                          */
/* ------------------------------------------------------------------ */

export async function fetchPlans(): Promise<{
  plans: PlanWithPrices[];
  error?: string;
}> {
  try {
    await requireAdmin();
    const plans = await getPlans();
    return { plans };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch plans";
    return { plans: [], error: message };
  }
}

export async function fetchPlan(
  id: string
): Promise<{ plan: PlanWithPrices | null; error?: string }> {
  try {
    await requireAdmin();
    const plan = await getPlanById(id);
    return { plan };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch plan";
    return { plan: null, error: message };
  }
}

export async function createNewPlan(
  formData: FormData
): Promise<{ success?: boolean; error?: string; errors?: Record<string, string[]> }> {
  try {
    await requireAdmin();

    const raw = {
      name: formData.get("name") as string,
      slug: formData.get("slug") as string,
      description: formData.get("description") as string,
      is_active: formData.get("is_active") === "true",
      display_order: formData.get("display_order") as string,
      highlight: formData.get("highlight") === "true",
      quota_policy: JSON.parse((formData.get("quota_policy") as string) || "{}"),
      features: JSON.parse((formData.get("features") as string) || "[]"),
      entitlements: JSON.parse((formData.get("entitlements") as string) || "{}"),
      prices: JSON.parse((formData.get("prices") as string) || "[]"),
    };

    const result = createPlanSchema.safeParse(raw);
    if (!result.success) {
      return { errors: result.error.flatten().fieldErrors as Record<string, string[]> };
    }

    const { prices, ...planFields } = result.data;

    await createPlanQuery(
      {
        name: planFields.name,
        slug: planFields.slug,
        description: planFields.description || null,
        is_active: planFields.is_active,
        scope: null,
        tenant_id: null,
        display_order: planFields.display_order,
        highlight: planFields.highlight,
        quota_policy: planFields.quota_policy,
        features: planFields.features,
        entitlements: planFields.entitlements,
      },
      prices.map((p) => ({
        currency: p.currency,
        interval: p.interval,
        unit_amount: p.unitAmount,
      }))
    );

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create plan";
    return { error: message };
  }
}

export async function updateExistingPlan(
  formData: FormData
): Promise<{ success?: boolean; error?: string; errors?: Record<string, string[]> }> {
  try {
    await requireAdmin();

    const id = formData.get("id") as string;
    if (!id) return { error: "Plan ID is required" };

    const raw = {
      name: formData.get("name") as string | undefined,
      description: formData.get("description") as string | undefined,
      is_active: formData.has("is_active")
        ? formData.get("is_active") === "true"
        : undefined,
      display_order: formData.has("display_order")
        ? formData.get("display_order")
        : undefined,
      highlight: formData.has("highlight")
        ? formData.get("highlight") === "true"
        : undefined,
      quota_policy: formData.has("quota_policy")
        ? JSON.parse(formData.get("quota_policy") as string)
        : undefined,
      features: formData.has("features")
        ? JSON.parse(formData.get("features") as string)
        : undefined,
      entitlements: formData.has("entitlements")
        ? JSON.parse(formData.get("entitlements") as string)
        : undefined,
    };

    // Strip undefined values so partial update works
    const cleaned = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== undefined)
    );

    const result = updatePlanSchema.safeParse(cleaned);
    if (!result.success) {
      return { errors: result.error.flatten().fieldErrors as Record<string, string[]> };
    }

    await updatePlanQuery(id, result.data);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update plan";
    return { error: message };
  }
}

export async function archiveExistingPlan(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireAdmin();
    await archivePlanQuery(id);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to archive plan";
    return { error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Subscriptions & Stats                                              */
/* ------------------------------------------------------------------ */

export async function fetchSubscriptionStats(): Promise<{
  stats: Record<string, number>;
  error?: string;
}> {
  try {
    await requireAdmin();
    const stats = await getSubscriptionStats();
    return { stats };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch stats";
    return { stats: {}, error: message };
  }
}

export async function fetchSubscriptions(opts: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{
  subscriptions: TenantSubscriptionRow[];
  count: number;
  error?: string;
}> {
  try {
    await requireAdmin();
    const result = await listSubscriptions(opts);
    return result;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch subscriptions";
    return { subscriptions: [], count: 0, error: message };
  }
}
