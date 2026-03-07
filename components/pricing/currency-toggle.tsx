"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { Currency } from "@/lib/billing/types";

// Comprehensive currency metadata - supports any currency in the database
const CURRENCY_LABELS: Record<string, { symbol: string; label: string; name: string }> = {
  GBP: { symbol: "£", label: "GBP", name: "British Pound" },
  USD: { symbol: "$", label: "USD", name: "US Dollar" },
  EUR: { symbol: "€", label: "EUR", name: "Euro" },
  CAD: { symbol: "C$", label: "CAD", name: "Canadian Dollar" },
  AUD: { symbol: "A$", label: "AUD", name: "Australian Dollar" },
  JPY: { symbol: "¥", label: "JPY", name: "Japanese Yen" },
  INR: { symbol: "₹", label: "INR", name: "Indian Rupee" },
  CNY: { symbol: "¥", label: "CNY", name: "Chinese Yuan" },
  CHF: { symbol: "Fr", label: "CHF", name: "Swiss Franc" },
  SEK: { symbol: "kr", label: "SEK", name: "Swedish Krona" },
  NZD: { symbol: "NZ$", label: "NZD", name: "New Zealand Dollar" },
  SGD: { symbol: "S$", label: "SGD", name: "Singapore Dollar" },
};

function getCurrencyMeta(currency: string) {
  return CURRENCY_LABELS[currency] || { symbol: currency, label: currency, name: currency };
}

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
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-2">
      <label className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
        {t("billing.selectCurrencyLabel")}
      </label>
      <div
        className="inline-flex items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-1"
        role="radiogroup"
        aria-label={t("billing.selectCurrencyLabel")}
      >
        {availableCurrencies.map((currency) => {
          const meta = getCurrencyMeta(currency);
          return (
            <button
              key={currency}
              role="radio"
              aria-checked={value === currency}
              aria-label={`Select ${meta.name}`}
              onClick={() => onChange(currency)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all whitespace-nowrap",
                value === currency
                  ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm ring-1 ring-[hsl(var(--primary)/0.2)]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)]"
              )}
            >
              <span className="font-semibold">{meta.symbol}</span>
              <span className="ml-1.5">{meta.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
