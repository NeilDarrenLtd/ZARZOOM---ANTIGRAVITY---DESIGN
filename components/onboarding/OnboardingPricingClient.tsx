"use client";

import { useState, useEffect } from "react";
import type { DisplayablePlan } from "@/lib/pricing";
import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import { fetchPlans, getDisplayablePlans, getPriceForSelection } from "@/lib/pricing";
import { useI18n } from "@/lib/i18n";
import { Check, Loader2 } from "lucide-react";

interface OnboardingPricingClientProps {
  onSelectPlan: (planKey: string, priceId: string) => void;
  selectedPlanKey?: string;
}

export function OnboardingPricingClient({
  onSelectPlan,
  selectedPlanKey,
}: OnboardingPricingClientProps) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<DisplayablePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currency] = useState<Currency>("GBP");
  const [interval] = useState<BillingInterval>("monthly");

  useEffect(() => {
    let mounted = true;

    async function loadPlans() {
      try {
        const response = await fetchPlans();
        if (!mounted) return;

        const displayable = getDisplayablePlans(response.plans, t);
        setPlans(displayable);
      } catch (error) {
        console.error("[v0] Failed to load plans:", error);
        if (mounted) setPlans([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadPlans();
    return () => {
      mounted = false;
    };
  }, [t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-green-600" />
          <p className="mt-4 text-sm text-zinc-600">Loading plans...</p>
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
        <p className="text-lg font-medium text-zinc-900">No plans available</p>
        <p className="mt-2 text-sm text-zinc-600">Please contact support for assistance.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const price = getPriceForSelection(plan, currency, interval);
        const isSelected = selectedPlanKey === plan.planKey;

        return (
          <button
            key={plan.planKey}
            onClick={() => {
              if (price) {
                onSelectPlan(plan.planKey, price.id);
              }
            }}
            disabled={!price}
            className={`relative rounded-lg border-2 p-6 text-left transition-all ${
              isSelected
                ? "border-green-600 bg-green-50 shadow-md"
                : price
                ? "border-zinc-200 bg-white hover:border-green-300 hover:shadow-sm"
                : "border-zinc-200 bg-zinc-50 opacity-60 cursor-not-allowed"
            }`}
          >
            {isSelected && (
              <div className="absolute right-4 top-4">
                <Check className="h-6 w-6 text-green-600" />
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-bold text-zinc-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-zinc-600">{plan.description}</p>
            </div>

            {price ? (
              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-zinc-900">
                    {price.formattedAmount}
                  </span>
                  <span className="text-sm text-zinc-600">
                    /{interval === "monthly" ? "mo" : "yr"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-sm text-zinc-500">Price unavailable for {currency}</p>
              </div>
            )}

            {plan.features && plan.features.length > 0 && (
              <ul className="space-y-2">
                {plan.features.slice(0, 4).map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-zinc-700">
                    <Check className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            )}
          </button>
        );
      })}
    </div>
  );
}
