"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, CalendarDays } from "lucide-react";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import PlannerControlBar from "./PlannerControlBar";
import PlannerSummaryStrip from "./PlannerSummaryStrip";
import CalendarGrid from "./CalendarGrid";
import SlideOverPanel from "./SlideOverPanel";
import type { PlannerItem } from "./mock-data";
import { TYPE_COLORS, TYPE_LABELS, type ContentType } from "./mock-data";

const LEGEND_ITEMS: ContentType[] = [
  "Short Clip",
  "Carousel",
  "Article",
  "Story Post",
  "Trend Reaction",
];

export default function PlannerPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<PlannerItem | null>(null);

  function handlePrevMonth() {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setSelectedItem(null);
  }

  function handleNextMonth() {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    setSelectedItem(null);
  }

  function handleToday() {
    setCurrentDate(new Date());
    setSelectedItem(null);
  }

  function handleSelectItem(item: PlannerItem) {
    setSelectedItem((prev) => (prev?.id === item.id ? null : item));
  }

  function handleClosePanel() {
    setSelectedItem(null);
  }

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <SiteNavbar />

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-10">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
          <Link href="/dashboard" className="hover:text-green-600 transition-colors font-medium">
            Dashboard
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-600 font-medium">Content Planner</span>
        </nav>

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-7">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-teal-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Content Planner</h1>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed ml-[52px]">
              Plan, review, and refine your upcoming content calendar.
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 flex-wrap">
            {LEGEND_ITEMS.map((type) => (
              <span
                key={type}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${TYPE_COLORS[type]}`}
              >
                {TYPE_LABELS[type]}
              </span>
            ))}
          </div>
        </div>

        {/* Summary strip */}
        <PlannerSummaryStrip />

        {/* Control bar */}
        <div className="mb-4">
          <PlannerControlBar
            currentDate={currentDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
          />
        </div>

        {/* Calendar grid */}
        <CalendarGrid
          currentDate={currentDate}
          selectedItem={selectedItem}
          onSelectItem={handleSelectItem}
        />
      </div>

      {/* Slide-over panel */}
      <SlideOverPanel item={selectedItem} onClose={handleClosePanel} />

      <Footer />
    </main>
  );
}
