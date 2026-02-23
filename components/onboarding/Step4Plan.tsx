"use client";

import { useI18n } from "@/lib/i18n";
import { PLAN_OPTIONS } from "@/lib/validation/onboarding";
import type { OnboardingUpdate, Plan } from "@/lib/validation/onboarding";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getDisplayablePlansClient } from "@/lib/billing/displayable-plans";
import type { DisplayablePlan } from "@/lib/billing/displayable-plans";

interface Step4Props {
  data: OnboardingUpdate;
  onChange: (patch: Partial<OnboardingUpdate>) => void;
  aiFilledFields?: string[];
}

export default function Step4Plan({ data, onChange }: Step4Props) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<DisplayablePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Fetch displayable plans on mount
  useEffect(() => {
    async function loadPlans() {
      try {
        console.log("[v0] Step4Plan: Loading displayable plans");
        const displayablePlans = await getDisplayablePlansClient(t);
        setPlans(displayablePlans);
        console.log("[v0] Step4Plan: Loaded", displayablePlans.length, "plans");
      } catch (err) {
        console.error("[v0] Step4Plan: Failed to load plans:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, [t]);

  const isAnnual = data.discount_opt_in !== false; // default ON
  const selectedPlan = data.selected_plan ?? null;

  function selectPlan(planKey: string) {
    onChange({ selected_plan: planKey as Plan });
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {t("onboarding.step4.title")}
          </h2>
          <p className="text-gray-500 text-sm mt-1 leading-relaxed">
            {t("onboarding.step4.subtitle")}
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      </div>
    );
  }

  // Error or no plans available
  if (error || plans.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {t("onboarding.step4.title")}
          </h2>
          <p className="text-gray-500 text-sm mt-1 leading-relaxed">
            {t("onboarding.step4.subtitle")}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t("pricing.fallback.title")}
          </h3>
          <p className="text-sm text-gray-600">
            {t("pricing.fallback.message")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {t("onboarding.step4.title")}
        </h2>
        <p className="text-gray-500 text-sm mt-1 leading-relaxed">
          {t("onboarding.step4.subtitle")}
        </p>
      </div>

      {/* Discount toggle */}
      <div className="flex items-center justify-center gap-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isAnnual}
            onChange={(e) => onChange({ discount_opt_in: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
        </label>
        <span className="text-sm font-medium text-gray-700">
          {t("onboarding.step4.discount.label")}
        </span>
        {isAnnual && (
          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            {t("onboarding.step4.discount.save").replace("{percent}", "17")}
          </span>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan, index) => {
          const isSelected = selectedPlan === plan.planKey;
          const isPopular = index === 1; // Middle plan
          
          // Find price for current interval and GBP currency
          const priceObj = plan.prices.find(
            (p) => p.currency === "GBP" && p.interval === (isAnnual ? "annual" : "monthly")
          );
          const priceAmount = priceObj?.amountMinor || 0;
          const displayPrice = isAnnual
            ? Math.round(priceAmount / 100 / 12)
            : Math.round(priceAmount / 100);

          return (
            <div
              key={plan.planKey}
              className={`relative flex flex-col rounded-2xl border p-6 transition-all cursor-pointer ${
                isSelected
                  ? "border-green-500 bg-white shadow-lg ring-1 ring-green-500/20"
                  : isPopular
                    ? "border-green-300 bg-white shadow-md"
                    : "border-gray-200 bg-white hover:border-green-300"
              }`}
              onClick={() => selectPlan(plan.planKey)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && selectPlan(plan.planKey)}
            >
              {/* Popular badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {t("onboarding.step4.popular")}
                  </span>
                </div>
              )}

              <h3 className="text-lg font-bold text-gray-900">
                {plan.copy.displayName}
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {plan.copy.shortTagline}
              </p>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">
                  £{displayPrice}
                </span>
                <span className="text-sm text-gray-400">
                  {t("onboarding.step4.perMonth")}
                </span>
              </div>

              <button
                type="button"
                className={`mt-4 w-full py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  isSelected
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {isSelected
                  ? t("onboarding.step4.selected")
                  : t("onboarding.step4.selectPlan")}
              </button>

              <ul className="mt-5 flex flex-col gap-2.5 flex-1">
                {plan.copy.bullets.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check
                      className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        isSelected || isPopular
                          ? "text-green-600"
                          : "text-gray-400"
                      }`}
                    />
                    <span className="text-xs text-gray-600 leading-relaxed">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
