"use client";

interface PartnerDiscountToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function PartnerDiscountToggle({ enabled, onChange }: PartnerDiscountToggleProps) {
  return (
    <div className="w-full grid grid-rows-[auto_auto_auto] gap-3">
      {/* Title - Row 1 */}
      <h3 className="text-sm font-semibold text-gray-900">
        Enable 50% Partner Discount
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
          50% OFF
        </button>
        <button
          onClick={() => onChange(false)}
          className={`rounded-md px-6 py-2 text-sm font-medium transition-colors ${
            !enabled
              ? "bg-green-600 text-white"
              : "text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          Standard Price
        </button>
      </div>

      {/* Subheading - Row 3 */}
      <p className="text-xs text-gray-600 leading-relaxed">
        Save 50%. We may publish up to 1 small ZARZOOM promo per day (max 3–7 weekly) — never on your own posts.
      </p>
    </div>
  );
}
