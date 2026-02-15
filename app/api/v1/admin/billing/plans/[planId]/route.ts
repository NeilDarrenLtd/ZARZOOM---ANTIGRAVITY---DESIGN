import { createApiHandler } from "@/lib/api/handler";
import { ok, badRequest } from "@/lib/api/http-responses";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/admin/audit";
import { getPlanById, updatePlan, archivePlan } from "@/lib/billing/queries";
import { updatePlanSchema } from "@/lib/billing/types";

type RouteParams = { params: Promise<{ planId: string }> };

/* ------------------------------------------------------------------ */
/*  GET /api/v1/admin/billing/plans/[planId]                           */
/* ------------------------------------------------------------------ */

export const GET = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const { planId } = await (ctx.req as unknown as RouteParams).params;
    const plan = await getPlanById(planId);
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
  rateLimit: { maxRequests: 20, windowMs: 60_000 },
  handler: async (ctx) => {
    const { planId } = await (ctx.req as unknown as RouteParams).params;

    const existing = await getPlanById(planId);
    if (!existing) throw new NotFoundError("Plan");

    const body = await ctx.req.json();
    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    // Build the before snapshot for audit
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(parsed.data)) {
      const existingValue = (existing as unknown as Record<string, unknown>)[key];
      if (JSON.stringify(existingValue) !== JSON.stringify(value)) {
        before[key] = existingValue;
        after[key] = value;
      }
    }

    if (Object.keys(after).length === 0) {
      return ok({ plan: existing, message: "No changes detected" }, ctx.requestId);
    }

    const updated = await updatePlan(planId, parsed.data as Record<string, unknown>);

    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId: ctx.membership!.tenantId,
      tableName: "subscription_plans",
      recordId: planId,
      action: "plan_updated",
      changes: { before, after },
    });

    return ok({ plan: updated }, ctx.requestId);
  },
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/v1/admin/billing/plans/[planId]                        */
/*  Soft-disable (archive). Never hard-delete.                         */
/* ------------------------------------------------------------------ */

export const DELETE = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const { planId } = await (ctx.req as unknown as RouteParams).params;

    const existing = await getPlanById(planId);
    if (!existing) throw new NotFoundError("Plan");

    await archivePlan(planId);

    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId: ctx.membership!.tenantId,
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
