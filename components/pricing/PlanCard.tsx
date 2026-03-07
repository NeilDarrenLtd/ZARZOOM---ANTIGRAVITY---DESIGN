"use client";

import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import type { DisplayablePlan } from "@/lib/pricing";
import { getPriceForSelection } from "@/lib/pricing";
import { formatPrice } from "@/lib/billing/format";

interface PlanCardProps {
  plan: DisplayablePlan;
  currency: Currency;
  interval: BillingInterval;
  discountEnabled?: boolean;
  onChoosePlan?: (planKey: string, priceId: string) => void;
  isPopular?: boolean;
  isSelected?: boolean;
}

export function PlanCard({
  plan,
  currency,
  interval,
  discountEnabled = false,
  onChoosePlan,
  isPopular = false,
  isSelected = false,
}: PlanCardProps) {
  const { t } = useI18n();
  const price = getPriceForSelection(
    {
      planKey: plan.planKey,
      name: plan.name,
      description: plan.description,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      prices: plan.prices,
      features: [],
      entitlements: {},
      quotaPolicy: {},
    },
    currency,
    interval
  );

  if (!price) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8">
        <h3 className="text-lg font-bold text-zinc-900">{plan.displayName}</h3>
        <p className="mt-2 text-sm text-zinc-500">
          Price not available for {currency} / {interval}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-white p-5 sm:p-8 shadow-sm transition-all hover:shadow-md ${
        isSelected
          ? "border-green-600 ring-2 ring-green-600 bg-green-50/50"
          : isPopular
          ? "border-green-500 ring-2 ring-green-500"
          : "border-zinc-200"
      }`}
    >
      {isPopular && !isSelected && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-green-500 px-4 py-1 text-sm font-medium text-white">
            Most Popular
          </span>
        </div>
      )}
      {isSelected && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-green-600 px-4 py-1 text-sm font-medium text-white">
            <Check className="mr-1 h-4 w-4" />
            Selected
          </span>
        </div>
      )}

      <h3 className="text-2xl font-bold text-zinc-900">{plan.displayName}</h3>
      <p className="mt-2 text-sm text-zinc-600">{plan.displayDescription}</p>

      <div className="mt-6 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-zinc-900">
          {formatPrice(discountEnabled ? Math.round(price.amountMinor / 2) : price.amountMinor, currency)}
        </span>
        <span className="text-sm text-zinc-500">/ {interval === "monthly" ? "month" : "year"}</span>
        {discountEnabled && (
          <span className="ml-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
            Save 50%
          </span>
        )}
      </div>

      <button
        onClick={() => onChoosePlan?.(plan.planKey, price.id)}
        className={`mt-6 mb-6 w-full rounded-lg px-6 py-3 text-base font-semibold text-white transition-colors ${
          isSelected
            ? "bg-green-600 hover:bg-green-700 cursor-not-allowed opacity-75"
            : isPopular
            ? "bg-green-600 hover:bg-green-700"
            : "bg-zinc-900 hover:bg-zinc-800"
        }`}
        disabled={isSelected}
      >
        {isSelected ? t("onboarding.step4.selected") : t("onboarding.step4.selectPlan")}
      </button>

      <ul className="space-y-3 flex-1">
        {plan.displayFeatures.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <Check className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
            <span className="text-sm text-zinc-700">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
