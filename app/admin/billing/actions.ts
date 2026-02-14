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
      status: formData.get("status") as string,
      displayOrder: formData.get("displayOrder") as string,
      trialDays: formData.get("trialDays") as string,
      quotaPolicy: {},
      featureFlags: {},
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
        status: planFields.status,
        display_order: planFields.displayOrder,
        trial_days: planFields.trialDays,
        quota_policy: planFields.quotaPolicy,
        feature_flags: planFields.featureFlags,
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

    const raw = {
      id: formData.get("id") as string,
      name: formData.get("name") as string,
      slug: formData.get("slug") as string,
      description: formData.get("description") as string,
      status: formData.get("status") as string,
      displayOrder: formData.get("displayOrder") as string,
      trialDays: formData.get("trialDays") as string,
      prices: JSON.parse((formData.get("prices") as string) || "[]"),
    };

    const result = updatePlanSchema.safeParse(raw);
    if (!result.success) {
      return { errors: result.error.flatten().fieldErrors as Record<string, string[]> };
    }

    const { id, prices, ...updates } = result.data;

    await updatePlanQuery(
      id,
      {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.slug !== undefined && { slug: updates.slug }),
        ...(updates.description !== undefined && {
          description: updates.description || null,
        }),
        ...(updates.status !== undefined && { status: updates.status }),
        ...(updates.displayOrder !== undefined && {
          display_order: updates.displayOrder,
        }),
        ...(updates.trialDays !== undefined && {
          trial_days: updates.trialDays,
        }),
      },
      prices?.map((p) => ({
        currency: p.currency,
        interval: p.interval,
        unit_amount: p.unitAmount,
      }))
    );

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
