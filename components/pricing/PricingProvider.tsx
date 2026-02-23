"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import type { DisplayablePlan } from "@/lib/pricing";
import { fetchPlans, getDisplayablePlans } from "@/lib/pricing";
import { useI18n } from "@/lib/i18n";

interface PricingContextValue {
  plans: DisplayablePlan[];
  isLoading: boolean;
  currency: Currency;
  interval: BillingInterval;
  setCurrency: (currency: Currency) => void;
  setInterval: (interval: BillingInterval) => void;
}

const PricingContext = createContext<PricingContextValue | null>(null);

interface PricingProviderProps {
  children: ReactNode;
  defaultCurrency?: Currency;
  defaultInterval?: BillingInterval;
}

export function PricingProvider({
  children,
  defaultCurrency = "GBP",
  defaultInterval = "monthly",
}: PricingProviderProps) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<DisplayablePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [interval, setInterval] = useState<BillingInterval>(defaultInterval);

  useEffect(() => {
    let mounted = true;

    async function loadPlans() {
      try {
        setIsLoading(true);
        const response = await fetchPlans();
        
        if (!mounted) return;

        const displayable = getDisplayablePlans(response.plans, t);
        setPlans(displayable);
      } catch (error) {
        console.error("[v0] Failed to load pricing plans:", error);
        if (mounted) {
          setPlans([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadPlans();

    return () => {
      mounted = false;
    };
  }, [t]);

  return (
    <PricingContext.Provider
      value={{
        plans,
        isLoading,
        currency,
        interval,
        setCurrency,
        setInterval,
      }}
    >
      {children}
    </PricingContext.Provider>
  );
}

export function usePricing() {
  const context = useContext(PricingContext);
  
  if (!context) {
    throw new Error("usePricing must be used within PricingProvider");
  }
  
  return context;
}
