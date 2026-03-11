"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import type { PlatformStat, WeeklyDataPoint } from "./mock-data";
import EmptyState from "./EmptyState";

interface PlatformAnalyticsProps {
  platformStats: PlatformStat[];
  weeklyData: WeeklyDataPoint[];
  emptyVariant?: "no-accounts" | "no-posts";
}

function formatK(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "#E1306C",
  LinkedIn: "#0A66C2",
  "X / Twitter": "#374151",
  TikTok: "#010101",
};

function WeeklyBarChart({ data }: { data: WeeklyDataPoint[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-base font-bold text-gray-900 mb-1">Weekly Impressions by Platform</h3>
      <p className="text-sm text-gray-500 mb-5 leading-relaxed">Stacked weekly totals per platform</p>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap mb-4">
        {(["instagram", "linkedin", "twitter", "tiktok"] as const).map((key) => {
          const label = key === "twitter" ? "X / Twitter" : key.charAt(0).toUpperCase() + key.slice(1);
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block"
                style={{ backgroundColor: PLATFORM_COLORS[label] ?? "#374151" }}
              />
              <span className="text-xs font-medium text-gray-500">{label}</span>
            </div>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={12}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatK} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            formatter={(value: number, name: string) => [
              value.toLocaleString(),
              name === "twitter" ? "X / Twitter" : name.charAt(0).toUpperCase() + name.slice(1),
            ]}
            contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13 }}
          />
          <Bar dataKey="instagram" stackId="a" fill="#E1306C" radius={[0, 0, 0, 0]} />
          <Bar dataKey="linkedin" stackId="a" fill="#0A66C2" />
          <Bar dataKey="twitter" stackId="a" fill="#374151" />
          <Bar dataKey="tiktok" stackId="a" fill="#6b7280" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlatformSharePie({ stats }: { stats: PlatformStat[] }) {
  const pieData = stats.map((s) => ({ name: s.platform, value: s.impressions, color: s.color }));
  const total = stats.reduce((sum, s) => sum + s.impressions, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h3 className="text-base font-bold text-gray-900 mb-1">Impression Share</h3>
      <p className="text-sm text-gray-500 mb-5 leading-relaxed">Distribution across platforms</p>

      <div className="flex items-center gap-6">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={66}
              paddingAngle={3}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [value.toLocaleString(), "Impressions"]}
              contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13 }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex flex-col gap-3 flex-1">
          {pieData.map((d) => {
            const pct = ((d.value / total) * 100).toFixed(1);
            return (
              <div key={d.name} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="text-sm text-gray-700 flex-1 font-medium">{d.name}</span>
                <span className="text-sm font-bold text-gray-900">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlatformStatRow({ stat }: { stat: PlatformStat }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
      <div
        className="w-2 h-8 rounded-full flex-shrink-0"
        style={{ backgroundColor: PLATFORM_COLORS[stat.platform] ?? "#374151" }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{stat.platform}</p>
        <p className="text-xs text-gray-400">{stat.posts} posts</p>
      </div>
      <div className="text-right hidden sm:block">
        <p className="text-sm font-bold text-gray-900">{formatK(stat.impressions)}</p>
        <p className="text-xs text-gray-400">impressions</p>
      </div>
      <div className="text-right hidden md:block">
        <p className="text-sm font-bold text-gray-900">{formatK(stat.engagements)}</p>
        <p className="text-xs text-gray-400">engagements</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-green-600">{stat.engagementRate}</p>
        <p className="text-xs text-gray-400">eng. rate</p>
      </div>
      <div className="text-right hidden lg:block">
        <p className="text-sm font-bold text-gray-900">+{stat.followers.toLocaleString()}</p>
        <p className="text-xs text-gray-400">followers</p>
      </div>
    </div>
  );
}

export default function PlatformAnalytics({ platformStats, weeklyData, emptyVariant }: PlatformAnalyticsProps) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Platform Analytics</h2>

      {emptyVariant ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <EmptyState
            variant={emptyVariant}
            inline
            description={
              emptyVariant === "no-accounts"
                ? "Connect your social accounts to see a breakdown of performance across platforms."
                : "Platform analytics will appear here once you have published content."
            }
          />
        </div>
      ) : (
        <>
          {/* Platform breakdown rows */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
            <div className="flex items-center gap-4 pb-2 border-b border-gray-100 mb-1">
              <div className="w-2 flex-shrink-0" />
              <p className="flex-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Platform</p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:block w-20 text-right">Impressions</p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:block w-24 text-right">Engagements</p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-16 text-right">Eng. Rate</p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:block w-20 text-right">Followers</p>
            </div>
            {platformStats.map((stat) => (
              <PlatformStatRow key={stat.platform} stat={stat} />
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <WeeklyBarChart data={weeklyData} />
            </div>
            <PlatformSharePie stats={platformStats} />
          </div>
        </>
      )}
    </section>
  );
}
