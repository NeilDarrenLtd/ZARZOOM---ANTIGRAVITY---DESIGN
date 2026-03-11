"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, SlidersHorizontal, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DatePreset = "Last 7 days" | "Last 30 days" | "Last 90 days" | "This month" | "Custom";
export type PlatformFilter = "All platforms" | "Instagram" | "TikTok" | "YouTube" | "LinkedIn" | "Facebook" | "Twitter/X";

export interface AnalyticsFilters {
  datePreset: DatePreset;
  customFrom: string;   // ISO date string "YYYY-MM-DD", only used when datePreset === "Custom"
  customTo: string;
  platform: PlatformFilter;
}

export const DEFAULT_FILTERS: AnalyticsFilters = {
  datePreset: "Last 30 days",
  customFrom: "",
  customTo: "",
  platform: "All platforms",
};

const DATE_PRESETS: DatePreset[] = ["Last 7 days", "Last 30 days", "Last 90 days", "This month", "Custom"];
const PLATFORMS: PlatformFilter[] = ["All platforms", "Instagram", "TikTok", "YouTube", "LinkedIn", "Facebook", "Twitter/X"];

// ─── Platform colour dots ─────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<PlatformFilter, string> = {
  "All platforms": "#6b7280",
  "Instagram":    "#e1306c",
  "TikTok":       "#010101",
  "YouTube":      "#ff0000",
  "LinkedIn":     "#0a66c2",
  "Facebook":     "#1877f2",
  "Twitter/X":    "#000000",
};

interface PlatformDotProps {
  platform: PlatformFilter;
}
function PlatformDot({ platform }: PlatformDotProps) {
  if (platform === "All platforms") return null;
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: PLATFORM_COLORS[platform] }}
      aria-hidden="true"
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AnalyticsFilterBarProps {
  filters: AnalyticsFilters;
  onChange: (next: AnalyticsFilters) => void;
}

export default function AnalyticsFilterBar({ filters, onChange }: AnalyticsFilterBarProps) {
  const [platformOpen, setPlatformOpen] = useState(false);
  const platformRef = useRef<HTMLDivElement>(null);

  // Close platform dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (platformRef.current && !platformRef.current.contains(e.target as Node)) {
        setPlatformOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const hasActiveFilters =
    filters.datePreset !== DEFAULT_FILTERS.datePreset ||
    filters.platform !== DEFAULT_FILTERS.platform;

  function setPreset(preset: DatePreset) {
    onChange({
      ...filters,
      datePreset: preset,
      // Clear custom range when switching away from Custom
      customFrom: preset === "Custom" ? filters.customFrom : "",
      customTo:   preset === "Custom" ? filters.customTo   : "",
    });
  }

  function setPlatform(platform: PlatformFilter) {
    onChange({ ...filters, platform });
    setPlatformOpen(false);
  }

  function clearFilters() {
    onChange(DEFAULT_FILTERS);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Filter icon label */}
      <div className="flex items-center gap-1.5 text-gray-500 text-sm font-medium">
        <SlidersHorizontal className="w-4 h-4" />
        <span className="sr-only sm:not-sr-only">Filters</span>
      </div>

      {/* ── Date preset pills ────────────────────────────────────────────── */}
      <div
        role="group"
        aria-label="Date range presets"
        className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm"
      >
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setPreset(preset)}
            aria-pressed={filters.datePreset === preset}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
              filters.datePreset === preset
                ? "bg-green-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {preset === "Custom" && (
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {preset}
          </button>
        ))}
      </div>

      {/* ── Custom date range inputs (only visible when "Custom" selected) ── */}
      {filters.datePreset === "Custom" && (
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
          <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" aria-hidden="true" />
          <input
            type="date"
            value={filters.customFrom}
            onChange={(e) => onChange({ ...filters, customFrom: e.target.value })}
            aria-label="Start date"
            className="text-sm text-gray-700 bg-transparent border-none outline-none w-36 cursor-pointer"
            // TODO (real data): trigger analytics re-fetch on change
          />
          <span className="text-gray-300 text-sm select-none">→</span>
          <input
            type="date"
            value={filters.customTo}
            onChange={(e) => onChange({ ...filters, customTo: e.target.value })}
            aria-label="End date"
            min={filters.customFrom || undefined}
            className="text-sm text-gray-700 bg-transparent border-none outline-none w-36 cursor-pointer"
            // TODO (real data): trigger analytics re-fetch on change
          />
        </div>
      )}

      {/* ── Platform dropdown ────────────────────────────────────────────── */}
      <div ref={platformRef} className="relative">
        <button
          type="button"
          onClick={() => setPlatformOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={platformOpen}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
            filters.platform !== "All platforms"
              ? "bg-green-50 border-green-300 text-green-700"
              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          <PlatformDot platform={filters.platform} />
          {filters.platform}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${platformOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        {platformOpen && (
          <ul
            role="listbox"
            aria-label="Platform filter"
            className="absolute left-0 top-full mt-1.5 w-44 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-20 py-1"
          >
            {PLATFORMS.map((p) => (
              <li key={p} role="option" aria-selected={filters.platform === p}>
                <button
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                    filters.platform === p
                      ? "bg-green-50 text-green-700 font-semibold"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <PlatformDot platform={p} />
                  {p}
                  {filters.platform === p && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Clear filters pill (only when non-default) ───────────────────── */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-dashed border-gray-300 transition-colors"
          aria-label="Clear all filters"
        >
          <X className="w-3 h-3" aria-hidden="true" />
          Clear
        </button>
      )}

      {/* TODO (real data): when filters change, call:
          refetchAnalytics({ workspaceId, datePreset, customFrom, customTo, platform })
          to update all dashboard sections (KPI strip, engagement chart, platform analytics, content table) */}
    </div>
  );
}
