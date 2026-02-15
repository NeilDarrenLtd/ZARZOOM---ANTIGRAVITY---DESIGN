import { createApiHandler } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/http-responses";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/admin/audit";
import { getPlanById, versionPrice, deactivatePrice } from "@/lib/billing/queries";
import { planPriceSchema } from "@/lib/billing/types";
import { z } from "zod";

type RouteParams = { params: Promise<{ planId: string }> };

/* ------------------------------------------------------------------ */
/*  POST /api/v1/admin/billing/plans/[planId]/prices                   */
/*  Add a new price version. Old active price for the same             */
/*  (currency, interval) is deactivated with effective_to set.         */
/* ------------------------------------------------------------------ */

const addPriceSchema = planPriceSchema.extend({
  billingProviderPriceId: z.string().optional(),
});

export const POST = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 20, windowMs: 60_000 },
  handler: async (ctx) => {
    const { planId } = await (ctx.req as unknown as RouteParams).params;

    const plan = await getPlanById(planId);
    if (!plan) throw new NotFoundError("Plan");

    const body = await ctx.req.json();
    const parsed = addPriceSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    // Find the old active price for before snapshot
    const oldPrice = plan.plan_prices.find(
      (p) =>
        p.currency === parsed.data.currency &&
        p.interval === parsed.data.interval &&
        p.is_active
    );

    const newPrice = await versionPrice(planId, {
      currency: parsed.data.currency,
      interval: parsed.data.interval,
      unit_amount: parsed.data.unitAmount,
      billing_provider_price_id: parsed.data.billingProviderPriceId ?? null,
      created_by: ctx.user!.id,
    });

    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId: ctx.membership!.tenantId,
      tableName: "plan_prices",
      recordId: newPrice.id,
      action: "price_version_created",
      changes: {
        plan_id: planId,
        before: oldPrice
          ? {
              id: oldPrice.id,
              unit_amount: oldPrice.unit_amount,
              currency: oldPrice.currency,
              interval: oldPrice.interval,
            }
          : null,
        after: {
          id: newPrice.id,
          unit_amount: newPrice.unit_amount,
          currency: newPrice.currency,
          interval: newPrice.interval,
        },
      },
    });

    return created({ price: newPrice }, ctx.requestId);
  },
});

/* ------------------------------------------------------------------ */
/*  PUT /api/v1/admin/billing/plans/[planId]/prices                    */
/*  Deactivate a specific price by ID.                                 */
/*  Body: { priceId: string }                                          */
/* ------------------------------------------------------------------ */

const deactivateSchema = z.object({
  priceId: z.string().uuid(),
});

export const PUT = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 20, windowMs: 60_000 },
  handler: async (ctx) => {
    const { planId } = await (ctx.req as unknown as RouteParams).params;

    const plan = await getPlanById(planId);
    if (!plan) throw new NotFoundError("Plan");

    const body = await ctx.req.json();
    const parsed = deactivateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const target = plan.plan_prices.find((p) => p.id === parsed.data.priceId);
    if (!target) throw new NotFoundError("Price");

    await deactivatePrice(parsed.data.priceId);

    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId: ctx.membership!.tenantId,
      tableName: "plan_prices",
      recordId: parsed.data.priceId,
      action: "price_deactivated",
      changes: {
        plan_id: planId,
        before: {
          is_active: true,
          unit_amount: target.unit_amount,
          currency: target.currency,
          interval: target.interval,
        },
        after: { is_active: false },
      },
    });

    return ok({ message: "Price deactivated", priceId: parsed.data.priceId }, ctx.requestId);
  },
});
