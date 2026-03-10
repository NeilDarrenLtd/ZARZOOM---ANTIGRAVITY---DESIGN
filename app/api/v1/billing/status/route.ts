import { createApiHandler } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/v1/billing/status
 *
 * Returns the current subscription status and basic billing details
 * for the active workspace.
 */
export const GET = createApiHandler({
  requiredRole: "member",
  requireExplicitTenant: true,
  handler: async (ctx) => {
    const tenantId = ctx.membership!.tenantId;
    const supabase = await createAdminClient();

    const { data: sub } = await supabase
      .from("tenant_subscriptions")
      .select(`
        status,
        plan_id,
        price_id,
        current_period_end,
        cancel_at_period_end,
        plan:plans (name, plan_key)
      `)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      return NextResponse.json(
        {
          status: "none",
          planName: null,
          planKey: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          currency: null,
          billingInterval: null,
          amountMinor: null,
        },
        { status: 200, headers: { "X-Request-Id": ctx.requestId } }
      );
    }

    const plan = sub.plan as unknown as { name?: string; plan_key?: string } | null;

    let currency: string | null = null;
    let billingInterval: "month" | "year" | null = null;
    let amountMinor: number | null = null;

    if (sub.price_id) {
      const { data: priceRow } = await supabase
        .from("plan_prices")
        .select("currency, interval, amount_minor")
        .eq("id", sub.price_id)
        .maybeSingle();

      if (priceRow) {
        currency = priceRow.currency ?? null;
        amountMinor = typeof priceRow.amount_minor === "number" ? priceRow.amount_minor : null;
        if (priceRow.interval === "annual") {
          billingInterval = "year";
        } else if (priceRow.interval === "monthly") {
          billingInterval = "month";
        }
      }
    }

    return NextResponse.json(
      {
        status: sub.status ?? "none",
        planName: plan?.name ?? null,
        planKey: plan?.plan_key ?? null,
        currentPeriodEnd: sub.current_period_end ?? null,
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        currency,
        billingInterval,
        amountMinor,
      },
      { status: 200, headers: { "X-Request-Id": ctx.requestId } }
    );
  },
});
