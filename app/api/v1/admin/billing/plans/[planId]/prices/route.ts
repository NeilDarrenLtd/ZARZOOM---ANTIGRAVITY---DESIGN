import { createApiHandler } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/http-responses";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/admin/audit";
import { versionPrice, deactivatePrice, getPlanById } from "@/lib/billing/queries";
import { planPriceSchema } from "@/lib/billing/types";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";

/** Extract planId from the request URL pathname */
function extractPlanId(req: Request): string {
  const parts = new URL(req.url).pathname.split("/");
  // /api/v1/admin/billing/plans/[planId]/prices  → planId is second-to-last
  return parts[parts.length - 2];
}

/** Fetch a canonical plan (with prices) by id */
async function fetchPlan(planId: string) {
  return getPlanById(planId);
}

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
  tenantOptional: true,
  rateLimit: { maxRequests: 20, windowMs: 60_000 },
  handler: async (ctx) => {
    const planId = extractPlanId(ctx.req);

    const plan = await fetchPlan(planId);
    if (!plan) throw new NotFoundError("Plan");

    const body = await ctx.req.json();
    const parsed = addPriceSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    // Find the old active price for before snapshot
    const oldPrice = (plan.prices ?? []).find(
      (p: any) =>
        p.currency === parsed.data.currency &&
        p.interval === parsed.data.interval &&
        p.is_active
    );

    const newPrice = await versionPrice(planId, {
      currency: parsed.data.currency,
      interval: parsed.data.interval,
      amount_minor: parsed.data.unitAmount,
      billing_provider_price_id: parsed.data.billingProviderPriceId ?? null,
      created_by: ctx.user!.id,
    });

    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId: ctx.membership?.tenantId ?? "system",
      tableName: "plan_prices",
      recordId: newPrice.id as string,
      action: "price_version_created",
      changes: {
        plan_id: planId,
        before: oldPrice
          ? {
              id: oldPrice.id,
              amount_minor: oldPrice.amount_minor,
              currency: oldPrice.currency,
              interval: oldPrice.interval,
            }
          : null,
        after: {
          id: newPrice.id as string,
          amount_minor: newPrice.amount_minor as number,
          currency: newPrice.currency as string,
          interval: newPrice.interval as string,
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
  tenantOptional: true,
  rateLimit: { maxRequests: 20, windowMs: 60_000 },
  handler: async (ctx) => {
    const planId = extractPlanId(ctx.req);

    const plan = await fetchPlan(planId);
    if (!plan) throw new NotFoundError("Plan");

    const body = await ctx.req.json();
    const parsed = deactivateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const target = (plan.prices ?? []).find((p: any) => p.id === parsed.data.priceId);
    if (!target) throw new NotFoundError("Price");

    await deactivatePrice(parsed.data.priceId);

    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId: ctx.membership?.tenantId ?? "system",
      tableName: "plan_prices",
      recordId: parsed.data.priceId,
      action: "price_deactivated",
      changes: {
        plan_id: planId,
        before: {
          is_active: true,
          amount_minor: target.amount_minor,
          currency: target.currency,
          interval: target.interval,
        },
        after: { is_active: false },
      },
    });

    return ok({ message: "Price deactivated", priceId: parsed.data.priceId }, ctx.requestId);
  },
});
