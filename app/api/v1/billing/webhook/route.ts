import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { invalidateEntitlements } from "@/lib/billing/entitlements";
import crypto from "node:crypto";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Convert Stripe epoch seconds to ISO string. */
function epochToISO(epoch: unknown): string | null {
  if (typeof epoch !== "number" || epoch === 0) return null;
  return new Date(epoch * 1000).toISOString();
}

/** SHA-256 hash of the raw webhook body for deduplication. */
function hashPayload(body: string): string {
  return crypto.createHash("sha256").update(body).digest("hex");
}

/* ------------------------------------------------------------------ */
/*  POST /api/v1/billing/webhook                                       */
/*                                                                     */
/*  Stripe webhook handler. Verifies signature, deduplicates events,   */
/*  updates tenant_subscriptions with correct column names, and        */
/*  invalidates the entitlements cache so quota middleware picks up     */
/*  changes immediately.                                               */
/*                                                                     */
/*  Handled events:                                                    */
/*    customer.subscription.created                                    */
/*    customer.subscription.updated                                    */
/*    customer.subscription.deleted                                    */
/*    invoice.payment_failed                                           */
/*                                                                     */
/*  Replay prevention:                                                 */
/*    Each event body is SHA-256 hashed and stored in                  */
/*    social_webhook_events. Duplicate hashes return 200 immediately.  */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  /* -- Signature verification ------------------------------------- */
  let event: Stripe.Event;

  if (webhookSecret && sig) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2026-01-28.clover",
      });
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("[Billing Webhook] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }
  } else {
    // Development fallback -- no Stripe configured yet
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    console.warn(
      "[Billing Webhook] No STRIPE_WEBHOOK_SECRET set. Skipping signature verification."
    );
  }

  const supabase = await createAdminClient();

  /* -- Replay / deduplication ------------------------------------- */
  const payloadHash = hashPayload(body);

  const { data: existing } = await supabase
    .from("social_webhook_events")
    .select("id")
    .eq("payload_hash", payloadHash)
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Already processed -- return 200 to acknowledge
    return NextResponse.json({ received: true, deduplicated: true });
  }

  // Record event for deduplication
  await supabase.from("social_webhook_events").insert({
    event_type: event.type,
    payload_hash: payloadHash,
    payload: event.data.object as Record<string, unknown>,
    processed: false,
  });

  /* -- Event processing ------------------------------------------- */
  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeSubId = sub.id;
        const stripeCustomerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const status = sub.status;
        const cancelAtPeriodEnd = sub.cancel_at_period_end;
        const currentPeriodStart = epochToISO(sub.current_period_start);
        const currentPeriodEnd = epochToISO(sub.current_period_end);

        // Extract plan/price metadata set during checkout
        const metadata = sub.metadata ?? {};
        const planIdFromMeta = metadata.plan_id ?? null;
        const priceIdFromMeta = metadata.price_id ?? null;

        // Try to find by billing_provider_subscription_id first
        const { data: existingRow } = await supabase
          .from("tenant_subscriptions")
          .select("id, tenant_id")
          .eq("billing_provider_subscription_id", stripeSubId)
          .maybeSingle();

        if (existingRow) {
          await supabase
            .from("tenant_subscriptions")
            .update({
              status,
              cancel_at_period_end: cancelAtPeriodEnd,
              current_period_start: currentPeriodStart,
              current_period_end: currentPeriodEnd,
              ...(planIdFromMeta ? { plan_id: planIdFromMeta } : {}),
              ...(priceIdFromMeta ? { price_id: priceIdFromMeta } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingRow.id);

          // Invalidate cached entitlements
          invalidateEntitlements(existingRow.tenant_id);
        } else {
          // Fallback: match by billing_provider_customer_id
          const { data: tenantRow } = await supabase
            .from("tenant_subscriptions")
            .select("id, tenant_id")
            .eq("billing_provider_customer_id", stripeCustomerId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (tenantRow) {
            await supabase
              .from("tenant_subscriptions")
              .update({
                billing_provider_subscription_id: stripeSubId,
                billing_provider: "stripe",
                status,
                cancel_at_period_end: cancelAtPeriodEnd,
                current_period_start: currentPeriodStart,
                current_period_end: currentPeriodEnd,
                ...(planIdFromMeta ? { plan_id: planIdFromMeta } : {}),
                ...(priceIdFromMeta ? { price_id: priceIdFromMeta } : {}),
                updated_at: new Date().toISOString(),
              })
              .eq("id", tenantRow.id);

            invalidateEntitlements(tenantRow.tenant_id);
          } else {
            console.warn(
              `[Billing Webhook] No tenant found for customer ${stripeCustomerId}`
            );
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        const { data: row } = await supabase
          .from("tenant_subscriptions")
          .select("id, tenant_id")
          .eq("billing_provider_subscription_id", sub.id)
          .maybeSingle();

        if (row) {
          await supabase
            .from("tenant_subscriptions")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          invalidateEntitlements(row.tenant_id);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (stripeSubId) {
          const { data: row } = await supabase
            .from("tenant_subscriptions")
            .select("id, tenant_id")
            .eq("billing_provider_subscription_id", stripeSubId)
            .maybeSingle();

          if (row) {
            await supabase
              .from("tenant_subscriptions")
              .update({
                status: "past_due",
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);

            invalidateEntitlements(row.tenant_id);
          }
        }
        break;
      }

      default:
        console.log(
          `[Billing Webhook] Unhandled event type: ${event.type}`
        );
    }

    // Mark dedup record as processed
    await supabase
      .from("social_webhook_events")
      .update({ processed: true })
      .eq("payload_hash", payloadHash);
  } catch (err) {
    console.error("[Billing Webhook] Error processing event:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
