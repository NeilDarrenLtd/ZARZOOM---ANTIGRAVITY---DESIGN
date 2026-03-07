"use client";

import type { Currency } from "@/lib/billing/api-types";
import { useI18n } from "@/lib/i18n";

const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: "GBP", label: "GBP", symbol: "£" },
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
];

interface CurrencyToggleProps {
  currency: Currency;
  onChange: (currency: Currency) => void;
}

export function CurrencyToggle({ currency, onChange }: CurrencyToggleProps) {
  const { t } = useI18n();
  return (
    <div className="w-64 grid grid-rows-[auto_auto_auto] gap-3">
      {/* Title - Row 1 */}
      <h3 className="text-sm font-semibold text-gray-900">
        {t("billing.selectCurrencyLabel")}
      </h3>

      {/* Toggle Buttons - Row 2 */}
      <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-white p-1 w-fit">
        {CURRENCY_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
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

      {/* Subheading - Row 3 */}
      <p className="text-xs text-gray-600 leading-relaxed">
        {t("billing.selectCurrencyHelp")}
      </p>
    </div>
  );
}
