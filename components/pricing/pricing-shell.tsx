"use client";

import { useState, useEffect, useCallback } from "react";
import { CurrencyToggle } from "./currency-toggle";
import { IntervalToggle } from "./interval-toggle";
import { PlanCard } from "./plan-card";
import type { Currency, BillingInterval } from "@/lib/billing/types";
import type { DisplayablePlan } from "@/lib/billing/displayable-plans";
import { CURRENCIES } from "@/lib/billing/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PricingShellProps {
  plans: DisplayablePlan[];
  isLoggedIn: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "zarzoom_currency";

function getSavedCurrency(available: Currency[]): Currency {
  if (typeof window === "undefined") return "GBP";
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Currency | null;
    if (saved && available.includes(saved)) return saved;
  } catch {
    /* localStorage unavailable */
  }
  return "GBP";
}

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
  
  const [currency, setCurrency] = useState<Currency>("GBP");
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  /* Hydrate from localStorage after mount */
  useEffect(() => {
    setCurrency(getSavedCurrency(availableCurrencies));
  }, [availableCurrencies]);

  const handleCurrencyChange = useCallback(
    (c: Currency) => {
      setCurrency(c);
      try {
        localStorage.setItem(STORAGE_KEY, c);
      } catch {
        /* noop */
      }
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

      {/* Controls */}
      <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
        <IntervalToggle value={interval} onChange={setInterval} />
        <CurrencyToggle
          value={currency}
          onChange={handleCurrencyChange}
          availableCurrencies={availableCurrencies}
        />
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {plans.map((plan) => (
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
            interval={interval}
            isLoggedIn={isLoggedIn}
            cta={plan.copy.cta}
            onChoosePlan={(priceId) => {
              if (checkoutLoading) return;
              handleChoosePlan(priceId);
            }}
          />
        ))}
      </div>

      {/* Trust footnote */}
      <p className="mt-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
        All prices exclude VAT where applicable. Cancel or change your plan at
        any time.
      </p>
    </section>
  );
}
