"use client";

import type { SummaryMetric } from "./mock-data";

interface AnalyticsSummaryStripProps {
  metrics: SummaryMetric[];
}

export default function AnalyticsSummaryStrip({ metrics }: AnalyticsSummaryStripProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex flex-col gap-1"
        >
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide leading-relaxed">
            {metric.label}
          </span>
          <span className="text-2xl font-bold text-gray-900">{metric.value}</span>
          <span
            className={`text-xs font-semibold ${
              metric.positive ? "text-green-600" : "text-red-500"
            }`}
          >
            {metric.delta}
          </span>
        </div>
      ))}
    </div>
  );
}
