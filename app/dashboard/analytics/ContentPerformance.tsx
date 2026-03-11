"use client";

import type { ContentPerformanceRow } from "./mock-data";

interface ContentPerformanceProps {
  rows: ContentPerformanceRow[];
}

const PLATFORM_BADGE: Record<string, string> = {
  Instagram: "bg-pink-100 text-pink-700",
  LinkedIn: "bg-blue-100 text-blue-700",
  "X / Twitter": "bg-gray-100 text-gray-700",
  TikTok: "bg-gray-900 text-white",
};

const TYPE_BADGE: Record<string, string> = {
  Carousel: "bg-amber-100 text-amber-700",
  Article: "bg-indigo-100 text-indigo-700",
  Thread: "bg-sky-100 text-sky-700",
  "Short Clip": "bg-green-100 text-green-700",
  "Story Post": "bg-rose-100 text-rose-700",
};

function formatK(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export default function ContentPerformance({ rows }: ContentPerformanceProps) {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Top Content Performance</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your best-performing AI-generated posts ranked by impressions
          </p>
        </div>
        <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-1">
          AI-ranked
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Table header — desktop only */}
        <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Content</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right w-24">Impressions</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right w-24">Engagements</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right w-20">Eng. Rate</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right w-24">Published</span>
        </div>

        <div className="divide-y divide-gray-100">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] gap-2 md:gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              {/* Content info */}
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-sm font-bold text-gray-300 w-5 flex-shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        PLATFORM_BADGE[row.platform] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {row.platform}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        TYPE_BADGE[row.type] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {row.type}
                    </span>
                    {row.aiGenerated && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">
                        AI
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 font-medium leading-relaxed truncate max-w-[36rem]">
                    {row.snippet}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 md:contents">
                <div className="md:w-24 md:text-right">
                  <p className="text-sm font-bold text-gray-900">{formatK(row.impressions)}</p>
                  <p className="text-[11px] text-gray-400 md:hidden">impressions</p>
                </div>
                <div className="md:w-24 md:text-right">
                  <p className="text-sm font-bold text-gray-900">{formatK(row.engagements)}</p>
                  <p className="text-[11px] text-gray-400 md:hidden">engagements</p>
                </div>
                <div className="md:w-20 md:text-right">
                  <p className="text-sm font-bold text-green-600">{row.engagementRate}</p>
                  <p className="text-[11px] text-gray-400 md:hidden">eng. rate</p>
                </div>
                <div className="md:w-24 md:text-right">
                  <p className="text-sm text-gray-500">{row.publishedAt}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
