"use client";

import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import type { DisplayablePlan } from "@/lib/pricing";
import { PlanCard } from "./PlanCard";

interface PricingGridProps {
  plans: DisplayablePlan[];
  currency: Currency;
  interval: BillingInterval;
  discountEnabled?: boolean;
  onChoosePlan?: (planKey: string, priceId: string) => void;
  selectedPlanKey?: string;
}

export function PricingGrid({ plans, currency, interval, discountEnabled = false, onChoosePlan, selectedPlanKey }: PricingGridProps) {
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
      {plans.map((plan, index) => {
        // Safety check: ensure plan is defined
        if (!plan || !plan.planKey) {
          console.error("[v0] Invalid plan object in PricingGrid.map:", plan);
          return null;
        }

        return (
          <PlanCard
            key={plan.planKey}
            name={plan.name}
            slug={plan.planKey}
            description={plan.displayDescription}
            features={plan.displayFeatures}
            prices={plan.prices}
            highlight={index === 1}
            currency={currency}
            interval={interval}
            isLoggedIn={false}
            discountEnabled={discountEnabled}
            onChoosePlan={(priceId) => onChoosePlan?.(plan.planKey, priceId)}
          />
        );
      })}
    </div>
  );
}
