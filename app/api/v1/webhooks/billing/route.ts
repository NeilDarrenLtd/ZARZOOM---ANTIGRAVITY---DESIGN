import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { invalidateEntitlements } from "@/lib/billing/entitlements";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Convert Stripe epoch seconds to ISO string. */
function epochToISO(epoch: unknown): string | null {
  if (typeof epoch !== "number" || epoch === 0) return null;
  return new Date(epoch * 1000).toISOString();
}

/**
 * Extract the Stripe subscription ID from an invoice object.
 *
 * In Stripe API >= clover (2026-01-28), `invoice.subscription` was removed.
 * The subscription reference now lives under `invoice.parent`.
 */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (typeof parentSub === "string") return parentSub;
  if (parentSub && typeof parentSub === "object" && "id" in parentSub) {
    return (parentSub as { id: string }).id;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Audit helper                                                       */
/* ------------------------------------------------------------------ */

/**
 * Write an admin_audit row for subscription changes.
 * `before` is the state before our update; `after` is what we wrote.
 */
async function writeAudit(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  opts: {
    action: string;
    tenantId: string;
    entityId: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown>;
    userId?: string | null;
  }
) {
  await supabase.from("admin_audit").insert({
    action: opts.action,
    entity_type: "tenant_subscription",
    entity_id: opts.entityId,
    table_name: "tenant_subscriptions",
    tenant_id: opts.tenantId,
    user_id: opts.userId ?? null,
    before_json: opts.before ?? {},
    after_json: opts.after,
    changes: diffJson(opts.before, opts.after),
    ip: "stripe-webhook",
    user_agent: "stripe-webhook",
  });
}

/** Shallow diff two JSON objects -- returns only changed keys. */
function diffJson(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
): Record<string, { old: unknown; new: unknown }> {
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  const prev = before ?? {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(prev[key]) !== JSON.stringify(after[key])) {
      diff[key] = { old: prev[key] ?? null, new: after[key] };
    }
  }
  return diff;
}

