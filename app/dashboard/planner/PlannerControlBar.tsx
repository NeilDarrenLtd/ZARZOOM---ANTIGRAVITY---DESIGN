"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface PlannerControlBarProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PlannerControlBar({
  currentDate,
  onPrevMonth,
  onNextMonth,
  onToday,
}: PlannerControlBarProps) {
  const monthLabel = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 bg-white border border-gray-200 rounded-2xl px-5 py-3.5 shadow-sm">
      {/* Left: month navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50 text-gray-600 hover:text-green-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-base font-bold text-gray-900 min-w-[160px] text-center select-none">
          {monthLabel}
        </span>

        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Next month"
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50 text-gray-600 hover:text-green-700 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToday}
          className="ml-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-green-50 hover:border-green-400 text-sm font-medium text-gray-700 hover:text-green-700 transition-colors"
        >
          Today
        </button>
      </div>

      {/* Right: view label */}
      <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
        <CalendarDays className="w-4 h-4 text-green-600" />
        <span>Monthly View</span>
      </div>
    </div>
  );
}
