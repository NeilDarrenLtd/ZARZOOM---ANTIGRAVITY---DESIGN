import { z } from "zod";
import Stripe from "stripe";
import {
  createApiHandler,
  badRequest,
  serverError,
  notFound,
  env,
} from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const changePlanSchema = z.object({
  plan_code: z.string().min(1),
  currency: z.enum(["GBP", "USD", "EUR"]),
  interval: z.enum(["month", "year"]),
});

/**
 * POST /api/v1/billing/change-plan
 *
 * Changes the current subscription to a different plan.
 * - Upgrades: immediate with prorated charge
 * - Downgrades: immediate price change, no proration (user keeps current tier value until next invoice)
 */
export const POST = createApiHandler({
  requiredRole: "member",
  requireExplicitTenant: true,
  rateLimit: { maxRequests: 5, windowMs: 60_000 },
  handler: async (ctx) => {
    const { STRIPE_SECRET_KEY, SITE_URL } = env();

    if (!STRIPE_SECRET_KEY) {
      return serverError(ctx.requestId, "Billing provider not configured");
    }

    const body = await ctx.req.json().catch(() => null);
    const parsed = changePlanSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(ctx.requestId, "Invalid request", parsed.error.flatten().fieldErrors);
    }

    const { plan_code, currency, interval } = parsed.data;
    const tenantId = ctx.membership!.tenantId;
    const supabase = await createAdminClient();

    // 1. Get current subscription with Stripe subscription ID
    // 1. Resolve target plan (regardless of current subscription state)
    const { data: newPlan } = await supabase
      .from("plans")
      .select("id, plan_key, name, sort_order, is_active")
      .eq("plan_key", plan_code)
      .eq("is_active", true)
      .single();

    if (!newPlan) {
      return badRequest(ctx.requestId, `Plan "${plan_code}" not found or inactive`);
    }

    // 2. Resolve target price
    const intervalDb = interval === "year" ? "annual" : "monthly";
    const now = new Date().toISOString();

    const { data: newPrice } = await supabase
      .from("plan_prices")
      .select("id, billing_provider_price_id")
      .eq("plan_id", newPlan.id)
      .eq("currency", currency)
      .eq("interval", intervalDb)
      .eq("is_active", true)
      .lte("effective_from", now)
      .or(`effective_to.is.null,effective_to.gt.${now}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!newPrice?.billing_provider_price_id) {
      return badRequest(ctx.requestId, `No price found for ${plan_code} in ${currency}/${interval}`);
    }

    // 3. Check for an existing active subscription; if none, fallback to checkout
    const { data: currentSub } = await supabase
      .from("tenant_subscriptions")
      .select("id, plan_id, billing_provider_subscription_id, status")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // If there's no active Stripe subscription, create a checkout session instead of erroring
    if (!currentSub?.billing_provider_subscription_id) {
      const stripe = new Stripe(STRIPE_SECRET_KEY, {
        apiVersion: "2026-01-28.clover",
      });

      // Try to reuse an existing customer for this tenant if it exists
      const { data: existingCustomerSub } = await supabase
        .from("tenant_subscriptions")
        .select("billing_provider_customer_id")
        .eq("tenant_id", tenantId)
        .not("billing_provider_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let stripeCustomerId = existingCustomerSub?.billing_provider_customer_id ?? null;

      if (!stripeCustomerId) {
        const userId = ctx.user!.id;
        const userEmail = ctx.user!.email;
        const customer = await stripe.customers.create({
          email: userEmail ?? undefined,
          metadata: {
            tenant_id: tenantId,
            user_id: userId,
          },
        });
        stripeCustomerId = customer.id;
      }

      const baseUrl = SITE_URL;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: stripeCustomerId,
        client_reference_id: tenantId,
        line_items: [{ price: newPrice.billing_provider_price_id, quantity: 1 }],
        success_url: `${baseUrl}/dashboard?checkout=success`,
        cancel_url: `${baseUrl}/dashboard/profile`,
        subscription_data: {
          metadata: {
            tenant_id: tenantId,
            plan_id: newPlan.id,
            price_id: newPrice.id,
          },
        },
        metadata: {
          tenant_id: tenantId,
          plan_id: newPlan.id,
          price_id: newPrice.id,
        },
      });

      // Upsert a pending subscription row so the webhook can attach details
      const { error: upsertErr } = await supabase
        .from("tenant_subscriptions")
        .upsert(
          {
            tenant_id: tenantId,
            user_id: ctx.user!.id,
            plan_id: newPlan.id,
            price_id: newPrice.id,
            status: "incomplete",
            billing_provider: "stripe",
            billing_provider_customer_id: stripeCustomerId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id" }
        );

      if (upsertErr) {
        console.error("[change-plan] Failed to upsert subscription row:", upsertErr);
      }

      return NextResponse.json(
        { url: session.url },
        { status: 200, headers: { "X-Request-Id": ctx.requestId } }
      );
    }

    // 4. Get current plan sort_order to determine upgrade vs downgrade
    let currentSortOrder = 0;
    if (currentSub.plan_id) {
      const { data: currentPlan } = await supabase
        .from("plans")
        .select("sort_order")
        .eq("id", currentSub.plan_id)
        .single();
      currentSortOrder = currentPlan?.sort_order ?? 0;
    }

    const isUpgrade = newPlan.sort_order > currentSortOrder;

    // 5. Update the Stripe subscription
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover",
    });

    const stripeSubscription = await stripe.subscriptions.retrieve(
      currentSub.billing_provider_subscription_id
    );

    const existingItem = stripeSubscription.items.data[0];
    if (!existingItem) {
      return serverError(ctx.requestId, "Subscription has no items");
    }

    await stripe.subscriptions.update(currentSub.billing_provider_subscription_id, {
      items: [{
        id: existingItem.id,
        price: newPrice.billing_provider_price_id,
      }],
      proration_behavior: isUpgrade ? "create_prorations" : "none",
      metadata: {
        ...stripeSubscription.metadata,
        plan_id: newPlan.id,
        price_id: newPrice.id,
      },
    });

    // 6. Optimistically update our DB (webhook will also fire and confirm)
    await supabase
      .from("tenant_subscriptions")
      .update({
        plan_id: newPlan.id,
        price_id: newPrice.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentSub.id);

    return NextResponse.json(
      {
        success: true,
        change: isUpgrade ? "upgrade" : "downgrade",
        newPlan: newPlan.name,
      },
      { status: 200, headers: { "X-Request-Id": ctx.requestId } }
    );
  },
});
