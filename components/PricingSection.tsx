"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import type { Currency } from "@/lib/billing/types";
import { CURRENCIES } from "@/lib/billing/types";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { getDisplayablePlansClient } from "@/lib/billing/displayable-plans";
import type { DisplayablePlan } from "@/lib/billing/displayable-plans";
import { CurrencyToggle } from "@/components/pricing/currency-toggle";
import { DiscountToggle } from "@/components/pricing/discount-toggle";
import {
  detectUserCurrency,
  saveCurrencyPreference,
  saveDiscountPreference,
  getDiscountPreference,
} from "@/lib/pricing/geolocation";

// Advertising partnership discount settings
const DISCOUNT_PERCENT = 15; // 15% discount
const MAX_ADS_PER_WEEK = 7; // Once per day max

interface PricingSectionProps {
  /** Pre-selected plan from wizard (optional) */
  selectedPlanKey?: string;
  /** Pre-selected currency from wizard (optional) */
  selectedCurrency?: string;
  /** Whether discount was enabled in wizard (optional) */
  discountEnabled?: boolean;
}

export default function PricingSection({
  selectedPlanKey,
  selectedCurrency,
  discountEnabled: initialDiscountEnabled = false,
}: PricingSectionProps = {}) {
  const { t } = useI18n();
  
  // State
  const [plans, setPlans] = useState<DisplayablePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [discountEnabled, setDiscountEnabled] = useState(initialDiscountEnabled);
  const [availableCurrencies, setAvailableCurrencies] = useState<Currency[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activePlan, setActivePlan] = useState<string | null>(selectedPlanKey || null);

  console.log("[v0] PricingSection: Rendering with selectedPlanKey:", selectedPlanKey, "currency:", selectedCurrency);

  // Fetch displayable plans on mount
  useEffect(() => {
    async function loadPlans() {
      try {
        console.log("[v0] PricingSection: Loading displayable plans");
        const displayablePlans = await getDisplayablePlansClient(t);
        setPlans(displayablePlans);
        console.log("[v0] PricingSection: Loaded", displayablePlans.length, "plans");

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

        // Initialize currency with wizard selection, geolocation, or saved preference
        let initialCurrency: Currency;
        if (selectedCurrency && available.includes(selectedCurrency as Currency)) {
          initialCurrency = selectedCurrency as Currency;
          console.log("[v0] PricingSection: Using wizard-selected currency:", selectedCurrency);
        } else {
          initialCurrency = await detectUserCurrency(available);
          console.log("[v0] PricingSection: Detected currency:", initialCurrency);
        }
        setCurrency(initialCurrency);

        // Load discount preference
        const savedDiscount = getDiscountPreference();
        setDiscountEnabled(initialDiscountEnabled || savedDiscount);

        setIsInitialized(true);
      } catch (err) {
        console.error("[v0] PricingSection: Failed to load plans:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, [t, selectedCurrency, initialDiscountEnabled]);

  const handleCurrencyChange = useCallback(
    (newCurrency: Currency) => {
      setCurrency(newCurrency);
      saveCurrencyPreference(newCurrency);
      console.log("[v0] PricingSection: Currency changed to", newCurrency);
    },
    []
  );

  const handleDiscountChange = useCallback(
    (enabled: boolean) => {
      setDiscountEnabled(enabled);
      saveDiscountPreference(enabled);
      console.log("[v0] PricingSection: Discount", enabled ? "enabled" : "disabled");
    },
    []
  );

  const handleSelectPlan = useCallback((planKey: string) => {
    setActivePlan(planKey);
    console.log("[v0] PricingSection: Plan selected:", planKey);
  }, []);

  // Loading state
  if (loading) {
    return (
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl text-balance">
              {t("billing.pricing.title")}
            </h2>
            <p className="mt-3 text-gray-500 text-base max-w-xl mx-auto leading-relaxed text-pretty">
              {t("billing.pricing.subtitle")}
            </p>
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
          </div>
        </div>
      </section>
    );
  }

  // Error or no plans available
  if (error || plans.length === 0) {
    return (
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl text-balance">
              {t("billing.pricing.title")}
            </h2>
            <p className="mt-3 text-gray-500 text-base max-w-xl mx-auto leading-relaxed text-pretty">
              {t("billing.pricing.subtitle")}
            </p>
          </div>
          <div className="max-w-2xl mx-auto">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
              <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {t("pricing.fallback.title")}
              </h3>
              <p className="text-gray-600">
                {t("pricing.fallback.message")}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl text-balance">
            {t("billing.pricing.title")}
          </h2>
          <p className="mt-3 text-gray-500 text-base max-w-xl mx-auto leading-relaxed text-pretty">
            {t("billing.pricing.subtitle")}
          </p>
        </div>

        {/* Discount Toggle */}
        <div className="mb-8 max-w-3xl mx-auto">
          <DiscountToggle
            value={discountEnabled}
            onChange={handleDiscountChange}
            discountPercent={DISCOUNT_PERCENT}
            maxAdsPerWeek={MAX_ADS_PER_WEEK}
          />
        </div>

        {/* Currency Selector */}
        {isInitialized && availableCurrencies.length > 1 && (
          <div className="mb-12 flex items-center justify-center">
            <CurrencyToggle
              value={currency}
              onChange={handleCurrencyChange}
              availableCurrencies={availableCurrencies}
            />
          </div>
        )}

        {/* Plan Cards - filter by selected currency availability */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans
            .filter((plan) => {
              // Only show plans with prices for selected currency
              const hasPrice = plan.prices.some(
                (p) => p.currency === currency && p.interval === "monthly" && p.isActive
              );
              if (!hasPrice) {
                console.log(`[v0] PricingSection: Hiding ${plan.planKey} - no ${currency} monthly price`);
              }
              return hasPrice;
            })
            .map((plan, index) => {
              const isSelected = activePlan === plan.planKey;
              const isHighlight = index === 1; // Middle plan

              // Find price for selected currency
              const priceObj = plan.prices.find(
                (p) => p.currency === currency && p.interval === "monthly" && p.isActive
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
                  className={`relative rounded-2xl border p-8 flex flex-col transition-all ${
                    isSelected
                      ? "border-green-500 bg-white shadow-xl ring-2 ring-green-500/30"
                      : isHighlight
                        ? "border-green-300 bg-white shadow-lg ring-1 ring-green-500/20"
                        : "border-gray-200 bg-white"
                  }`}
                >
                  {/* Badge */}
                  {isHighlight && !isSelected && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-green-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                        {t("billing.pricing.popular")}
                      </span>
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                        Selected in Wizard
                      </span>
                    </div>
                  )}

                  {/* Plan Name */}
                  <h3 className="text-lg font-bold text-gray-900">
                    {plan.copy.displayName}
                  </h3>
                  {plan.copy.shortTagline && (
                    <p className="text-xs font-medium text-green-600 mt-1">
                      {plan.copy.shortTagline}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    {plan.copy.description}
                  </p>

                  {/* Pricing with discount */}
                  <div className="mt-6 mb-4">
                    {discountEnabled && (
                      <div className="mb-1">
                        <span className="text-base text-gray-400 line-through">
                          {symbol}
                          {originalPrice}
                        </span>
                        <span className="ml-2 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                          Save {DISCOUNT_PERCENT}%
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-4xl font-bold ${
                          discountEnabled ? "text-green-600" : "text-gray-900"
                        }`}
                      >
                        {symbol}
                        {displayPrice}
                      </span>
                      <span className="text-sm text-gray-400">/month</span>
                    </div>
                    {discountEnabled && (
                      <p className="mt-1 text-xs text-green-600 font-medium">
                        Advertising partnership discount applied
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleSelectPlan(plan.planKey)}
                    className={`w-full py-3 rounded-lg text-sm font-bold text-center transition-colors mb-6 ${
                      isSelected
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : isHighlight
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-gray-900 text-white hover:bg-gray-800"
                    }`}
                  >
                    {isSelected
                      ? t("profile.plan.changePlan")
                      : plan.copy.cta || t("billing.pricing.getStarted")}
                  </button>

                  {/* Features */}
                  <ul className="flex flex-col gap-3 flex-1">
                    {plan.copy.bullets.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <Check
                          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            isSelected || isHighlight ? "text-green-600" : "text-gray-400"
                          }`}
                        />
                        <span className="text-sm text-gray-600 leading-relaxed">
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
    </section>
  );
}
