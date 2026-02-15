import { createApiHandler } from "@/lib/api/handler";
import { ok, created, badRequest } from "@/lib/api/http-responses";
import { ValidationError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/admin/audit";
import { getPlans, createPlan } from "@/lib/billing/queries";
import { createPlanSchema } from "@/lib/billing/types";
import { createAdminClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/*  GET /api/v1/admin/billing/plans                                    */
/*  List all plans with prices (optionally filter by is_active).       */
/* ------------------------------------------------------------------ */

export const GET = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const url = new URL(ctx.req.url);
    const statusParam = url.searchParams.get("status"); // "active" | "archived" | null

    const plans = await getPlans(
      statusParam === "active" || statusParam === "archived"
        ? { status: statusParam }
        : {}
    );

    return ok({ plans }, ctx.requestId);
  },
});

/* ------------------------------------------------------------------ */
/*  POST /api/v1/admin/billing/plans                                   */
/*  Create a new plan with initial prices.                             */
/* ------------------------------------------------------------------ */

export const POST = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const body = await ctx.req.json();
    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const d = parsed.data;

    // Check slug uniqueness
    const supabase = await createAdminClient();
    const { data: existing } = await supabase
      .from("subscription_plans")
      .select("id")
      .eq("slug", d.slug)
      .maybeSingle();

    if (existing) {
      return badRequest(ctx.requestId, `A plan with slug "${d.slug}" already exists.`);
    }

    const plan = await createPlan(
      {
        name: d.name,
        slug: d.slug,
        description: d.description || null,
        is_active: d.is_active,
        scope: null,
        tenant_id: null,
        display_order: d.display_order,
        highlight: d.highlight,
        quota_policy: d.quota_policy,
        features: d.features,
        entitlements: d.entitlements,
      },
      d.prices.map((p) => ({
        currency: p.currency,
        interval: p.interval,
        unit_amount: p.unitAmount,
      }))
    );

    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId: ctx.membership!.tenantId,
      tableName: "subscription_plans",
      recordId: plan.id,
      action: "plan_created",
      changes: {
        after: {
          name: plan.name,
          slug: plan.slug,
          is_active: plan.is_active,
          quota_policy: plan.quota_policy,
          features: plan.features,
          prices: plan.plan_prices.map((p) => ({
            currency: p.currency,
            interval: p.interval,
            unit_amount: p.unit_amount,
          })),
        },
      },
    });

    return created({ plan }, ctx.requestId);
  },
});
