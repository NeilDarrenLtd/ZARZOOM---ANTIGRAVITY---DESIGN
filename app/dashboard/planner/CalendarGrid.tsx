"use client";

import { MOCK_ITEMS, TYPE_COLORS, TYPE_LABELS, type PlannerItem } from "./mock-data";

interface CalendarGridProps {
  currentDate: Date;
  selectedItem: PlannerItem | null;
  onSelectItem: (item: PlannerItem) => void;
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE = 2;

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface GridCell {
  year: number;
  month: number;
  day: number;
  isCurrentMonth: boolean;
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

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({ year: prevYear, month: prevMonth, day: daysInPrevMonth - i, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ year, month, day: d, isCurrentMonth: true });
  }
  const remainder = cells.length % 7;
  const trailingCount = remainder === 0 ? 0 : 7 - remainder;
  for (let d = 1; d <= trailingCount; d++) {
    cells.push({ year: nextYear, month: nextMonth, day: d, isCurrentMonth: false });
  }

  const weeks: GridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

// Viral strength: 5 dots, filled up to viralStrength value
function ViralDots({ strength }: { strength: number }) {
  return (
    <span className="flex items-center gap-px shrink-0" aria-label={`Viral strength ${strength} of 5`}>
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

function ItemPill({
  item,
  isSelected,
  dimmed,
  onClick,
}: {
  item: PlannerItem;
  isSelected: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const colors = TYPE_COLORS[item.type];
  const label = TYPE_LABELS[item.type];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left rounded-md border px-1.5 py-1 transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${colors} ${
        dimmed ? "opacity-40" : ""
      } ${isSelected ? "ring-2 ring-green-500 ring-offset-1" : ""}`}
    >
      {/* Row 1: type badge + viral dots */}
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="text-[9px] font-semibold uppercase tracking-wide leading-none opacity-75 truncate">
          {label}
        </span>
        <ViralDots strength={item.viralStrength} />
      </div>
      {/* Row 2: hook text */}
      <p className="text-[11px] font-medium leading-tight line-clamp-2 group-hover:line-clamp-none transition-all">
        {item.hook}
      </p>
    </button>
  );
}

export default function CalendarGrid({ currentDate, selectedItem, onSelectItem }: CalendarGridProps) {
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
          <div key={d} className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
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
              const visible = items.slice(0, MAX_VISIBLE);
              const overflow = items.length - MAX_VISIBLE;
              const isToday = iso === todayISO;
              const isOther = !cell.isCurrentMonth;

              return (
                <div
                  key={ci}
                  className={`min-h-[130px] p-2 flex flex-col gap-1 ${
                    ci < 6 ? "border-r border-gray-100" : ""
                  } ${isOther ? "bg-gray-50/60" : "bg-white hover:bg-gray-50/30 transition-colors"}`}
                >
                  {/* Day number */}
                  <div className="mb-0.5">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                        isToday
                          ? "bg-green-600 text-white"
                          : isOther
                          ? "text-gray-300"
                          : "text-gray-700"
                      }`}
                    >
                      {cell.day}
                    </span>
                  </div>

                  {/* Item pills */}
                  {visible.map((item) => (
                    <ItemPill
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
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
