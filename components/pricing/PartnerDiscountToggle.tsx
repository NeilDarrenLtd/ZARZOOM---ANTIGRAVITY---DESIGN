"use client";

import { useI18n } from "@/lib/i18n";

interface PartnerDiscountToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function PartnerDiscountToggle({ enabled, onChange }: PartnerDiscountToggleProps) {
  const { t } = useI18n();
  return (
    <div className="w-64 grid grid-rows-[auto_auto_auto] gap-3">
      {/* Title - Row 1 */}
      <h3 className="text-sm font-semibold text-gray-900">
        {t("billing.partnerDiscountEnable")}
      </h3>

      {/* Toggle Buttons - Row 2 */}
      <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-white p-1 w-fit">
        <button
          onClick={() => onChange(true)}
          className={`rounded-md px-6 py-2 text-sm font-medium transition-colors ${
            enabled
              ? "bg-green-600 text-white"
              : "text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          {t("billing.partnerDiscount50Off")}
        </button>
        <button
          onClick={() => onChange(false)}
          className={`rounded-md px-6 py-2 text-sm font-medium transition-colors ${
            !enabled
              ? "bg-green-600 text-white"
              : "text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          {t("billing.partnerDiscountStandardPrice")}
        </button>
      </div>

      {/* Subheading - Row 3 */}
      <p className="text-xs text-gray-600 leading-relaxed">
        {t("billing.partnerDiscountSubheading")}
      </p>
    </div>
  );
}
