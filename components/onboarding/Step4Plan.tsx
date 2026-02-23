"use client";

import { useI18n } from "@/lib/i18n";
import type { OnboardingUpdate } from "@/lib/validation/onboarding";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { getDisplayablePlansClient } from "@/lib/billing/displayable-plans";
import type { DisplayablePlan } from "@/lib/billing/displayable-plans";
import { CurrencyToggle } from "@/components/pricing/currency-toggle";
import { DiscountToggle } from "@/components/pricing/discount-toggle";
import type { Currency } from "@/lib/billing/types";
import { CURRENCIES } from "@/lib/billing/types";
import {
  detectUserCurrency,
  saveCurrencyPreference,
  saveDiscountPreference,
  getDiscountPreference,
} from "@/lib/pricing/geolocation";

interface Step4Props {
  data: OnboardingUpdate;
  onChange: (patch: Partial<OnboardingUpdate>) => void;
  aiFilledFields?: string[];
}

// Advertising partnership discount settings
const DISCOUNT_PERCENT = 15; // 15% discount
const MAX_ADS_PER_WEEK = 7; // Once per day max

export default function Step4Plan({ data, onChange }: Step4Props) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<DisplayablePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [availableCurrencies, setAvailableCurrencies] = useState<Currency[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get current values from onboarding state with defaults
  const selectedPlan = data.selected_plan ?? null;
  const discountEnabled = data.discount_opt_in ?? false;
  const interval = "monthly"; // Always monthly in wizard

  // Fetch displayable plans on mount
  useEffect(() => {
    async function loadPlans() {
      try {
        console.log("[v0] Step4Plan: Loading displayable plans");
        const displayablePlans = await getDisplayablePlansClient(t);
        setPlans(displayablePlans);
        console.log("[v0] Step4Plan: Loaded", displayablePlans.length, "plans");

        // Derive available currencies from plans
        const currencies = new Set<Currency>();
        displayablePlans.forEach((plan) => {
          plan.prices.forEach((price) => {
            if (price.interval === "monthly" && price.isActive) {
              currencies.add(price.currency as Currency);
            }
          });
        });
        const available = CURRENCIES.filter((c) => currencies.has(c));
        setAvailableCurrencies(available);

        // Initialize currency with geolocation or saved preference
        const detectedCurrency = await detectUserCurrency(available);
        const savedCurrency = data.selected_currency;
        setCurrency((savedCurrency as Currency) || detectedCurrency);
        setIsInitialized(true);

        console.log("[v0] Step4Plan: Currency initialized to", savedCurrency || detectedCurrency);
      } catch (err) {
        console.error("[v0] Step4Plan: Failed to load plans:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, [t, data.selected_currency]);

  const handleCurrencyChange = useCallback(
    (newCurrency: Currency) => {
      setCurrency(newCurrency);
      saveCurrencyPreference(newCurrency);
      onChange({
        selected_currency: newCurrency,
      });
      console.log("[v0] Step4Plan: Currency changed to", newCurrency);
    },
    [onChange]
  );

  const handleDiscountChange = useCallback(
    (enabled: boolean) => {
      saveDiscountPreference(enabled);
      onChange({
        discount_opt_in: enabled,
      });
      console.log("[v0] Step4Plan: Discount", enabled ? "enabled" : "disabled");
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
      console.log("[v0] Step4Plan: Selected plan", planKey, currency, interval);
    },
    [onChange, currency, interval]
  );

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

      {/* Discount Toggle */}
      <div className="max-w-3xl mx-auto">
        <DiscountToggle
          value={discountEnabled}
          onChange={handleDiscountChange}
          discountPercent={DISCOUNT_PERCENT}
          maxAdsPerWeek={MAX_ADS_PER_WEEK}
        />
      </div>

      {/* Currency Selector */}
      {isInitialized && availableCurrencies.length > 1 && (
        <div className="flex items-center justify-center">
          <CurrencyToggle
            value={currency}
            onChange={handleCurrencyChange}
            availableCurrencies={availableCurrencies}
          />
        </div>
      )}

      {/* Plan cards - filter by selected currency availability */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans
          .filter((plan) => {
            // Only show plans with prices for selected currency
            const hasPrice = plan.prices.some(
              (p) => p.currency === currency && p.interval === interval && p.isActive
            );
            if (!hasPrice) {
              console.log(`[v0] Step4Plan: Hiding ${plan.planKey} - no ${currency} ${interval} price`);
            }
            return hasPrice;
          })
          .map((plan, index) => {
            const isSelected = selectedPlan === plan.planKey;
            const isPopular = index === 1; // Middle plan (if 3 plans) or second plan

            // Find price for selected currency and interval
            const priceObj = plan.prices.find(
              (p) => p.currency === currency && p.interval === interval && p.isActive
            );

            if (!priceObj) return null;

            // Calculate pricing with discount
            const baseAmount = priceObj.amountMinor;
            const discountAmount = discountEnabled
              ? Math.round(baseAmount * (DISCOUNT_PERCENT / 100))
              : 0;
            const finalAmount = baseAmount - discountAmount;
            const displayPrice = Math.round(finalAmount / 100);
            const originalPrice = Math.round(baseAmount / 100);

            // Get currency symbol
            const currencySymbols: Record<string, string> = {
              GBP: "£",
              USD: "$",
              EUR: "€",
              CAD: "C$",
              AUD: "A$",
            };
            const symbol = currencySymbols[currency] || currency;

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

                {/* Pricing with discount */}
                <div className="mt-4">
                  {discountEnabled && (
                    <div className="mb-1">
                      <span className="text-sm text-gray-400 line-through">
                        {symbol}
                        {originalPrice}
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
                      {symbol}
                      {displayPrice}
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
