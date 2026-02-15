"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuotasEditor } from "@/components/admin/billing/quotas-editor";
import { FeaturesEditor } from "@/components/admin/billing/features-editor";
import {
  CURRENCIES,
  INTERVALS,
  type Currency,
  type BillingInterval,
} from "@/lib/billing/types";

/* ------------------------------------------------------------------ */
/*  Price entry type for the create form                               */
/* ------------------------------------------------------------------ */

interface PriceEntry {
  id: string;
  currency: Currency;
  interval: BillingInterval;
  amount: string; // human-readable, e.g. "9.99"
}

let priceCounter = 0;

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function NewPlanPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [highlight, setHighlight] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [features, setFeatures] = useState<string[]>([]);
  const [quotaPolicy, setQuotaPolicy] = useState<Record<string, unknown>>({});
  const [prices, setPrices] = useState<PriceEntry[]>([
    { id: `p-${priceCounter++}`, currency: "GBP", interval: "monthly", amount: "" },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Auto-generate slug from name */
  function handleNameChange(value: string) {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  }

  function addPrice() {
    setPrices((prev) => [
      ...prev,
      { id: `p-${priceCounter++}`, currency: "GBP", interval: "monthly", amount: "" },
    ]);
  }

  function removePrice(id: string) {
    setPrices((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePrice(id: string, field: keyof PriceEntry, value: string) {
    setPrices((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  }

  async function handleCreate() {
    setError(null);

    // Basic client-side validation
    if (!name.trim()) {
      setError("Plan name is required.");
      return;
    }
    if (!slug.trim()) {
      setError("Slug is required.");
      return;
    }
    const validPrices = prices.filter((p) => p.amount && parseFloat(p.amount) >= 0);
    if (validPrices.length === 0) {
      setError("At least one price is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/billing/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || "",
          display_order: displayOrder,
          highlight,
          is_active: isActive,
          features,
          quota_policy: quotaPolicy,
          entitlements: {},
          prices: validPrices.map((p) => ({
            currency: p.currency,
            interval: p.interval,
            unitAmount: Math.round(parseFloat(p.amount) * 100),
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to create plan");
      }

      router.push("/admin/billing/plans");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
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
            <h1 className="text-xl font-bold text-zinc-900">Create New Plan</h1>
            <p className="text-sm text-zinc-500">
              Define plan details, pricing, and quotas.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreate}
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
            <Plus className="h-4 w-4" />
          )}
          Create Plan
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Plan Details */}
      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-6">
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
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Professional"
              className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="plan-slug" className="mb-1 block text-xs font-medium text-zinc-700">
              Slug
            </label>
            <input
              id="plan-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. professional"
              className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
          <div className="flex items-end gap-6 pb-2">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={highlight}
                onChange={(e) => setHighlight(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              Highlight
            </label>
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
              placeholder="A short description of what this plan includes..."
              className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">Pricing</h2>
          <button
            type="button"
            onClick={addPrice}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Price
          </button>
        </div>

        <div className="space-y-3">
          {prices.map((price) => (
            <div
              key={price.id}
              className="flex items-center gap-3 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2"
            >
              <select
                value={price.currency}
                onChange={(e) => updatePrice(price.id, "currency", e.target.value)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                aria-label="Currency"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={price.interval}
                onChange={(e) => updatePrice(price.id, "interval", e.target.value)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                aria-label="Interval"
              >
                {INTERVALS.map((i) => (
                  <option key={i} value={i}>
                    {i === "monthly" ? "Monthly" : "Annual"}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={price.amount}
                onChange={(e) => updatePrice(price.id, "amount", e.target.value)}
                className="w-28 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                aria-label="Amount"
              />
              {prices.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePrice(price.id)}
                  className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-500"
                  aria-label="Remove price"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-zinc-900">Features</h2>
        <FeaturesEditor value={features} onChange={setFeatures} />
      </section>

      {/* Quotas */}
      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-zinc-900">Quota Policy</h2>
        <QuotasEditor value={quotaPolicy} onChange={setQuotaPolicy} />
      </section>
    </div>
  );
}
