"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Archive, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuotasEditor } from "./quotas-editor";
import { FeaturesEditor } from "./features-editor";
import { PriceMatrixEditor } from "./price-matrix-editor";
import type { PlanWithPrices, Currency, BillingInterval } from "@/lib/billing/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PlanEditorFormProps {
  plan: PlanWithPrices;
  onRefresh: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PlanEditorForm({ plan, onRefresh }: PlanEditorFormProps) {
  const router = useRouter();

  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? "");
  const [displayOrder, setDisplayOrder] = useState(plan.sort_order);
  const [isActive, setIsActive] = useState(plan.is_active);
  const [stripePriceId, setStripePriceId] = useState(plan.stripe_price_id ?? "");
  const [features, setFeatures] = useState<string[]>(
    Array.isArray(plan.features) ? (plan.features as string[]) : []
  );
  const [quotaPolicy, setQuotaPolicy] = useState<Record<string, unknown>>(
    plan.quota_policy ?? {}
  );

  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/v1/admin/billing/plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          sort_order: displayOrder,
          is_active: isActive,
          features,
          quota_policy: quotaPolicy,
          stripe_price_id: stripePriceId.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to save");
      }
      setSuccess("Plan updated successfully");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!confirm("Are you sure you want to archive this plan? It will no longer be available to new subscribers.")) return;
    setArchiving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/billing/plans/${plan.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to archive");
      }
      router.push("/admin/billing/plans");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive");
    } finally {
      setArchiving(false);
    }
  }

  async function handleAddPrice(currency: Currency, interval: BillingInterval, unitAmount: number) {
    const res = await fetch(`/api/v1/admin/billing/plans/${plan.id}/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency, interval, unitAmount }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error?.message ?? "Failed to add price");
    }
    onRefresh();
  }

  async function handleDeactivatePrice(priceId: string) {
    const res = await fetch(`/api/v1/admin/billing/plans/${plan.id}/prices`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error?.message ?? "Failed to deactivate price");
    }
    onRefresh();
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin/billing/plans")}
            className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Back to plans"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">
              Edit Plan: {plan.name}
            </h1>
            <p className="text-sm text-zinc-500">
              Slug: <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600">{plan.plan_key}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleArchive}
            disabled={archiving}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            {archiving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Archive
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors",
              saving
                ? "cursor-not-allowed bg-zinc-300"
                : "bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* Plan Details Section */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-zinc-900">
          Plan Details
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="plan-name" className="mb-1 block text-xs font-medium text-zinc-700">
              Name
            </label>
            <input
              id="plan-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="plan-order" className="mb-1 block text-xs font-medium text-zinc-700">
              Display Order
            </label>
            <input
              id="plan-order"
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
              className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="plan-desc" className="mb-1 block text-xs font-medium text-zinc-700">
              Description
            </label>
            <textarea
              id="plan-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              Active
            </label>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-zinc-900">
          Features
        </h2>
        <FeaturesEditor value={features} onChange={setFeatures} />
      </section>

      {/* Quotas Section */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-zinc-900">
          Quota Policy
        </h2>
        <QuotasEditor value={quotaPolicy} onChange={setQuotaPolicy} />
      </section>

      {/* Stripe Integration Section */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-zinc-900">
            Stripe Integration
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Link this plan to a Stripe Price object. Used by the checkout flow to initiate subscriptions.
          </p>
        </div>
        <div>
          <label htmlFor="stripe-price-id" className="mb-1 block text-xs font-medium text-zinc-700">
            Stripe Price ID
          </label>
          <input
            id="stripe-price-id"
            type="text"
            value={stripePriceId}
            onChange={(e) => setStripePriceId(e.target.value)}
            placeholder="price_xxxxxxxxxxxxxxxxxx"
            className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-900 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <p className="mt-1.5 text-xs text-zinc-400">
            Find this in your Stripe Dashboard under Products &rarr; Prices. Format: <code className="font-mono">price_xxx</code>
          </p>
        </div>
      </section>

      {/* Price Matrix Section */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-zinc-900">
          Pricing
        </h2>
        <PriceMatrixEditor
          planId={plan.id}
          prices={plan.prices.map((p) => ({
            id: p.id,
            plan_id: p.plan_id,
            currency: p.currency,
            interval: p.interval,
            unit_amount: p.amount_minor,
            billing_provider_price_id: p.billing_provider_price_id,
            is_active: p.is_active,
            effective_from: p.effective_from,
            effective_to: p.effective_to,
            created_by: p.created_by,
            created_at: p.created_at,
            updated_at: p.updated_at,
          }))}
          onAddPrice={handleAddPrice}
          onDeactivatePrice={handleDeactivatePrice}
        />
      </section>
    </div>
  );
}
