"use client";

import { Check } from "lucide-react";
import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import type { DisplayablePlan } from "@/lib/pricing";
import { getPriceForSelection } from "@/lib/pricing";
import { formatPrice } from "@/lib/billing/format";
import { Button } from "@/components/ui/button";

interface PlanCardProps {
  plan: DisplayablePlan;
  currency: Currency;
  interval: BillingInterval;
  onChoosePlan?: (planKey: string, priceId: string) => void;
  isPopular?: boolean;
}

export function PlanCard({
  plan,
  currency,
  interval,
  onChoosePlan,
  isPopular = false,
}: PlanCardProps) {
  const price = getPriceForSelection(plan, currency, interval);

  if (!price) {
    // Plan exists but has no price for this currency/interval combination
    return null;
  }

  const displayPrice = formatPrice(price.amountMinor, currency);
  const intervalLabel = interval === "monthly" ? "month" : "year";

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm transition-all hover:shadow-md ${
        isPopular ? "border-green-500 ring-2 ring-green-500" : "border-zinc-200"
      }`}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-green-500 px-4 py-1 text-sm font-medium text-white">
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-2xl font-bold text-zinc-900">{plan.displayName}</h3>
        <p className="mt-2 text-sm text-zinc-600">{plan.displayDescription}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-zinc-900">{displayPrice}</span>
          <span className="text-zinc-600">/{intervalLabel}</span>
        </div>
      </div>

      <Button
        onClick={() => onChoosePlan?.(plan.planKey, price.id)}
        className={`mb-6 w-full ${
          isPopular
            ? "bg-green-600 hover:bg-green-700"
            : "bg-zinc-900 hover:bg-zinc-800"
        }`}
        size="lg"
      >
        Choose Plan
      </Button>

      <div className="flex-1">
        <ul className="space-y-3">
          {plan.displayFeatures.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <Check className="h-5 w-5 shrink-0 text-green-600" />
              <span className="text-sm text-zinc-700">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
