"use client";

/**
 * ContentReachChart
 * -----------------
 * Visualises "Exposure" — a normalised cross-platform metric collapsing each
 * platform's primary reach signal (Reach / Views / Impressions) into one number.
 *
 * TODO (real data): swap REACH_OVER_TIME for a useSWR hook:
 *   const { data, isLoading } = useSWR(
 *     ["/api/analytics/reach", filters, workspaceId],
 *     ([url, f, wsId]) => fetchReach(url, f, wsId)
 *   );
 */

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { ReachDataPoint } from "./mock-data";
import EmptyState from "./EmptyState";

// ─── Colour tokens (computed — not CSS variables, avoids Recharts resolution issues)
const LINE_COLOR   = "#16a34a"; // green-600
const GRAD_START   = "#16a34a"; // same hue, full opacity controlled via stopOpacity
const GRAD_END     = "#f0fdf4"; // green-50 — matches card bg for seamless fade
const GRID_COLOR   = "#f3f4f6"; // gray-100
const AXIS_COLOR   = "#9ca3af"; // gray-400
const AVG_COLOR    = "#d1fae5"; // green-100 — subtle average reference line

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatY(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function average(data: ReachDataPoint[]): number {
  if (!data.length) return 0;
  return Math.round(data.reduce((sum, d) => sum + d.exposure, 0) / data.length);
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: ReachDataPoint }>;
  label?: string;
}

function ReachTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 min-w-[160px]">
      <p className="text-xs font-medium text-gray-400 mb-1 tracking-wide uppercase">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900 leading-none">
        {val >= 1_000 ? `${(val / 1_000).toFixed(1)}K` : val.toLocaleString()}
      </p>
      <p className="text-xs text-green-600 font-medium mt-1">Exposure</p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ContentReachChartProps {
  data: ReachDataPoint[];
  emptyVariant?: "no-accounts" | "no-posts";
}

export default function ContentReachChart({ data, emptyVariant }: ContentReachChartProps) {
  const avg  = average(data);
  const peak = data.length ? data.reduce((best, d) => (d.exposure > best.exposure ? d : best), data[0]) : null;

  // Show every 5th tick to avoid crowding on the 30-day range
  const ticks = data
    .filter((_, i) => i % 5 === 0 || i === data.length - 1)
    .map((d) => d.date);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 text-balance">
            Content Reach Over Time
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mt-0.5">
            AI-generated content performance across connected platforms.
          </p>
        </div>

        {!emptyVariant && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: LINE_COLOR }} />
              <span className="text-sm font-medium text-gray-700">Exposure</span>
            </div>
            <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5">
              <span className="text-xs text-gray-500 font-medium">30-day avg</span>
              <span className="text-xs font-bold text-green-700">{formatY(avg)}</span>
            </div>
          </div>
        )}
      </div>

      {emptyVariant ? (
        <EmptyState
          variant={emptyVariant}
          inline
          description={
            emptyVariant === "no-accounts"
              ? "Connect your social accounts to start seeing reach data here."
              : "Your AI will begin tracking content reach once posts are published."
          }
        />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={GRAD_START} stopOpacity={0.22} />
                  <stop offset="60%"  stopColor={GRAD_START} stopOpacity={0.06} />
                  <stop offset="100%" stopColor={GRAD_END}   stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="date" ticks={ticks} tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} dy={6} />
              <YAxis tickFormatter={formatY} tick={{ fontSize: 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={44} />
              <ReferenceLine y={avg} stroke={AVG_COLOR} strokeDasharray="4 4" strokeWidth={1.5} label={false} />
              <Tooltip content={<ReachTooltip />} cursor={{ stroke: LINE_COLOR, strokeWidth: 1, strokeDasharray: "4 4" }} />
              <Area
                type="monotoneX"
                dataKey="exposure"
                stroke={LINE_COLOR}
                strokeWidth={2.5}
                fill="url(#reachGradient)"
                dot={false}
                activeDot={{ r: 5, fill: LINE_COLOR, stroke: "#ffffff", strokeWidth: 2.5 }}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-out"
              />
              {peak && <ReferenceLine x={peak.date} stroke={LINE_COLOR} strokeOpacity={0.25} strokeWidth={1} label={false} />}
            </AreaChart>
          </ResponsiveContainer>

          {peak && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-6 flex-wrap">
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Peak day</span>
                <span className="text-sm font-bold text-gray-900">{peak.date} &mdash; {formatY(peak.exposure)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">30-day total</span>
                <span className="text-sm font-bold text-gray-900">{formatY(data.reduce((s, d) => s + d.exposure, 0))}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Metric</span>
                <span className="text-sm font-bold text-green-600">Exposure</span>
              </div>
              <p className="text-xs text-gray-400 ml-auto max-w-xs text-right leading-relaxed">
                Exposure normalises Reach, Views &amp; Impressions across platforms into one comparable signal.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