/* ------------------------------------------------------------------ */
/*  POST /api/v1/webhooks/billing                                      */
/*                                                                     */
/*  Stripe webhook handler.                                            */
/*                                                                     */
/*  Order of operations:                                               */
/*    1. Read raw body + stripe-signature header                       */
/*    2. Verify signature with STRIPE_WEBHOOK_SECRET (fail => 400)     */
/*    3. Deduplicate by event.id in stripe_event_dedupe (dup => 200)   */
/*    4. Route event to the correct handler                            */
/*    5. Each handler:                                                 */
/*       a. Reads current row (before snapshot)                        */
/*       b. Updates tenant_subscriptions                               */
/*       c. Writes admin_audit with before / after JSON                */
/*       d. Invalidates entitlements cache                             */
/*    6. Return 200 quickly                                            */
/*                                                                     */
/*  Handled events:                                                    */
/*    checkout.session.completed                                       */
/*    customer.subscription.created                                    */
/*    customer.subscription.updated                                    */
/*    customer.subscription.deleted                                    */
/*    invoice.payment_failed                                           */
/*    invoice.paid                                                     */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  /* ---------------------------------------------------------------- */
  /*  1. Signature verification                                        */
  /* ---------------------------------------------------------------- */
  let event: Stripe.Event;

  if (webhookSecret && sig) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2026-01-28.clover",
      });
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("[Webhooks/Billing] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }
  } else {
    // Dev fallback -- parse without verification
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    console.warn(
      "[Webhooks/Billing] No STRIPE_WEBHOOK_SECRET set. Skipping signature verification."
    );
  }

  const supabase = await createAdminClient();

  /* ---------------------------------------------------------------- */
  /*  2. Deduplicate by event.id via stripe_event_dedupe               */
  /* ---------------------------------------------------------------- */
  const { data: existingEvent } = await supabase
    .from("stripe_event_dedupe")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existingEvent) {
    // Already processed -- acknowledge immediately
    return NextResponse.json({ received: true, deduplicated: true });
  }

  // Record event ID for deduplication (do this BEFORE processing so a
  // concurrent retry also gets the dedupe gate).
  const { error: dedupeInsertErr } = await supabase
    .from("stripe_event_dedupe")
    .insert({ id: event.id, received_at: new Date().toISOString() });

  if (dedupeInsertErr) {
    // If this fails with a unique-constraint error another worker already
    // claimed it -- treat as duplicate.
    if (dedupeInsertErr.code === "23505") {
      return NextResponse.json({ received: true, deduplicated: true });
    }
    console.error("[Webhooks/Billing] Dedupe insert error:", dedupeInsertErr);
  }

  /* ---------------------------------------------------------------- */
  /*  3. Event routing                                                 */
  /* ---------------------------------------------------------------- */
  try {
    switch (event.type) {
      /* ------------------------------------------------------------ */
      /*  checkout.session.completed                                   */
      /* ------------------------------------------------------------ */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        // Only metadata from Stripe is trusted
        const meta = session.metadata ?? {};
        const tenantId = meta.tenant_id ?? null;
        const userId = meta.user_id ?? null;
        const planId = meta.plan_id ?? null;
        const priceId = meta.price_id ?? null;

        if (!tenantId) {
          console.warn(
            "[Webhooks/Billing] checkout.session.completed missing tenant_id in metadata"
          );
          break;
        }

        // Determine status: check subscription object if available
        // The session itself may have subscription data
        let status: string = "active";
        if (subscriptionId) {
          try {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
              apiVersion: "2026-01-28.clover",
            });
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            status = sub.status; // "active" | "trialing" | etc.
          } catch {
            // If we can't fetch, default to active
            status = "active";
          }
        }

        // Before snapshot
        const { data: beforeRow } = await supabase
          .from("tenant_subscriptions")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const updatePayload = {
          tenant_id: tenantId,
          user_id: userId,
          plan_id: planId,
          price_id: priceId,
          status,
          billing_provider: "stripe",
          billing_provider_customer_id: customerId,
          billing_provider_subscription_id: subscriptionId,
          updated_at: new Date().toISOString(),
        };

        const { error: upsertErr } = await supabase
          .from("tenant_subscriptions")
          .upsert(updatePayload, { onConflict: "tenant_id" });

        if (upsertErr) {
          console.error(
            "[Webhooks/Billing] checkout.session.completed upsert error:",
            upsertErr
          );
        }

        await writeAudit(supabase, {
          action: "checkout.session.completed",
          tenantId,
          entityId: beforeRow?.id ?? tenantId,
          before: beforeRow as Record<string, unknown> | null,
          after: updatePayload,
          userId,
        });

        invalidateEntitlements(tenantId);
        break;
      }

      /* ------------------------------------------------------------ */
      /*  customer.subscription.created / updated                      */
      /* ------------------------------------------------------------ */
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeSubId = sub.id;
        const stripeCustomerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        const status = sub.status;
        const cancelAtPeriodEnd = sub.cancel_at_period_end;

        // Period dates from the first subscription item (Stripe API >= basil)
        const firstItem = sub.items?.data?.[0];
        const currentPeriodStart = epochToISO(firstItem?.current_period_start);
        const currentPeriodEnd = epochToISO(firstItem?.current_period_end);

        // Metadata (only trust Stripe)
        const metadata = sub.metadata ?? {};
        const planIdFromMeta = metadata.plan_id ?? null;
        const priceIdFromMeta = metadata.price_id ?? null;

        // Find existing row
        const { data: existingRow } = await supabase
          .from("tenant_subscriptions")
          .select("*")
          .eq("billing_provider_subscription_id", stripeSubId)
          .maybeSingle();

        const beforeSnapshot = existingRow as Record<string, unknown> | null;

        if (existingRow) {
          const updatePayload = {
            status,
            cancel_at_period_end: cancelAtPeriodEnd,
            current_period_start: currentPeriodStart,
            current_period_end: currentPeriodEnd,
            ...(planIdFromMeta ? { plan_id: planIdFromMeta } : {}),
            ...(priceIdFromMeta ? { price_id: priceIdFromMeta } : {}),
            updated_at: new Date().toISOString(),
          };

          await supabase
            .from("tenant_subscriptions")
            .update(updatePayload)
            .eq("id", existingRow.id);

          await writeAudit(supabase, {
            action: event.type,
            tenantId: existingRow.tenant_id,
            entityId: existingRow.id,
            before: beforeSnapshot,
            after: { ...beforeSnapshot, ...updatePayload },
            userId: existingRow.user_id,
          });

          invalidateEntitlements(existingRow.tenant_id);
        } else {
          // Fallback: match by billing_provider_customer_id
          const { data: tenantRow } = await supabase
            .from("tenant_subscriptions")
            .select("*")
            .eq("billing_provider_customer_id", stripeCustomerId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const fallbackBefore = tenantRow as Record<string, unknown> | null;

          if (tenantRow) {
            const updatePayload = {
              billing_provider_subscription_id: stripeSubId,
              billing_provider: "stripe",
              status,
              cancel_at_period_end: cancelAtPeriodEnd,
              current_period_start: currentPeriodStart,
              current_period_end: currentPeriodEnd,
              ...(planIdFromMeta ? { plan_id: planIdFromMeta } : {}),
              ...(priceIdFromMeta ? { price_id: priceIdFromMeta } : {}),
              updated_at: new Date().toISOString(),
            };

            await supabase
              .from("tenant_subscriptions")
              .update(updatePayload)
              .eq("id", tenantRow.id);

            await writeAudit(supabase, {
              action: event.type,
              tenantId: tenantRow.tenant_id,
              entityId: tenantRow.id,
              before: fallbackBefore,
              after: { ...fallbackBefore, ...updatePayload },
              userId: tenantRow.user_id,
            });

            invalidateEntitlements(tenantRow.tenant_id);
          } else {
            console.warn(
              `[Webhooks/Billing] No tenant found for customer ${stripeCustomerId}`
            );
          }
        }
        break;
      }

      /* ------------------------------------------------------------ */
      /*  customer.subscription.deleted                                */
      /* ------------------------------------------------------------ */
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        const { data: row } = await supabase
          .from("tenant_subscriptions")
          .select("*")
          .eq("billing_provider_subscription_id", sub.id)
          .maybeSingle();

        if (row) {
          const beforeSnapshot = { ...row } as Record<string, unknown>;

          // Use current_period_end as ended_at since schema doesn't have
          // a dedicated ended_at column.
          const firstItem = sub.items?.data?.[0];
          const endedAt = epochToISO(firstItem?.current_period_end);

          const updatePayload = {
            status: "canceled",
            current_period_end: endedAt ?? row.current_period_end,
            updated_at: new Date().toISOString(),
          };

          await supabase
            .from("tenant_subscriptions")
            .update(updatePayload)
            .eq("id", row.id);

          await writeAudit(supabase, {
            action: "customer.subscription.deleted",
            tenantId: row.tenant_id,
            entityId: row.id,
            before: beforeSnapshot,
            after: { ...beforeSnapshot, ...updatePayload },
            userId: row.user_id,
          });

          invalidateEntitlements(row.tenant_id);
        }
        break;
      }

      /* ------------------------------------------------------------ */
      /*  invoice.payment_failed                                       */
      /* ------------------------------------------------------------ */
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubId = subscriptionIdFromInvoice(invoice);

        if (stripeSubId) {
          const { data: row } = await supabase
            .from("tenant_subscriptions")
            .select("*")
            .eq("billing_provider_subscription_id", stripeSubId)
            .maybeSingle();

          if (row) {
            const beforeSnapshot = { ...row } as Record<string, unknown>;
            const updatePayload = {
              status: "past_due",
              updated_at: new Date().toISOString(),
            };

            await supabase
              .from("tenant_subscriptions")
              .update(updatePayload)
              .eq("id", row.id);

            await writeAudit(supabase, {
              action: "invoice.payment_failed",
              tenantId: row.tenant_id,
              entityId: row.id,
              before: beforeSnapshot,
              after: { ...beforeSnapshot, ...updatePayload },
              userId: row.user_id,
            });

            invalidateEntitlements(row.tenant_id);
          }
        }
        break;
      }

      /* ------------------------------------------------------------ */
      /*  invoice.paid                                                 */
      /* ------------------------------------------------------------ */
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubId = subscriptionIdFromInvoice(invoice);

        if (stripeSubId) {
          const { data: row } = await supabase
            .from("tenant_subscriptions")
            .select("*")
            .eq("billing_provider_subscription_id", stripeSubId)
            .maybeSingle();

          if (row && row.status === "past_due") {
            const beforeSnapshot = { ...row } as Record<string, unknown>;
            const updatePayload = {
              status: "active",
              updated_at: new Date().toISOString(),
            };

            await supabase
              .from("tenant_subscriptions")
              .update(updatePayload)
              .eq("id", row.id);

            await writeAudit(supabase, {
              action: "invoice.paid",
              tenantId: row.tenant_id,
              entityId: row.id,
              before: beforeSnapshot,
              after: { ...beforeSnapshot, ...updatePayload },
              userId: row.user_id,
            });

            invalidateEntitlements(row.tenant_id);
          }
        }
        break;
      }

      default:
        console.log(
          `[Webhooks/Billing] Unhandled event type: ${event.type}`
        );
    }
  } catch (err) {
    console.error("[Webhooks/Billing] Error processing event:", err);
    // Still return 200 so Stripe doesn't endlessly retry on a bug in our
    // handler logic. The dedupe record is already written so a manual
    // replay can be triggered if needed.
    return NextResponse.json({ received: true, error: "processing_failed" });
  }

  return NextResponse.json({ received: true });
}
