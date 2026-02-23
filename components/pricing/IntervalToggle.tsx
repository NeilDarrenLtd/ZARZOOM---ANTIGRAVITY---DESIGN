"use client";

import type { BillingInterval } from "@/lib/billing/api-types";

interface IntervalToggleProps {
  interval: BillingInterval;
  onChange: (interval: BillingInterval) => void;
}

export function IntervalToggle({ interval, onChange }: IntervalToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-white p-1">
      <button
        onClick={() => onChange("monthly")}
        className={`rounded-md px-6 py-2 text-sm font-medium transition-colors ${
          interval === "monthly"
            ? "bg-green-600 text-white"
            : "text-zinc-700 hover:bg-zinc-100"
        }`}
      >
        Monthly
      </button>
      <button
        onClick={() => onChange("annual")}
        className={`rounded-md px-6 py-2 text-sm font-medium transition-colors ${
          interval === "annual"
            ? "bg-green-600 text-white"
            : "text-zinc-700 hover:bg-zinc-100"
        }`}
      >
        <span>Annual</span>
        <span className="ml-2 text-xs">(Save 20%)</span>
      </button>
    </div>
  );
}
