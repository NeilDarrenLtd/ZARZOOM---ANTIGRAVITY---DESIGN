import Stripe from "stripe";
import {
  createApiHandler,
  badRequest,
  notFound,
  serverError,
  env,
} from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/v1/billing/portal
 *
 * Creates a Stripe Customer Portal session so the tenant can manage
 * their subscription (upgrade, downgrade, cancel, update payment method).
 *
 * Request body (optional):
 *   { returnUrl?: string }
 *
 * Response (200):
 *   { url: string }        -- Stripe Portal redirect URL
 *
 * Error responses:
 *   400 -- Stripe not configured
 *   404 -- no active subscription / no Stripe customer found
 *   500 -- Stripe API failure
 */
export const POST = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const { STRIPE_SECRET_KEY, SITE_URL } = env();

    if (!STRIPE_SECRET_KEY) {
      return serverError(ctx.requestId, "Billing provider not configured");
    }

    const tenantId = ctx.membership!.tenantId;

    // Parse optional return URL
    let returnUrl = SITE_URL + "/dashboard";
    try {
      const body = await ctx.req.json();
      if (body?.returnUrl && typeof body.returnUrl === "string") {
        returnUrl = body.returnUrl;
      }
    } catch {
      // No body or invalid JSON -- use default returnUrl
    }

    // Look up the tenant's Stripe customer ID
    const supabase = await createAdminClient();
    const { data: sub } = await supabase
      .from("tenant_subscriptions")
      .select("billing_provider_customer_id")
      .eq("tenant_id", tenantId)
      .not("billing_provider_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.billing_provider_customer_id) {
      return notFound(
        ctx.requestId,
        "No billing account found. Please subscribe to a plan first."
      );
    }

    // Create Stripe Portal session
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-04-30.basil",
    });

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.billing_provider_customer_id,
      return_url: returnUrl,
    });

    return NextResponse.json(
      { url: session.url },
      {
        status: 200,
        headers: { "X-Request-Id": ctx.requestId },
      }
    );
  },
});
