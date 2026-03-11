"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { EngagementDataPoint } from "./mock-data";

interface EngagementChartProps {
  data: EngagementDataPoint[];
}

type Metric = "impressions" | "engagements" | "posts";

const METRIC_OPTIONS: { key: Metric; label: string; color: string; fillColor: string }[] = [
  { key: "impressions", label: "Impressions", color: "#16a34a", fillColor: "#bbf7d0" },
  { key: "engagements", label: "Engagements", color: "#0891b2", fillColor: "#a5f3fc" },
  { key: "posts", label: "Posts", color: "#7c3aed", fillColor: "#ddd6fe" },
];

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

// Custom tooltip to avoid CSS variable issues
function CustomTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  metric: Metric;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const opt = METRIC_OPTIONS.find((o) => o.key === metric)!;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="text-gray-500 mb-1 font-medium">{label}</p>
      <p className="font-bold text-gray-900">
        <span style={{ color: opt.color }}>{opt.label}:</span>{" "}
        {metric === "impressions" || metric === "engagements"
          ? val.toLocaleString()
          : val}
      </p>
    </div>
  );
}

export default function EngagementChart({ data }: EngagementChartProps) {
  const [activeMetric, setActiveMetric] = useState<Metric>("impressions");

  const opt = METRIC_OPTIONS.find((o) => o.key === activeMetric)!;

  // Thin out x-axis ticks for readability
  const tickData = data.filter((_, i) => i % 5 === 0 || i === data.length - 1);
  const ticks = tickData.map((d) => d.date);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Engagement Overview</h2>
          <p className="text-sm text-gray-500 leading-relaxed">Daily performance across all platforms</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {METRIC_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setActiveMetric(o.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeMetric === o.key
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={opt.color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={opt.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip metric={activeMetric} />} />
          <Area
            type="monotone"
            dataKey={activeMetric}
            stroke={opt.color}
            strokeWidth={2}
            fill="url(#areaGrad)"
            dot={false}
            activeDot={{ r: 5, fill: opt.color, stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
