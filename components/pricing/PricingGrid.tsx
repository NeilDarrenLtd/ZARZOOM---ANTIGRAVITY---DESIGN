"use client";

import { PlanCard } from "./PlanCard";
import { usePricing } from "./PricingProvider";

interface PricingGridProps {
  onChoosePlan?: (planKey: string, priceId: string) => void;
}

export function PricingGrid({ onChoosePlan }: PricingGridProps) {
  const { plans, currency, interval, isLoading } = usePricing();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

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
