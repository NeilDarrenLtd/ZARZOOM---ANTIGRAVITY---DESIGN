"use client";

import { MOCK_ITEMS, TYPE_COLORS, type PlannerItem } from "./mock-data";

interface CalendarGridProps {
  currentDate: Date;
  selectedItem: PlannerItem | null;
  onSelectItem: (item: PlannerItem) => void;
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface GridCell {
  year: number;
  month: number; // 0-indexed
  day: number;
  isCurrentMonth: boolean;
}

function buildGrid(year: number, month: number): GridCell[][] {
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Previous month info
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

  // Next month info
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;

  const cells: GridCell[] = [];

  // Trailing cells from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({
      year: prevYear,
      month: prevMonth,
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ year, month, day: d, isCurrentMonth: true });
  }

  // Fill trailing cells from next month to complete the last week
  const remainder = cells.length % 7;
  const trailingCount = remainder === 0 ? 0 : 7 - remainder;
  for (let d = 1; d <= trailingCount; d++) {
    cells.push({
      year: nextYear,
      month: nextMonth,
      day: d,
      isCurrentMonth: false,
    });
  }

  // If we are near the end of the month and the last row only shows trailing
  // days, always add one more week so the grid feels continuous.
  const lastRow = cells.slice(-7);
  const lastRowHasCurrentMonth = lastRow.some((c) => c.isCurrentMonth);
  if (!lastRowHasCurrentMonth) {
    // The last row is entirely next-month overflow — that's fine, leave it.
    // But if the LAST current-month day falls in the 2nd-to-last row with
    // only a small trailing segment, add an extra week peek.
  }
  // Ensure at least a peek of the next week when the month ends mid-week:
  // already handled by remainder logic above.

  // Build into weeks
  const weeks: GridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export default function CalendarGrid({
  currentDate,
  selectedItem,
  onSelectItem,
}: CalendarGridProps) {
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

      {/* Weeks */}
      <div>
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className={`grid grid-cols-7 ${wi < weeks.length - 1 ? "border-b border-gray-100" : ""}`}
          >
            {week.map((cell, ci) => {
              const iso = toISO(cell.year, cell.month, cell.day);
              const items = MOCK_ITEMS[iso] ?? [];
              const isToday = iso === todayISO;
              const isOtherMonth = !cell.isCurrentMonth;

              return (
                <div
                  key={ci}
                  className={`min-h-[110px] p-2 ${ci < 6 ? "border-r border-gray-100" : ""} transition-colors ${
                    isOtherMonth
                      ? "bg-gray-50/70"
                      : "bg-white hover:bg-gray-50/50"
                  }`}
                >
                  {/* Day number */}
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                        isToday
                          ? "bg-green-600 text-white"
                          : isOtherMonth
                          ? "text-gray-300"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {cell.day}
                    </span>
                    {items.length > 0 && (
                      <span
                        className={`text-[10px] font-medium ${
                          isOtherMonth ? "text-gray-300" : "text-gray-400"
                        }`}
                      >
                        {items.length} item{items.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Items — show up to 2, collapse the rest */}
                  <div className="flex flex-col gap-1">
                    {items.slice(0, 2).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectItem(item)}
                        className={`w-full text-left px-1.5 py-1 rounded-md border text-[11px] font-medium truncate transition-all hover:opacity-80 ${
                          TYPE_COLORS[item.type]
                        } ${
                          isOtherMonth ? "opacity-50" : ""
                        } ${
                          selectedItem?.id === item.id
                            ? "ring-2 ring-green-500 ring-offset-1"
                            : ""
                        }`}
                      >
                        <span className="block truncate">
                          {item.time} · {item.title}
                        </span>
                      </button>
                    ))}
                    {items.length > 2 && (
                      <button
                        type="button"
                        onClick={() => onSelectItem(items[2])}
                        className={`text-[10px] font-medium hover:text-green-600 text-left px-1 transition-colors ${
                          isOtherMonth ? "text-gray-300" : "text-gray-400"
                        }`}
                      >
                        +{items.length - 2} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
