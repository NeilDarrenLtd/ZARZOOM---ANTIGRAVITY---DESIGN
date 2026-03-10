import { createApiHandler } from "@/lib/api/handler";
import { ok, badRequest } from "@/lib/api/http-responses";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/admin/audit";
import { updatePlanSchema } from "@/lib/billing/types";
import {
  getPlanById,
  updatePlanData,
  togglePlanStatus,
} from "@/lib/billing/queries";

/** Extract planId from the request URL pathname */
function extractPlanId(req: Request): string {
  const parts = new URL(req.url).pathname.split("/");
  // pathname: /api/v1/admin/billing/plans/[planId]
  return parts[parts.length - 1];
}

/* ------------------------------------------------------------------ */
/*  GET /api/v1/admin/billing/plans/[planId]                           */
/* ------------------------------------------------------------------ */

export const GET = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true,
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const planId = extractPlanId(ctx.req);
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
  tenantOptional: true,
  rateLimit: { maxRequests: 20, windowMs: 60_000 },
  handler: async (ctx) => {
    const planId = extractPlanId(ctx.req);

    const existing = await getPlanById(planId);
    if (!existing) throw new NotFoundError("Plan");

    const body = await ctx.req.json();
    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const before = existing;

    await updatePlanData(planId, {
      name: parsed.data.name,
      description: parsed.data.description,
      is_active: parsed.data.is_active,
      sort_order: parsed.data.sort_order,
      entitlements: parsed.data.entitlements,
      quota_policy: parsed.data.quota_policy,
      features: parsed.data.features,
    });

    const updated = await getPlanById(planId);
    if (!updated) throw new Error("Failed to update plan");

    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId: ctx.membership?.tenantId ?? "system",
      tableName: "plans",
      recordId: planId,
      action: "plan_updated",
      before,
      after: updated,
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
  tenantOptional: true,
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const planId = extractPlanId(ctx.req);

    const existing = await getPlanById(planId);
    if (!existing) throw new NotFoundError("Plan");

    await togglePlanStatus(planId, false);

    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId: ctx.membership?.tenantId ?? "system",
      tableName: "plans",
      recordId: planId,
      action: "plan_archived",
      before: existing,
      after: { ...existing, is_active: false },
    });

    return ok({ message: "Plan archived", id: planId }, ctx.requestId);
  },
});
