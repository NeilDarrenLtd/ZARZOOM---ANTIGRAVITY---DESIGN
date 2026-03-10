/**
 * PlannerDayCell
 *
 * A single day cell in the PlannerCalendar grid.
 * Renders the day number, up to MAX_VISIBLE item pills, and an overflow button.
 */

"use client";

import PlannerItemPill from "./PlannerItemPill";
import type { PlannerItem } from "@/lib/planner/types";

interface PlannerDayCellProps {
  day: number;
  iso: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  /** Right-border is suppressed for the last cell in a row */
  hasBorderRight: boolean;
  items: PlannerItem[];
  selectedItem: PlannerItem | null;
  onSelectItem: (item: PlannerItem) => void;
}

const MAX_VISIBLE = 2;

export default function PlannerDayCell({
  day,
  iso,
  isCurrentMonth,
  isToday,
  hasBorderRight,
  items,
  selectedItem,
  onSelectItem,
}: PlannerDayCellProps) {
  const visible = items.slice(0, MAX_VISIBLE);
  const overflow = items.length - MAX_VISIBLE;
  const isOther = !isCurrentMonth;

  return (
    <div
      className={`
        min-h-[130px] p-2 flex flex-col gap-1
        ${hasBorderRight ? "border-r border-gray-100" : ""}
        ${isOther
          ? "bg-gray-50/60"
          : "bg-white hover:bg-gray-50/30 transition-colors"}
      `}
    >
      {/* Day number */}
      <div className="mb-0.5">
        <span
          className={`
            inline-flex h-6 w-6 items-center justify-center
            rounded-full text-xs font-semibold transition-colors
            ${isToday
              ? "bg-green-600 text-white"
              : isOther
              ? "text-gray-300"
              : "text-gray-700"}
          `}
        >
          {day}
        </span>
      </div>

      {/* Visible item pills */}
      {visible.map((item) => (
        <PlannerItemPill
          key={item.id}
          item={item}
          isSelected={selectedItem?.id === item.id}
          dimmed={isOther}
          onClick={() => onSelectItem(item)}
        />
      ))}

      {/* Overflow indicator */}
      {overflow > 0 && (
        <button
          type="button"
          onClick={() => onSelectItem(items[MAX_VISIBLE])}
          className={`text-left text-[10px] font-medium px-1 hover:text-green-600 transition-colors ${
            isOther ? "text-gray-300" : "text-gray-400"
          }`}
        >
          +{overflow} more
        </button>
      )}
    </div>
  );
}
