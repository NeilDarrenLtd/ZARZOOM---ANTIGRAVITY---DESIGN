"use client";

import { useState, type ReactNode } from "react";
import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import type { DisplayablePlan } from "@/lib/pricing";
import { CurrencyToggle } from "./CurrencyToggle";
import { IntervalToggle } from "./IntervalToggle";
import { PricingGrid } from "./PricingGrid";

interface PricingClientProps {
  plans: DisplayablePlan[];
  defaultCurrency?: Currency;
  defaultInterval?: BillingInterval;
  showCurrencyToggle?: boolean;
  showIntervalToggle?: boolean;
  onChoosePlan?: (planKey: string, priceId: string) => void;
  selectedPlanKey?: string;
  customHeader?: ReactNode;
}

export function PricingClient({
  plans,
  defaultCurrency = "GBP",
  defaultInterval = "monthly",
  showCurrencyToggle = true,
  showIntervalToggle = true,
  onChoosePlan,
  selectedPlanKey,
  customHeader,
}: PricingClientProps) {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [interval, setInterval] = useState<BillingInterval>(defaultInterval);

  return (
    <div className="space-y-8">
      {/* Custom Header (optional) */}
      {customHeader}

      {/* Controls */}
      {(showCurrencyToggle || showIntervalToggle) && (
        <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
          {showCurrencyToggle && (
            <CurrencyToggle currency={currency} onChange={setCurrency} />
          )}
          {showIntervalToggle && (
            <IntervalToggle interval={interval} onChange={setInterval} />
          )}
        </div>
      )}

      {/* Plans Grid */}
      <PricingGrid
        plans={plans}
        currency={currency}
        interval={interval}
        onChoosePlan={onChoosePlan}
        selectedPlanKey={selectedPlanKey}
      />
    </div>
  );
}
