"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { createNewPlan, updateExistingPlan } from "@/app/admin/billing/actions";
import {
  CURRENCIES,
  INTERVALS,
  PLAN_STATUSES,
  type PlanWithPrices,
  type Currency,
  type BillingInterval,
} from "@/lib/billing/types";
import { formatPrice } from "@/lib/billing/format";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import Link from "next/link";

interface PriceEntry {
  currency: Currency;
  interval: BillingInterval;
  unitAmount: number;
}

function buildInitialPrices(plan?: PlanWithPrices): PriceEntry[] {
  if (plan?.plan_prices?.length) {
    return plan.plan_prices.map((p) => ({
      currency: p.currency.toUpperCase() as Currency,
      interval: p.interval,
      unitAmount: p.unit_amount,
    }));
  }
  // Default: one price per currency per interval
  const defaults: PriceEntry[] = [];
  for (const currency of CURRENCIES) {
    for (const interval of INTERVALS) {
      defaults.push({ currency, interval, unitAmount: 0 });
    }
  }
  return defaults;
}

export default function PlanForm({
  existingPlan,
}: {
  existingPlan?: PlanWithPrices;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const isEditing = !!existingPlan;

  const [name, setName] = useState(existingPlan?.name ?? "");
  const [slug, setSlug] = useState(existingPlan?.slug ?? "");
  const [description, setDescription] = useState(existingPlan?.description ?? "");
  const [status, setStatus] = useState(existingPlan?.status ?? "draft");
  const [displayOrder, setDisplayOrder] = useState(existingPlan?.display_order ?? 0);
  const [trialDays, setTrialDays] = useState(existingPlan?.trial_days ?? 0);
  const [prices, setPrices] = useState<PriceEntry[]>(buildInitialPrices(existingPlan));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function autoSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!isEditing) setSlug(autoSlug(value));
  }

  function updatePrice(index: number, field: keyof PriceEntry, value: string | number) {
    setPrices((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  function addPrice() {
    setPrices((prev) => [...prev, { currency: "GBP", interval: "monthly", unitAmount: 0 }]);
  }

  function removePrice(index: number) {
    setPrices((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaving(true);

    const formData = new FormData();
    if (isEditing) formData.set("id", existingPlan!.id);
    formData.set("name", name);
    formData.set("slug", slug);
    formData.set("description", description);
    formData.set("status", status);
    formData.set("displayOrder", String(displayOrder));
    formData.set("trialDays", String(trialDays));
    formData.set("prices", JSON.stringify(prices));

    const result = isEditing
      ? await updateExistingPlan(formData)
      : await createNewPlan(formData);

    setSaving(false);

    if (result.errors) {
      setFieldErrors(result.errors);
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }

    router.push("/admin/billing");
    router.refresh();
  }

  const inputClass =
    "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow";
  const labelClass = "block text-xs font-medium text-gray-600 mb-1.5";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/billing"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? t("billing.admin.editPlan") : t("billing.admin.newPlan")}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isEditing
              ? t("billing.admin.editPlanDesc")
              : t("billing.admin.newPlanDesc")}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        {/* Plan Details Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-5">{t("billing.admin.planDetails")}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("billing.admin.planName")}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className={inputClass}
                placeholder="e.g. Pro"
                required
              />
              {fieldErrors.name && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.name[0]}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>{t("billing.admin.planSlug")}</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className={inputClass}
                placeholder="e.g. pro"
                required
              />
              {fieldErrors.slug && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.slug[0]}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{t("billing.admin.planDescription")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
                rows={3}
                placeholder="Describe what this plan includes..."
              />
            </div>
            <div>
              <label className={labelClass}>{t("billing.admin.planStatus")}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className={inputClass}
              >
                {PLAN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("billing.admin.planTrialDays")}</label>
              <input
                type="number"
                value={trialDays}
                onChange={(e) => setTrialDays(parseInt(e.target.value) || 0)}
                className={inputClass}
                min={0}
                max={365}
              />
            </div>
            <div>
              <label className={labelClass}>{t("billing.admin.planDisplayOrder")}</label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                className={inputClass}
                min={0}
              />
            </div>
          </div>
        </div>

        {/* Prices Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-gray-900">{t("billing.admin.planPrices")}</h2>
            <button
              type="button"
              onClick={addPrice}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("billing.admin.addPrice")}
            </button>
          </div>

          {fieldErrors.prices && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-4 text-xs">
              {fieldErrors.prices[0]}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {prices.map((price, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <select
                  value={price.currency}
                  onChange={(e) => updatePrice(index, "currency", e.target.value)}
                  className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={price.interval}
                  onChange={(e) => updatePrice(index, "interval", e.target.value)}
                  className="px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {INTERVALS.map((i) => (
                    <option key={i} value={i}>
                      {i.charAt(0).toUpperCase() + i.slice(1)}
                    </option>
                  ))}
                </select>
                <div className="flex-1">
                  <input
                    type="number"
                    value={price.unitAmount}
                    onChange={(e) =>
                      updatePrice(index, "unitAmount", parseInt(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Amount in pence/cents"
                    min={0}
                  />
                </div>
                <span className="text-xs text-gray-400 min-w-[5rem] text-right">
                  {formatPrice(price.unitAmount, price.currency)}
                </span>
                <button
                  type="button"
                  onClick={() => removePrice(index)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <Link
            href="/admin/billing"
            className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {t("billing.admin.cancel")}
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving
              ? t("billing.admin.saving")
              : isEditing
              ? t("billing.admin.updatePlan")
              : t("billing.admin.createPlan")}
          </button>
        </div>
      </form>
    </div>
  );
}
