/**
 * PlannerCalendar
 *
 * Full monthly calendar grid. Renders a 7-column week layout with
 * leading/trailing overflow cells for the previous and next months.
 *
 * Props:
 *   currentDate   – controls which month is displayed
 *   itemsByDate   – Record<ISODateString, PlannerItem[]> from usePlannerItems
 *   selectedItem  – currently selected item (highlighted with ring)
 *   onSelectItem  – callback when a pill or overflow button is clicked
 */

"use client";

import PlannerDayCell from "./PlannerDayCell";
import type { PlannerItem } from "@/lib/planner/types";

interface PlannerCalendarProps {
  currentDate: Date;
  itemsByDate: Record<string, PlannerItem[]>;
  selectedItem: PlannerItem | null;
  onSelectItem: (item: PlannerItem) => void;
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Grid builder ───────────────────────────────────────────────────────────────

interface GridCell {
  year: number;
  month: number;
  day: number;
  isCurrentMonth: boolean;
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildGrid(year: number, month: number): GridCell[][] {
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;

  const cells: GridCell[] = [];

  // Leading overflow (prev month)
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({
      year: prevYear,
      month: prevMonth,
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ year, month, day: d, isCurrentMonth: true });
  }

  // Trailing overflow (next month)
  const remainder = cells.length % 7;
  const trailingCount = remainder === 0 ? 0 : 7 - remainder;
  for (let d = 1; d <= trailingCount; d++) {
    cells.push({ year: nextYear, month: nextMonth, day: d, isCurrentMonth: false });
  }

  // Split into weeks
  const weeks: GridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlannerCalendar({
  currentDate,
  itemsByDate,
  selectedItem,
  onSelectItem,
}: PlannerCalendarProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const today = new Date();
  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  const weeks = buildGrid(year, month);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/60">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div>
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className={`grid grid-cols-7 ${wi < weeks.length - 1 ? "border-b border-gray-100" : ""}`}
          >
            {week.map((cell, ci) => {
              const iso = toISO(cell.year, cell.month, cell.day);
              return (
                <PlannerDayCell
                  key={iso}
                  day={cell.day}
                  iso={iso}
                  isCurrentMonth={cell.isCurrentMonth}
                  isToday={iso === todayISO}
                  hasBorderRight={ci < 6}
                  items={itemsByDate[iso] ?? []}
                  selectedItem={selectedItem}
                  onSelectItem={onSelectItem}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
