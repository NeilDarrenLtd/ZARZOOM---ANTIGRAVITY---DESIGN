"use client";

import { useEffect, useState } from "react";
import {
  fetchEnvStatus,
  fetchRecentDedupeEvents,
  fetchCurrentSubscription,
  type EnvStatus,
  type DedupeRow,
  type SubRow,
} from "./actions";
import {
  CheckCircle2,
  XCircle,
  Copy,
  RefreshCw,
  Terminal,
  Webhook,
  CreditCard,
  Clock,
  ExternalLink,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Tiny copy-to-clipboard button                                      */
/* ------------------------------------------------------------------ */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-2 p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
      title="Copy"
    >
      {copied ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-50 text-green-700",
    trialing: "bg-blue-50 text-blue-700",
    past_due: "bg-amber-50 text-amber-700",
    canceled: "bg-red-50 text-red-700",
    incomplete: "bg-gray-100 text-gray-600",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        colors[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminBillingStripePage() {
  const [envVars, setEnvVars] = useState<EnvStatus[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [dedupeEvents, setDedupeEvents] = useState<DedupeRow[]>([]);
  const [subscription, setSubscription] = useState<SubRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);

    const [envResult, dedupeResult, subResult] = await Promise.all([
      fetchEnvStatus(),
      fetchRecentDedupeEvents(),
      fetchCurrentSubscription(),
    ]);

    if (envResult.error) setError(envResult.error);
    if (dedupeResult.error) setError(dedupeResult.error);
    if (subResult.error) setError(subResult.error);

    setEnvVars(envResult.vars);
    setWebhookUrl(envResult.webhookUrl);
    setDedupeEvents(dedupeResult.events);
    setSubscription(subResult.subscription);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-sm text-gray-400">
          Loading Stripe diagnostics...
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Stripe Integration
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Developer tooling, env-var status, and webhook diagnostics.
          </p>
        </div>
        <button
          onClick={loadAll}
          className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* ---- ENV VAR STATUS ---- */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Required Environment Variables
              </h2>
              <p className="text-xs text-gray-500">
                All three must be set for billing to work.
              </p>
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {envVars.map((v) => (
              <div
                key={v.key}
                className="px-6 py-4 flex items-center gap-4"
              >
                {v.set ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium text-gray-900">
                    {v.key}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{v.hint}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    v.set
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {v.set ? "Set" : "Missing"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ---- WEBHOOK ENDPOINT ---- */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <Webhook className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Webhook Endpoint
              </h2>
              <p className="text-xs text-gray-500">
                Register this URL in Stripe Dashboard or use the CLI for
                local testing.
              </p>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <code className="text-sm font-mono text-gray-800 flex-1 break-all">
                {webhookUrl}
              </code>
              <CopyButton text={webhookUrl} />
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Required events:{" "}
              <code className="text-xs">
                checkout.session.completed, customer.subscription.updated,
                customer.subscription.deleted, invoice.paid,
                invoice.payment_failed, customer.subscription.created
              </code>
            </p>
          </div>
        </section>

        {/* ---- STRIPE CLI INSTRUCTIONS ---- */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Local Webhook Testing
              </h2>
              <p className="text-xs text-gray-500">
                Use the Stripe CLI to forward events to your local dev
                server.
              </p>
            </div>
          </div>

          <div className="px-6 py-5 flex flex-col gap-4">
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">
                1. Install and login to the Stripe CLI
              </p>
              <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-3">
                <code className="text-sm font-mono text-green-400 flex-1">
                  brew install stripe/stripe-cli/stripe && stripe login
                </code>
                <CopyButton
                  text="brew install stripe/stripe-cli/stripe && stripe login"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">
                2. Forward events to your local server
              </p>
              <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-3">
                <code className="text-sm font-mono text-green-400 flex-1 break-all">
                  stripe listen --forward-to
                  localhost:3000/api/v1/webhooks/billing
                </code>
                <CopyButton text="stripe listen --forward-to localhost:3000/api/v1/webhooks/billing" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Copy the <code className="text-xs">whsec_...</code> signing
                secret from the CLI output into your{" "}
                <code className="text-xs">.env.local</code> as{" "}
                <code className="text-xs">STRIPE_WEBHOOK_SECRET</code>.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">
                3. Trigger a test event
              </p>
              <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-3">
                <code className="text-sm font-mono text-green-400 flex-1">
                  stripe trigger checkout.session.completed
                </code>
                <CopyButton text="stripe trigger checkout.session.completed" />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">
                4. Verify in Supabase
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Check that the event appears in the{" "}
                <code className="text-xs">stripe_event_dedupe</code> table
                below, and that{" "}
                <code className="text-xs">tenant_subscriptions</code> was
                updated accordingly. Duplicate event IDs will be silently
                skipped.
              </p>
            </div>

            <a
              href="https://docs.stripe.com/stripe-cli"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-800 transition-colors"
            >
              Stripe CLI Documentation
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>

        {/* ---- RECENT DEDUPE EVENTS ---- */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Recent Webhook Events
              </h2>
              <p className="text-xs text-gray-500">
                Last 10 entries from{" "}
                <code className="text-xs">stripe_event_dedupe</code>.
              </p>
            </div>
          </div>

          {dedupeEvents.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              No webhook events received yet. Use the Stripe CLI to send a
              test event.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-6 py-3 font-medium text-gray-500">
                      Event ID
                    </th>
                    <th className="px-6 py-3 font-medium text-gray-500">
                      Received At
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dedupeEvents.map((evt) => (
                    <tr
                      key={evt.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-3 font-mono text-xs text-gray-700">
                        {evt.id}
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs">
                        {new Date(evt.received_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---- CURRENT SUBSCRIPTION ---- */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Current Tenant Subscription
              </h2>
              <p className="text-xs text-gray-500">
                Subscription for your admin tenant.
              </p>
            </div>
          </div>

          {!subscription ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              No active subscription found for your tenant.
            </div>
          ) : (
            <div className="px-6 py-5">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div>
                  <dt className="text-xs font-medium text-gray-500">
                    Status
                  </dt>
                  <dd className="mt-1">
                    <StatusBadge status={subscription.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">
                    Plan
                  </dt>
                  <dd className="mt-1 text-gray-900 font-medium">
                    {subscription.plan_name ?? "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">
                    Provider
                  </dt>
                  <dd className="mt-1 text-gray-700">
                    {subscription.billing_provider ?? "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">
                    Customer ID
                  </dt>
                  <dd className="mt-1 font-mono text-xs text-gray-700">
                    {subscription.billing_provider_customer_id ?? "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">
                    Subscription ID
                  </dt>
                  <dd className="mt-1 font-mono text-xs text-gray-700">
                    {subscription.billing_provider_subscription_id ?? "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">
                    Cancel at period end
                  </dt>
                  <dd className="mt-1 text-gray-700">
                    {subscription.cancel_at_period_end ? "Yes" : "No"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">
                    Period start
                  </dt>
                  <dd className="mt-1 text-gray-700 text-xs">
                    {subscription.current_period_start
                      ? new Date(
                          subscription.current_period_start
                        ).toLocaleString()
                      : "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">
                    Period end
                  </dt>
                  <dd className="mt-1 text-gray-700 text-xs">
                    {subscription.current_period_end
                      ? new Date(
                          subscription.current_period_end
                        ).toLocaleString()
                      : "N/A"}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
