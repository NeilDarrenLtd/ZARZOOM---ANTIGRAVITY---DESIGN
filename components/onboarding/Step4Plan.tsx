"use client";

import { useState, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import type { OnboardingUpdate } from "@/lib/validation/onboarding";
import { Check, AlertCircle } from "lucide-react";
import { PricingProvider, usePricing } from "@/components/pricing/PricingProvider";
import { CurrencyToggle } from "@/components/pricing/CurrencyToggle";
import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import { getPriceForSelection } from "@/lib/pricing";
import { formatPrice } from "@/lib/billing/format";
import { DiscountToggle } from "@/components/pricing/discount-toggle";
import {
  detectUserCurrency,
  saveCurrencyPreference,
  saveDiscountPreference,
} from "@/lib/pricing/geolocation";

interface Step4Props {
  data: OnboardingUpdate;
  onChange: (patch: Partial<OnboardingUpdate>) => void;
  aiFilledFields?: string[];
}

// Discount settings
const DISCOUNT_PERCENT = 15;
const MAX_ADS_PER_WEEK = 7;

function Step4PlanContent({ data, onChange }: Step4Props) {
  const { t } = useI18n();
  const { plans, isLoading, currency, setCurrency } = usePricing();
  const [discountEnabled, setDiscountEnabled] = useState(data.discount_opt_in ?? false);
  const interval: BillingInterval = "monthly"; // Always monthly in wizard
  const selectedPlan = data.selected_plan ?? null;

  // Initialize currency from saved preference or geolocation
  useEffect(() => {
    async function initCurrency() {
      if (data.selected_currency) {
        setCurrency(data.selected_currency as Currency);
      } else {
        const detected = await detectUserCurrency(["GBP", "USD", "EUR"]);
        setCurrency(detected);
        onChange({ selected_currency: detected });
      }
    }
    initCurrency();
  }, [data.selected_currency, setCurrency, onChange]);

  const handleCurrencyChange = useCallback(
    (newCurrency: Currency) => {
      setCurrency(newCurrency);
      saveCurrencyPreference(newCurrency);
      onChange({ selected_currency: newCurrency });
    },
    [setCurrency, onChange]
  );

  const handleDiscountChange = useCallback(
    (enabled: boolean) => {
      setDiscountEnabled(enabled);
      saveDiscountPreference(enabled);
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
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
            {t("pricing.fallback.title")}
          </h3>
          <p className="text-sm text-gray-600">{t("pricing.fallback.message")}</p>
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
      <div className="max-w-3xl mx-auto">
        <DiscountToggle
          value={discountEnabled}
          onChange={handleDiscountChange}
          discountPercent={DISCOUNT_PERCENT}
          maxAdsPerWeek={MAX_ADS_PER_WEEK}
        />
      </div>

      {/* Currency Toggle */}
      <div className="flex items-center justify-center">
        <CurrencyToggle />
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
                    {t("onboarding.step4.popular")}
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
                  <span className="text-sm text-gray-400">
                    {t("onboarding.step4.perMonth")}
                  </span>
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
                {isSelected
                  ? t("onboarding.step4.selected")
                  : t("onboarding.step4.selectPlan")}
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

export default function Step4Plan(props: Step4Props) {
  return (
    <PricingProvider defaultCurrency="GBP" defaultInterval="monthly">
      <Step4PlanContent {...props} />
    </PricingProvider>
  );
}
