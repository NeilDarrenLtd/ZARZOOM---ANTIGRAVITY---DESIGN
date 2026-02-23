"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

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
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-green-200 bg-green-50 p-4">
      <div className="flex items-start gap-3 flex-1">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
          <Info className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900">
              Save {discountPercent}% with Advertising Partnership
            </h3>
            {value && (
              <span className="inline-flex items-center rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Allow ZARZOOM to post promotional content to your feed (max{" "}
            {maxAdsPerWeek === 7 ? "once per day" : `${maxAdsPerWeek}x per week`}) and receive a{" "}
            {discountPercent}% discount on your subscription. You retain full control and can
            disable this anytime.
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
        aria-label="Toggle advertising partnership discount"
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
