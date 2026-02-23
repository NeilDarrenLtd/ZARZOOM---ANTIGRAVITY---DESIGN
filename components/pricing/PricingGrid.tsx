"use client";

import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import type { DisplayablePlan } from "@/lib/pricing";
import { PlanCard } from "./PlanCard";

interface PricingGridProps {
  plans: DisplayablePlan[];
  currency: Currency;
  interval: BillingInterval;
  onChoosePlan?: (planKey: string, priceId: string) => void;
}

export function PricingGrid({ plans, currency, interval, onChoosePlan }: PricingGridProps) {
  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
        <p className="text-zinc-600">
          Pricing information is temporarily unavailable. Please check back soon.
        </p>
      </div>
    );
  }

  return (
    <div
      className="grid gap-8"
      style={{
        gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, minmax(0, 1fr))`,
      }}
    >
      {plans.map((plan, index) => (
        <PlanCard
          key={plan.planKey}
          plan={plan}
          currency={currency}
          interval={interval}
          onChoosePlan={onChoosePlan}
          isPopular={index === 1} // Middle plan is popular
        />
      ))}
    </div>
  );
}
