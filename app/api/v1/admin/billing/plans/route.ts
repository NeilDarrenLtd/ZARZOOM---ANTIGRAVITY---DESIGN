import { createApiHandler } from "@/lib/api/handler";
import { ok, created, badRequest } from "@/lib/api/http-responses";
import { ValidationError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/admin/audit";
import {
  getAllPlansWithPrices,
  createPlanWithPrices,
} from "@/lib/billing/queries";
import { createPlanSchema } from "@/lib/billing/types";
import { createAdminClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/*  GET /api/v1/admin/billing/plans                                    */
/*  List all plans (optionally filter by is_active).                   */
/*  Queries the canonical plans table.                                 */
/* ------------------------------------------------------------------ */

export const GET = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true,
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const url = new URL(ctx.req.url);
    const statusParam = url.searchParams.get("status"); // "active" | "archived" | null

    try {
      let plans = await getAllPlansWithPrices();

      if (statusParam === "active") {
        plans = plans.filter((p) => p.is_active);
      } else if (statusParam === "archived") {
        plans = plans.filter((p) => !p.is_active);
      }

      return ok({ plans }, ctx.requestId);
    } catch (error) {
      console.error("[admin/billing/plans] GET error:", error);
      return ok({ plans: [] }, ctx.requestId);
    }
  },
});

/* ------------------------------------------------------------------ */
/*  POST /api/v1/admin/billing/plans                                   */
/*  Create a new plan with initial prices.                             */
/* ------------------------------------------------------------------ */

export const POST = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true,
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const body = await ctx.req.json();
    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const d = parsed.data;

    // Check plan_key uniqueness in canonical plans table
    const supabase = await createAdminClient();
    const { data: existing } = await supabase
      .from("plans")
      .select("id")
      .eq("plan_key", d.plan_key)
      .maybeSingle();

    if (existing) {
      return badRequest(
        ctx.requestId,
        `A plan with plan_key "${d.plan_key}" already exists.`,
      );
    }

    const plan = await createPlanWithPrices(
      {
        plan_key: d.plan_key,
        name: d.name,
        description: d.description || null,
        is_active: d.is_active,
        sort_order: d.sort_order,
        entitlements: d.entitlements,
        quota_policy: d.quota_policy,
        features: d.features,
      },
      d.prices.map((p) => ({
        currency: p.currency,
        interval: p.interval,
        amount_minor: p.unitAmount,
      })),
    );

    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId: ctx.membership?.tenantId ?? "system",
      tableName: "plans",
      recordId: plan.id,
      action: "plan_created",
      before: null,
      after: plan,
    });

    return created({ plan }, ctx.requestId);
  },
});
