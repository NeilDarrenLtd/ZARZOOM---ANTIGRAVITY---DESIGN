"use client";

import { useState, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import type { OnboardingUpdate } from "@/lib/validation/onboarding";
import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import type { DisplayablePlan } from "@/lib/pricing";
import { fetchPlans, getDisplayablePlans, getPriceForSelection } from "@/lib/pricing";
import { formatPrice } from "@/lib/billing/format";
import { Check, AlertCircle, Loader2 } from "lucide-react";

interface Step4Props {
  data: OnboardingUpdate;
  onChange: (patch: Partial<OnboardingUpdate>) => void;
}

// Discount settings
const DISCOUNT_PERCENT = 15;
const MAX_ADS_PER_WEEK = 7;

export default function Step4Plan({ data, onChange }: Step4Props) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<DisplayablePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currency, setCurrency] = useState<Currency>(
    (data.selected_currency as Currency) || "GBP"
  );
  const [discountEnabled, setDiscountEnabled] = useState(data.discount_opt_in ?? false);
  const interval: BillingInterval = "monthly"; // Always monthly in wizard
  const selectedPlan = data.selected_plan ?? null;

  // Load plans on mount
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

  const handleCurrencyChange = useCallback(
    (newCurrency: Currency) => {
      setCurrency(newCurrency);
      onChange({ selected_currency: newCurrency });
    },
    [onChange]
  );

  const handleDiscountChange = useCallback(
    (enabled: boolean) => {
      setDiscountEnabled(enabled);
      onChange({ discount_opt_in: enabled });
    },
    [onChange]
  );

  const selectPlan = useCallback(
    (planKey: string) => {
      onChange({
        selected_plan: planKey,
        selected_currency: currency,
        selected_interval: interval,
      });
    },
    [onChange, currency, interval]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {t("onboarding.step4.title")}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {t("onboarding.step4.subtitle")}
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {t("onboarding.step4.title")}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {t("onboarding.step4.subtitle")}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No plans available
          </h3>
          <p className="text-sm text-gray-600">
            Please contact support for assistance.
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
        <p className="text-gray-500 text-sm mt-1">
          {t("onboarding.step4.subtitle")}
        </p>
      </div>

      {/* Discount Toggle */}
      <div className="rounded-lg bg-green-50 border border-green-200 p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={discountEnabled}
            onChange={(e) => handleDiscountChange(e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">
              🎉 Launch Special: {DISCOUNT_PERCENT}% off first 3 months
            </p>
            <p className="mt-1 text-xs text-green-700">
              In exchange, we'll add up to {MAX_ADS_PER_WEEK} non-intrusive ads to your queue per week.
            </p>
          </div>
        </label>
      </div>

      {/* Currency Toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-white p-1">
          {(["GBP", "USD", "EUR"] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => handleCurrencyChange(c)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                currency === c
                  ? "bg-green-600 text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {c === "GBP" ? "£" : c === "USD" ? "$" : "€"} {c}
            </button>
          ))}
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan, index) => {
          const isSelected = selectedPlan === plan.planKey;
          const isPopular = index === 1;

          const price = getPriceForSelection(plan, currency, interval);
          if (!price) return null;

          const baseAmount = price.amountMinor;
          const discountAmount = discountEnabled
            ? Math.round(baseAmount * (DISCOUNT_PERCENT / 100))
            : 0;
          const finalAmount = baseAmount - discountAmount;

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
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
                    Popular
                  </span>
                </div>
              )}

              <h3 className="text-lg font-bold text-gray-900">
                {plan.displayName}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {plan.displayDescription}
              </p>

              <div className="mt-4">
                {discountEnabled && (
                  <div className="mb-1">
                    <span className="text-sm text-gray-400 line-through">
                      {formatPrice(baseAmount, currency)}
                    </span>
                    <span className="ml-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                      Save {DISCOUNT_PERCENT}%
                    </span>
                  </div>
                )}
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-3xl font-bold ${
                      discountEnabled ? "text-green-600" : "text-gray-900"
                    }`}
                  >
                    {formatPrice(finalAmount, currency)}
                  </span>
                  <span className="text-sm text-gray-400">/mo</span>
                </div>
              </div>

              <button
                type="button"
                className={`mt-4 w-full py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  isSelected
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {isSelected ? "Selected" : "Select Plan"}
              </button>

              <ul className="mt-5 flex flex-col gap-2.5 flex-1">
                {plan.displayFeatures.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check
                      className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        isSelected || isPopular ? "text-green-600" : "text-gray-400"
                      }`}
                    />
                    <span className="text-xs text-gray-600">{feature}</span>
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
