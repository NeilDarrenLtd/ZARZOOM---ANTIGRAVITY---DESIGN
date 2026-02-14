import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/v1/billing/webhook
 *
 * Stripe webhook handler. Processes subscription lifecycle events and
 * updates the tenant_subscriptions table accordingly.
 *
 * Note: Stripe signature verification requires the `stripe` package
 * and the STRIPE_WEBHOOK_SECRET env var. When Stripe is not yet
 * connected, this handler logs the event and returns 200 so the
 * endpoint is wired up and ready.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  // If Stripe is configured, verify the webhook signature
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: {
    type: string;
    data: { object: Record<string, unknown> };
  };

  if (webhookSecret && sig) {
    try {
      // Dynamic import so the app doesn't break if stripe isn't installed yet
      const stripe = (await import("stripe")).default;
      const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2026-01-28.clover",
      });
      event = stripeClient.webhooks.constructEvent(
        body,
        sig,
        webhookSecret
      ) as unknown as typeof event;
    } catch (err) {
      console.error("[Stripe Webhook] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }
  } else {
    // No Stripe configured yet -- parse raw JSON for development
    try {
      event = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    console.warn(
      "[Stripe Webhook] No STRIPE_WEBHOOK_SECRET set. Skipping signature verification."
    );
  }

  const supabase = await createAdminClient();

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const stripeSubId = sub.id as string;
        const stripeCustomerId = sub.customer as string;
        const status = sub.status as string;
        const cancelAtPeriodEnd = sub.cancel_at_period_end as boolean;
        const currentPeriodStart = sub.current_period_start
          ? new Date((sub.current_period_start as number) * 1000).toISOString()
          : null;
        const currentPeriodEnd = sub.current_period_end
          ? new Date((sub.current_period_end as number) * 1000).toISOString()
          : null;

        // Find the tenant by stripe_customer_id
        const { data: existing } = await supabase
          .from("tenant_subscriptions")
          .select("id, tenant_id")
          .eq("stripe_subscription_id", stripeSubId)
          .single();

        if (existing) {
          // Update existing subscription
          await supabase
            .from("tenant_subscriptions")
            .update({
              status,
              cancel_at_period_end: cancelAtPeriodEnd,
              current_period_start: currentPeriodStart,
              current_period_end: currentPeriodEnd,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          // Look up tenant by stripe_customer_id in metadata
          const { data: tenantSub } = await supabase
            .from("tenant_subscriptions")
            .select("id, tenant_id")
            .eq("stripe_customer_id", stripeCustomerId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (tenantSub) {
            await supabase
              .from("tenant_subscriptions")
              .update({
                stripe_subscription_id: stripeSubId,
                status,
                cancel_at_period_end: cancelAtPeriodEnd,
                current_period_start: currentPeriodStart,
                current_period_end: currentPeriodEnd,
                updated_at: new Date().toISOString(),
              })
              .eq("id", tenantSub.id);
          } else {
            console.warn(
              `[Stripe Webhook] No tenant found for customer ${stripeCustomerId}`
            );
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const stripeSubId = sub.id as string;

        await supabase
          .from("tenant_subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", stripeSubId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription as string;

        if (stripeSubId) {
          await supabase
            .from("tenant_subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", stripeSubId);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("[Stripe Webhook] Error processing event:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
