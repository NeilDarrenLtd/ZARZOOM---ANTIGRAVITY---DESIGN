"use client";

import { useState, useEffect, useCallback } from "react";
import { CurrencyToggle } from "./currency-toggle";
import { DiscountToggle } from "./discount-toggle";
import { PlanCard } from "./plan-card";
import type { Currency } from "@/lib/billing/types";
import type { DisplayablePlan } from "@/lib/billing/displayable-plans";
import { CURRENCIES } from "@/lib/billing/types";
import {
  detectUserCurrency,
  saveCurrencyPreference,
  saveDiscountPreference,
  getDiscountPreference,
} from "@/lib/pricing/geolocation";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PricingShellProps {
  plans: DisplayablePlan[];
  isLoggedIn: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

// Advertising partnership discount settings
const DISCOUNT_PERCENT = 15; // 15% discount
const MAX_ADS_PER_WEEK = 7; // Once per day

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function deriveAvailableCurrencies(plans: DisplayablePlan[]): Currency[] {
  const seen = new Set<Currency>();
  for (const plan of plans) {
    for (const price of plan.prices) {
      seen.add(price.currency as Currency);
    }
  }
  return CURRENCIES.filter((c) => seen.has(c));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PricingShell({
  plans,
  isLoggedIn,
}: PricingShellProps) {
  // Derive available currencies from plan prices
  const availableCurrencies = deriveAvailableCurrencies(plans);
  
  const [currency, setCurrency] = useState<Currency>("USD");
  const [discountEnabled, setDiscountEnabled] = useState<boolean>(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  /* Initialize currency with geolocation detection */
  useEffect(() => {
    async function initializeCurrency() {
      const detectedCurrency = await detectUserCurrency(availableCurrencies);
      setCurrency(detectedCurrency);
      
      // Load discount preference
      const savedDiscount = getDiscountPreference();
      setDiscountEnabled(savedDiscount);
      
      setIsInitialized(true);
      console.log("[v0] Initialized pricing with currency:", detectedCurrency, "discount:", savedDiscount);
    }
    
    if (availableCurrencies.length > 0) {
      initializeCurrency();
    }
  }, [availableCurrencies]);

  const handleCurrencyChange = useCallback(
    (c: Currency) => {
      setCurrency(c);
      saveCurrencyPreference(c);
    },
    []
  );
  
  const handleDiscountChange = useCallback(
    (enabled: boolean) => {
      setDiscountEnabled(enabled);
      saveDiscountPreference(enabled);
    },
    []
  );

  const handleChoosePlan = useCallback(
    async (priceId: string) => {
      setCheckoutLoading(priceId);
      try {
        const res = await fetch("/api/v1/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ price_id: priceId }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error ?? "Failed to create checkout session"
          );
        }

        const data = (await res.json()) as { url?: string };
        if (data.url) {
          window.location.href = data.url;
        }
      } catch {
        /* In production, show a toast or error banner */
      } finally {
        setCheckoutLoading(null);
      }
    },
    []
  );

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-5xl">
          Plans and Pricing
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">
          Choose the plan that fits your social media workflow. Upgrade or
          downgrade at any time.
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
      <div className="mb-12 flex items-center justify-center">
        <CurrencyToggle
          value={currency}
          onChange={handleCurrencyChange}
          availableCurrencies={availableCurrencies}
        />
      </div>

      {/* Plan Cards - filter out plans without prices for selected currency */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {plans
          .filter((plan) => {
            // Only show plan if it has a price for selected currency
            const hasPrice = plan.prices.some(
              (p) => p.currency === currency && p.interval === "monthly" && p.isActive
            );
            if (!hasPrice) {
              console.log(`[v0] Hiding plan ${plan.planKey} - no ${currency} monthly price available`);
            }
            return hasPrice;
          })
          .map((plan) => {
            // Calculate discounted price if enabled
            const basePrice = plan.prices.find(
              (p) => p.currency === currency && p.interval === "monthly" && p.isActive
            );
            
            return (
              <PlanCard
                key={plan.planKey}
                name={plan.copy.displayName}
                slug={plan.planKey}
                description={plan.copy.description}
                tagline={plan.copy.shortTagline}
                features={plan.copy.bullets}
                prices={plan.prices}
                highlight={plan.sortOrder === 2} // Middle plan
                currency={currency}
                interval="monthly"
                isLoggedIn={isLoggedIn}
                cta={plan.copy.cta}
                discountPercent={discountEnabled ? DISCOUNT_PERCENT : 0}
                onChoosePlan={(priceId) => {
                  if (checkoutLoading) return;
                  handleChoosePlan(priceId);
                }}
              />
            );
          })}
      </div>

      {/* Trust footnote */}
      <p className="mt-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
        All prices exclude VAT where applicable. Cancel or change your plan at
        any time.
      </p>
    </section>
  );
}
