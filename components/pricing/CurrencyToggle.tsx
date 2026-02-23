"use client";

import type { Currency } from "@/lib/billing/api-types";
import { usePricing } from "./PricingProvider";

const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: "GBP", label: "GBP", symbol: "£" },
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
];

export function CurrencyToggle() {
  const { currency, setCurrency } = usePricing();

  return (
    <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-white p-1">
      {CURRENCY_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => setCurrency(option.value)}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            currency === option.value
              ? "bg-green-600 text-white"
              : "text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          {option.symbol} {option.label}
        </button>
      ))}
    </div>
  );
}
