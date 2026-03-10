"use client";

import { MOCK_ITEMS, TYPE_COLORS, type PlannerItem } from "./mock-data";

interface CalendarGridProps {
  currentDate: Date;
  selectedItem: PlannerItem | null;
  onSelectItem: (item: PlannerItem) => void;
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function CalendarGrid({
  currentDate,
  selectedItem,
  onSelectItem,
}: CalendarGridProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  // Build grid cells: leading empty + numbered days
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
  while (cells.length < totalCells) cells.push({ day: null });

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-gray-100">
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
              const items = cell.day ? (MOCK_ITEMS[cell.day] ?? []) : [];
              const isToday = isCurrentMonth && cell.day === todayDate;

              return (
                <div
                  key={ci}
                  className={`min-h-[110px] p-2 ${ci < 6 ? "border-r border-gray-100" : ""} ${
                    cell.day ? "bg-white hover:bg-gray-50/60 transition-colors" : "bg-gray-50/40"
                  }`}
                >
                  {cell.day && (
                    <>
                      {/* Day number */}
                      <div className="mb-1.5 flex items-center justify-between">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                            isToday
                              ? "bg-green-600 text-white"
                              : "text-gray-600"
                          }`}
                        >
                          {cell.day}
                        </span>
                        {items.length > 0 && (
                          <span className="text-[10px] font-medium text-gray-400">
                            {items.length} item{items.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Items — show up to 2, rest collapsed */}
                      <div className="flex flex-col gap-1">
                        {items.slice(0, 2).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelectItem(item)}
                            className={`w-full text-left px-1.5 py-1 rounded-md border text-[11px] font-medium truncate transition-all hover:opacity-80 ${
                              TYPE_COLORS[item.type]
                            } ${
                              selectedItem?.id === item.id
                                ? "ring-2 ring-green-500 ring-offset-1"
                                : ""
                            }`}
                          >
                            <span className="block truncate">{item.time} · {item.title}</span>
                          </button>
                        ))}
                        {items.length > 2 && (
                          <button
                            type="button"
                            onClick={() => onSelectItem(items[2])}
                            className="text-[10px] font-medium text-gray-400 hover:text-green-600 text-left px-1 transition-colors"
                          >
                            +{items.length - 2} more
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
