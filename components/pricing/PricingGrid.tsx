"use client";

import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import type { DisplayablePlan } from "@/lib/pricing";
import { PlanCard } from "./PlanCard";

interface PricingGridProps {
  plans: DisplayablePlan[];
  currency: Currency;
  interval: BillingInterval;
  onChoosePlan?: (planKey: string, priceId: string) => void;
  selectedPlanKey?: string;
}

export function PricingGrid({ plans, currency, interval, onChoosePlan, selectedPlanKey }: PricingGridProps) {
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
    <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan, index) => (
        <PlanCard
          key={plan.planKey}
          plan={plan}
          currency={currency}
          interval={interval}
          onChoosePlan={onChoosePlan}
          isPopular={index === 1}
          isSelected={selectedPlanKey === plan.planKey}
        />
      ))}
    </div>
  );
}
