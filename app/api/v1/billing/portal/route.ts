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
 *   { returnUrl?: string, flow?: "subscription_cancel" }
 *
 * When `flow` is "subscription_cancel", the session deep-links directly
 * into the cancellation flow for the workspace's subscription and
 * redirects back to `returnUrl` on completion.
 *
 * Response (200):
 *   { url: string }        -- Stripe Portal redirect URL
 *
 * Error responses:
 *   400 -- Stripe not configured / missing subscription for cancel flow
 *   404 -- no active subscription / no Stripe customer found
 *   500 -- Stripe API failure
 */
export const POST = createApiHandler({
  requiredRole: "member",
  requireExplicitTenant: true,
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const { STRIPE_SECRET_KEY, SITE_URL } = env();

    if (!STRIPE_SECRET_KEY) {
      return serverError(ctx.requestId, "Billing provider not configured");
    }

    const tenantId = ctx.membership!.tenantId;

    let returnUrl = SITE_URL + "/dashboard/billing";
    let flow: string | undefined;

    try {
      const body = await ctx.req.json();
      if (body?.returnUrl && typeof body.returnUrl === "string") {
        returnUrl = body.returnUrl;
      }
      if (body?.flow && typeof body.flow === "string") {
        flow = body.flow;
      }
    } catch {
      // No body or invalid JSON -- use defaults
    }

    const supabase = await createAdminClient();

    const { data: sub } = await supabase
      .from("tenant_subscriptions")
      .select("billing_provider_customer_id, billing_provider_subscription_id")
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

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover",
    });

    let sessionParams: Stripe.BillingPortal.SessionCreateParams = {
      customer: sub.billing_provider_customer_id,
      return_url: returnUrl,
    };

    if (flow === "subscription_cancel") {
      const subId = sub.billing_provider_subscription_id;

      if (!subId) {
        return badRequest(
          ctx.requestId,
          "No active subscription found for this workspace."
        );
      }

      sessionParams = {
        ...sessionParams,
        flow_data: {
          type: "subscription_cancel",
          subscription_cancel: { subscription: subId },
          after_completion: {
            type: "redirect",
            redirect: { return_url: returnUrl },
          },
        },
      };
    }

    const session = await stripe.billingPortal.sessions.create(sessionParams);

    return NextResponse.json(
      { url: session.url },
      {
        status: 200,
        headers: { "X-Request-Id": ctx.requestId },
      }
    );
  },
});
