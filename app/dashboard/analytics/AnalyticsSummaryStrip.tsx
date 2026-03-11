"use client";

import React from "react";
import type { KpiMetric } from "./mock-data";
import { MetricPlaceholder } from "./EmptyState";

// ─── Icons (inline SVG, no extra dependency) ──────────────────────────────────

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconHeart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function IconStar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconTrendUp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconTrendDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  );
}

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, (props: { className?: string }) => React.ReactElement> = {
  impressions: IconEye,
  followers: IconUsers,
  engagements: IconHeart,
  platforms: IconLink,
  best_platform: IconStar,
};

// ─── Variant styles ───────────────────────────────────────────────────────────

const iconBg: Record<string, string> = {
  accent: "bg-green-50 text-green-600",
  neutral: "bg-gray-100 text-gray-500",
  info: "bg-amber-50 text-amber-500",
};

const valueCls: Record<string, string> = {
  accent: "text-gray-900",
  neutral: "text-gray-900",
  info: "text-gray-900",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface AnalyticsSummaryStripProps {
  metrics: KpiMetric[];
  /**
   * When true, every value cell renders a "—" placeholder instead of real data.
   * Use when no platforms are connected or data is still syncing.
   */
  partial?: boolean;
}

export default function AnalyticsSummaryStrip({ metrics, partial = false }: AnalyticsSummaryStripProps) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8"
      role="list"
      aria-label="Key performance indicators"
    >
      {metrics.map((metric) => {
        const Icon = ICON_MAP[metric.id] ?? IconStar;
        const hasTrend = metric.trend !== undefined;
        const isPositive = metric.positive === true;
        const isNegative = metric.positive === false;

        return (
          <div
            key={metric.id}
            role="listitem"
            className="group bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex flex-col gap-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300 cursor-default"
          >
            {/* Icon + label row */}
            <div className="flex items-center justify-between">
              <span
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${iconBg[metric.variant]}`}
                aria-hidden="true"
              >
                <Icon className="w-4 h-4" />
              </span>

              {/* Trend arrow badge — only for positive/negative metrics */}
              {hasTrend && isPositive && (
                <span className="flex items-center gap-1 text-green-600 bg-green-50 rounded-full px-2 py-0.5 text-xs font-semibold leading-relaxed">
                  <IconTrendUp className="w-3 h-3" />
                </span>
              )}
              {hasTrend && isNegative && (
                <span className="flex items-center gap-1 text-red-500 bg-red-50 rounded-full px-2 py-0.5 text-xs font-semibold leading-relaxed">
                  <IconTrendDown className="w-3 h-3" />
                </span>
              )}
            </div>

            {/* Value */}
            <div className="flex flex-col gap-0.5">
              <span className={`text-2xl font-bold leading-tight tracking-tight ${valueCls[metric.variant]}`}>
                {partial ? <MetricPlaceholder label={metric.label} /> : metric.value}
              </span>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide leading-relaxed">
                {metric.label}
              </span>
            </div>

            {/* Trend text */}
            {!partial && hasTrend && (
              <p
                className={`text-xs font-medium leading-relaxed border-t border-gray-100 pt-2 ${
                  isPositive
                    ? "text-green-600"
                    : isNegative
                    ? "text-red-500"
                    : "text-gray-400"
                }`}
              >
                {metric.trend}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
