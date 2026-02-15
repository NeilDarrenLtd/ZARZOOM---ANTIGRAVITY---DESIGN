import { z } from "zod";
import Stripe from "stripe";
import {
  createApiHandler,
  badRequest,
  serverError,
  env,
} from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/* ------------------------------------------------------------------ */
/*  Request schema                                                     */
/* ------------------------------------------------------------------ */

const checkoutSchema = z.object({
  /**
   * Plan code (slug) to subscribe to. The caller passes a human-friendly
   * code like "basic", "pro", or "advanced" and we resolve the plan from
   * the database.
   */
  plan_code: z.string().min(1, "plan_code is required"),
  /** Billing currency. */
  currency: z.enum(["GBP", "USD", "EUR"]),
  /** Billing interval. */
  interval: z.enum(["month", "year"]),
});

/**
 * POST /api/v1/billing/checkout
 *
 * Creates a Stripe Checkout Session for the selected plan + currency +
 * interval combination.
 *
 * Request body:
 *   { plan_code: string, currency: "GBP"|"USD"|"EUR", interval: "month"|"year" }
 *
 * Response (200):
 *   { url: string }        -- Stripe Checkout redirect URL
 *
 * Error responses:
 *   400 -- invalid body, plan not found, price not found, or price has no Stripe ID
 *   500 -- Stripe API failure
 *
 * Flow:
 *   1. Validate body against checkoutSchema
 *   2. Resolve plan by slug (must be active)
 *   3. Resolve active plan_price row matching currency + interval via the
 *      active_plan_prices view (effective_from <= now, effective_to null or > now)
 *   4. Ensure stripe_product_id exists on the plan
 *   5. Ensure billing_provider_price_id exists on the price
 *   6. Look up or create Stripe customer for the tenant
 *   7. Create Stripe Checkout Session in "subscription" mode
 *   8. Upsert an "incomplete" subscription row
 *   9. Return { url } for client redirect
 */
export const POST = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const { STRIPE_SECRET_KEY, SITE_URL } = env();

    if (!STRIPE_SECRET_KEY) {
      return serverError(ctx.requestId, "Billing provider not configured");
    }

    // 1. Validate body
    const body = await ctx.req.json().catch(() => null);
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(
        ctx.requestId,
        "Invalid checkout request",
        parsed.error.flatten().fieldErrors
      );
    }

    const { plan_code, currency, interval } = parsed.data;
    const tenantId = ctx.membership!.tenantId;
    const userId = ctx.user!.id;
    const userEmail = ctx.user!.email;

    const supabase = await createAdminClient();

    // 2. Resolve the plan by slug (must be active)
    const { data: plan, error: planErr } = await supabase
      .from("subscription_plans")
      .select("id, name, slug, stripe_product_id, is_active")
      .eq("slug", plan_code)
      .eq("is_active", true)
      .single();

    if (planErr || !plan) {
      return badRequest(
        ctx.requestId,
        `Plan "${plan_code}" not found or inactive`
      );
    }

    // 3. Resolve the active price via the active_plan_prices view
    //    This view already filters: is_active = true, effective_from <= now(),
    //    (effective_to IS NULL OR effective_to > now()), and sp.is_active = true
    const intervalDb = interval === "year" ? "annual" : "monthly";

    const { data: priceRow, error: priceErr } = await supabase
      .from("active_plan_prices")
      .select("price_id, plan_id, unit_amount, billing_provider_price_id")
      .eq("plan_id", plan.id)
      .eq("currency", currency)
      .eq("interval", intervalDb)
      .limit(1)
      .single();

    if (priceErr || !priceRow) {
      return badRequest(
        ctx.requestId,
        `No active price found for plan "${plan_code}" in ${currency}/${interval}`
      );
    }

    // 4. Ensure stripe_product_id exists on the plan
    if (!plan.stripe_product_id) {
      return badRequest(
        ctx.requestId,
        "This plan is not yet connected to the billing provider. Please ask an admin to sync products."
      );
    }

    // 5. Ensure billing_provider_price_id exists on the price
    const stripePriceId = priceRow.billing_provider_price_id;
    if (!stripePriceId) {
      return badRequest(
        ctx.requestId,
        "This price is not yet connected to the billing provider. Please ask an admin to sync prices."
      );
    }

    // 6. Resolve or create Stripe customer
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover",
    });

    // Check if tenant already has a billing_provider_customer_id
    const { data: existingSub } = await supabase
      .from("tenant_subscriptions")
      .select("billing_provider_customer_id")
      .eq("tenant_id", tenantId)
      .not("billing_provider_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let stripeCustomerId = existingSub?.billing_provider_customer_id ?? null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail ?? undefined,
        metadata: {
          tenant_id: tenantId,
          user_id: userId,
        },
      });
      stripeCustomerId = customer.id;
    }

    // 7. Create Checkout Session
    const baseUrl = SITE_URL;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: tenantId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/pricing?checkout=canceled`,
      subscription_data: {
        metadata: {
          tenant_id: tenantId,
          user_id: userId,
          plan_id: plan.id,
          price_id: priceRow.price_id,
        },
      },
      metadata: {
        tenant_id: tenantId,
        price_id: priceRow.price_id,
      },
    });

    // 8. Upsert a pending subscription row so the webhook has something to match
    const { error: upsertErr } = await supabase
      .from("tenant_subscriptions")
      .upsert(
        {
          tenant_id: tenantId,
          user_id: userId,
          plan_id: plan.id,
          price_id: priceRow.price_id,
          status: "incomplete",
          billing_provider: "stripe",
          billing_provider_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );

    if (upsertErr) {
      console.error("[Checkout] Failed to upsert subscription row:", upsertErr);
    }

    // 9. Return redirect URL
    return NextResponse.json(
      { url: session.url },
      {
        status: 200,
        headers: { "X-Request-Id": ctx.requestId },
      }
    );
  },
});
