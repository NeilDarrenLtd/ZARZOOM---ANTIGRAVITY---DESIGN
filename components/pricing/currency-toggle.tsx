"use client";

import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/billing/types";

const CURRENCY_LABELS: Record<Currency, { symbol: string; label: string }> = {
  GBP: { symbol: "\u00A3", label: "GBP" },
  USD: { symbol: "$", label: "USD" },
  EUR: { symbol: "\u20AC", label: "EUR" },
};

interface CurrencyToggleProps {
  value: Currency;
  onChange: (currency: Currency) => void;
  availableCurrencies: Currency[];
}

export function CurrencyToggle({
  value,
  onChange,
  availableCurrencies,
}: CurrencyToggleProps) {
  return (
    <div
      className="inline-flex items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-1"
      role="radiogroup"
      aria-label="Select currency"
    >
      {availableCurrencies.map((currency) => (
        <button
          key={currency}
          role="radio"
          aria-checked={value === currency}
          onClick={() => onChange(currency)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
            value === currency
              ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          )}
        >
          {CURRENCY_LABELS[currency].symbol} {CURRENCY_LABELS[currency].label}
        </button>
      ))}
    </div>
  );
}
