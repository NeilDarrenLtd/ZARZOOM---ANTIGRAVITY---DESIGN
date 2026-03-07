"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface DiscountToggleProps {
  value: boolean;
  onChange: (enabled: boolean) => void;
  discountPercent: number;
  maxAdsPerWeek: number;
}

export function DiscountToggle({
  value,
  onChange,
  discountPercent,
  maxAdsPerWeek,
}: DiscountToggleProps) {
  const { t } = useI18n();
  const maxFrequency = maxAdsPerWeek === 7 ? t("billing.discountOncePerDay") : t("billing.discountPerWeek").replace("{count}", String(maxAdsPerWeek));
  const description = t("billing.discountPartnershipDescription").replace("{maxFrequency}", maxFrequency).replace("{percent}", String(discountPercent));
  const title = t("billing.discountPartnershipTitle").replace("{percent}", String(discountPercent));
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-green-200 bg-green-50 p-4">
      <div className="flex items-start gap-3 flex-1">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
          <Info className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900">
              {title}
            </h3>
            {value && (
              <span className="inline-flex items-center rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">
                {t("billing.discountActive")}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <button
        onClick={() => onChange(!value)}
        className={cn(
          "relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2",
          value ? "bg-green-600" : "bg-gray-300"
        )}
        role="switch"
        aria-checked={value}
        aria-label={t("billing.toggleDiscount")}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
            value ? "translate-x-6" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}
