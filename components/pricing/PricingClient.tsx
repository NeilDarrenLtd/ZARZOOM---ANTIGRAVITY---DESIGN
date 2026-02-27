"use client";

import { useState, type ReactNode } from "react";
import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import type { DisplayablePlan } from "@/lib/pricing";
import { CurrencyToggle } from "./CurrencyToggle";
import { PartnerDiscountToggle } from "./PartnerDiscountToggle";
import { PricingGrid } from "./PricingGrid";
import { PricingDiagnostics } from "./PricingDiagnostics";

interface PricingClientProps {
  plans: DisplayablePlan[];
  defaultCurrency?: Currency;
  defaultInterval?: BillingInterval;
  defaultDiscount?: boolean;
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
  defaultDiscount = false,
  showCurrencyToggle = true,
  showIntervalToggle = true,
  onChoosePlan,
  selectedPlanKey,
  customHeader,
}: PricingClientProps) {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [discountEnabled, setDiscountEnabled] = useState(defaultDiscount);
  const interval: BillingInterval = defaultInterval;

  // Development-only logging
  if (process.env.NODE_ENV === "development") {
    console.log("[v0] 🎨 PricingClient - Render state:");
    console.log(`[v0]   - Plans received: ${plans.length}`);
    console.log(`[v0]   - Selected currency: ${currency}`);
    console.log(`[v0]   - Selected interval: ${interval}`);
    console.log(`[v0]   - Selected plan key: ${selectedPlanKey || 'none'}`);
  }

  return (
    <>
      <div className="space-y-8">
        {/* Custom Header (optional) */}
        {customHeader}

        {/* Controls */}
        {(showCurrencyToggle || showIntervalToggle) && (
          <div className="flex flex-col items-center justify-center gap-8 md:flex-row">
            {showCurrencyToggle && (
              <div className="w-full md:w-auto">
                <CurrencyToggle currency={currency} onChange={setCurrency} />
              </div>
            )}
            {showIntervalToggle && (
              <div className="w-full md:w-auto">
                <PartnerDiscountToggle 
                  enabled={discountEnabled} 
                  onChange={setDiscountEnabled} 
                />
              </div>
            )}
          </div>
        )}

        {/* Plans Grid */}
        <PricingGrid
          plans={plans}
          currency={currency}
          interval={interval}
          discountEnabled={discountEnabled}
          onChoosePlan={onChoosePlan}
          selectedPlanKey={selectedPlanKey}
        />
      </div>

      {/* Development Diagnostics - Only render with explicit query param */}
      {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugPricing") === "1" && (
        <PricingDiagnostics
          plans={plans}
          currency={currency}
          interval={interval}
          selectedPlanKey={selectedPlanKey}
        />
      )}
    </>
  );
}
