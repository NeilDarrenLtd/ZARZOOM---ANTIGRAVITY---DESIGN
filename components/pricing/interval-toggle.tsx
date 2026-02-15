"use client";

import { cn } from "@/lib/utils";
import type { BillingInterval } from "@/lib/billing/types";

interface IntervalToggleProps {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
}

export function IntervalToggle({ value, onChange }: IntervalToggleProps) {
  return (
    <div
      className="inline-flex items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-1"
      role="radiogroup"
      aria-label="Select billing interval"
    >
      <button
        role="radio"
        aria-checked={value === "monthly"}
        onClick={() => onChange("monthly")}
        className={cn(
          "rounded-full px-5 py-1.5 text-sm font-medium transition-all",
          value === "monthly"
            ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
            : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        )}
      >
        Monthly
      </button>
      <button
        role="radio"
        aria-checked={value === "annual"}
        onClick={() => onChange("annual")}
        className={cn(
          "relative rounded-full px-5 py-1.5 text-sm font-medium transition-all",
          value === "annual"
            ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm"
            : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        )}
      >
        Annual
        <span className="ml-1.5 inline-block rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-xs font-semibold text-[hsl(var(--accent-foreground))]">
          Save 17%
        </span>
      </button>
    </div>
  );
}
