/**
 * PlannerItemPill
 *
 * Compact calendar pill representing a single PlannerItem.
 * Displays: content-type badge, status dot, viral strength dots, and hook text.
 */

"use client";

import {
  TYPE_COLORS,
  TYPE_LABELS,
  STATUS_DOT,
  type PlannerItem,
} from "@/lib/planner/types";

interface PlannerItemPillProps {
  item: PlannerItem;
  isSelected: boolean;
  /** Dimmed when the cell belongs to a non-current month */
  dimmed?: boolean;
  onClick: () => void;
}

function ViralDots({ strength }: { strength: number }) {
  return (
    <span
      className="flex items-center gap-px shrink-0"
      aria-label={`Viral strength ${strength} of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`inline-block h-1 w-1 rounded-full ${
            i <= strength
              ? strength >= 4
                ? "bg-green-500"
                : strength === 3
                ? "bg-amber-400"
                : "bg-gray-400"
              : "bg-gray-200"
          }`}
        />
      ))}
    </span>
  );
}

export default function PlannerItemPill({
  item,
  isSelected,
  dimmed = false,
  onClick,
}: PlannerItemPillProps) {
  const colors = TYPE_COLORS[item.type];
  const label = TYPE_LABELS[item.type];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group w-full text-left rounded-md border px-1.5 py-1
        transition-all hover:shadow-sm
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500
        ${colors}
        ${dimmed ? "opacity-40" : ""}
        ${isSelected ? "ring-2 ring-green-500 ring-offset-1" : ""}
      `}
    >
      {/* Row 1: type badge + status dot + viral dots */}
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="text-[9px] font-semibold uppercase tracking-wide leading-none opacity-75 truncate">
          {label}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[item.status]}`}
            aria-label={item.status.replace("_", " ")}
          />
          <ViralDots strength={item.viralStrength} />
        </div>
      </div>

      {/* Row 2: hook text */}
      <p className="text-[11px] font-medium leading-tight line-clamp-2 group-hover:line-clamp-none transition-all">
        {item.hook}
      </p>
    </button>
  );
}
