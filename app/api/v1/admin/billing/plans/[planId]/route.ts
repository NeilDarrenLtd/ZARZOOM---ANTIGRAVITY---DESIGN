import { createApiHandler } from "@/lib/api/handler";
import { ok, badRequest } from "@/lib/api/http-responses";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/admin/audit";
import { updatePlan, archivePlan } from "@/lib/billing/queries";
import { updatePlanSchema } from "@/lib/billing/types";
import { createAdminClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ planId: string }> };

/** Fetch a single plan from subscription_plans and map to canonical shape */
async function fetchSubscriptionPlan(planId: string) {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .single();

  console.log("[v0] fetchSubscriptionPlan planId:", planId, "error:", error, "data:", data ? data.id : "NULL");

  if (error || !data) return null;

  return {
    id: data.id,
    plan_key: data.slug,
    name: data.name,
    description: data.description ?? null,
    is_active: data.is_active ?? true,
    sort_order: data.display_order ?? 0,
    entitlements: data.entitlements ?? {},
    quota_policy: data.quota_policy ?? {},
    features: data.features ?? [],
    created_at: data.created_at,
    updated_at: data.updated_at,
    prices: [],
    // keep raw fields available for update/audit diffs
    _raw: data,
  };
}

/* ------------------------------------------------------------------ */
/*  GET /api/v1/admin/billing/plans/[planId]                           */
/* ------------------------------------------------------------------ */

export const GET = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true,
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const { planId } = await (ctx.req as unknown as RouteParams).params;
    const plan = await fetchSubscriptionPlan(planId);
    if (!plan) throw new NotFoundError("Plan");
    return ok({ plan }, ctx.requestId);
  },
});

/* ------------------------------------------------------------------ */
/*  PUT /api/v1/admin/billing/plans/[planId]                           */
/*  Update plan metadata (name, description, features, quotas, etc.)   */
/*  Prices are managed separately via the /prices sub-route.           */
/* ------------------------------------------------------------------ */

export const PUT = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true,
  rateLimit: { maxRequests: 20, windowMs: 60_000 },
  handler: async (ctx) => {
    const { planId } = await (ctx.req as unknown as RouteParams).params;

    const existing = await fetchSubscriptionPlan(planId);
    if (!existing) throw new NotFoundError("Plan");

    const body = await ctx.req.json();
    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    // Map canonical field names back to subscription_plans column names
    const updateData: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    const fieldMap: Record<string, string> = {
      plan_key: "slug",
      sort_order: "display_order",
      name: "name",
      description: "description",
      is_active: "is_active",
      entitlements: "entitlements",
      quota_policy: "quota_policy",
      features: "features",
    };

    for (const [canonicalKey, dbKey] of Object.entries(fieldMap)) {
      if (canonicalKey in parsed.data) {
        const newVal = (parsed.data as Record<string, unknown>)[canonicalKey];
        const oldVal = (existing._raw as Record<string, unknown>)[dbKey];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          before[canonicalKey] = oldVal;
          after[canonicalKey] = newVal;
          updateData[dbKey] = newVal;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return ok({ plan: existing, message: "No changes detected" }, ctx.requestId);
    }

    const supabase = await createAdminClient();
    const { data: updated, error } = await supabase
      .from("subscription_plans")
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq("id", planId)
      .select("*")
      .single();

    if (error || !updated) throw new Error("Failed to update plan");

    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId: ctx.membership?.tenantId ?? "system",
      tableName: "subscription_plans",
      recordId: planId,
      action: "plan_updated",
      changes: { before, after },
    });

    return ok({ plan: { ...existing, ...after, _raw: updated } }, ctx.requestId);
  },
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/v1/admin/billing/plans/[planId]                        */
/*  Soft-disable (archive). Never hard-delete.                         */
/* ------------------------------------------------------------------ */

export const DELETE = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true,
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const { planId } = await (ctx.req as unknown as RouteParams).params;

    const existing = await fetchSubscriptionPlan(planId);
    if (!existing) throw new NotFoundError("Plan");

    const supabase = await createAdminClient();
    const { error } = await supabase
      .from("subscription_plans")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", planId);

    if (error) throw new Error("Failed to archive plan");

    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId: ctx.membership?.tenantId ?? "system",
      tableName: "subscription_plans",
      recordId: planId,
      action: "plan_archived",
      changes: {
        before: { is_active: existing.is_active },
        after: { is_active: false },
      },
    });

    return ok({ message: "Plan archived", id: planId }, ctx.requestId);
  },
});
