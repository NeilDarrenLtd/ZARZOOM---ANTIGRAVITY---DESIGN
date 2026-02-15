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
  /** The plan_prices.id to subscribe to. */
  priceId: z.string().uuid("Invalid price ID"),
  /** Where to redirect after success. */
  successUrl: z.string().url().optional(),
  /** Where to redirect if the user cancels. */
  cancelUrl: z.string().url().optional(),
});

/**
 * POST /api/v1/billing/checkout
 *
 * Creates a Stripe Checkout Session for the selected plan price.
 *
 * Request body:
 *   { priceId: uuid, successUrl?: string, cancelUrl?: string }
 *
 * Response (200):
 *   { url: string }        -- Stripe Checkout redirect URL
 *
 * Error responses:
 *   400 -- invalid body, missing price, or price has no Stripe ID
 *   500 -- Stripe API failure
 *
 * Flow:
 *   1. Validate body against checkoutSchema
 *   2. Look up plan_prices row by priceId, join subscription_plans for name
 *   3. Verify billing_provider_price_id exists on that price row
 *   4. Look up or create Stripe customer for the tenant
 *   5. Create Stripe Checkout Session in "subscription" mode
 *   6. Return { url } for client redirect
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

    const { priceId, successUrl, cancelUrl } = parsed.data;
    const tenantId = ctx.membership!.tenantId;
    const userId = ctx.user!.id;
    const userEmail = ctx.user!.email;

    // 2. Look up the plan price + parent plan
    const supabase = await createAdminClient();

    const { data: priceRow, error: priceErr } = await supabase
      .from("plan_prices")
      .select(
        `
        id,
        plan_id,
        currency,
        interval,
        unit_amount,
        billing_provider_price_id,
        is_active,
        plan:subscription_plans ( id, name, slug )
      `
      )
      .eq("id", priceId)
      .eq("is_active", true)
      .single();

    if (priceErr || !priceRow) {
      return badRequest(ctx.requestId, "Price not found or inactive");
    }

    // 3. Verify Stripe price ID exists
    const stripePriceId = priceRow.billing_provider_price_id;
    if (!stripePriceId) {
      return badRequest(
        ctx.requestId,
        "This price is not yet connected to the billing provider. Please contact support."
      );
    }

    // 4. Resolve or create Stripe customer
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
      // Create a new Stripe customer
      const plan = priceRow.plan as unknown as { name: string; slug: string };
      const customer = await stripe.customers.create({
        email: userEmail ?? undefined,
        metadata: {
          tenant_id: tenantId,
          user_id: userId,
        },
      });
      stripeCustomerId = customer.id;
    }

    // 5. Create Checkout Session
    const baseUrl = successUrl
      ? new URL(successUrl).origin
      : SITE_URL;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: tenantId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url:
        successUrl ?? `${baseUrl}/dashboard?checkout=success`,
      cancel_url: cancelUrl ?? `${baseUrl}/pricing?checkout=canceled`,
      subscription_data: {
        metadata: {
          tenant_id: tenantId,
          user_id: userId,
          plan_id: priceRow.plan_id,
          price_id: priceRow.id,
        },
      },
      metadata: {
        tenant_id: tenantId,
        price_id: priceRow.id,
      },
    });

    // 6. Upsert a pending subscription row so the webhook has something to match
    const { error: upsertErr } = await supabase
      .from("tenant_subscriptions")
      .upsert(
        {
          tenant_id: tenantId,
          user_id: userId,
          plan_id: priceRow.plan_id,
          price_id: priceRow.id,
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

    return NextResponse.json(
      { url: session.url },
      {
        status: 200,
        headers: { "X-Request-Id": ctx.requestId },
      }
    );
  },
});
