"use client";

import { useState } from "react";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import { useActiveWorkspace } from "@/lib/workspace/context";

import AnalyticsHeader from "./AnalyticsHeader";
import AnalyticsFilterBar, { DEFAULT_FILTERS, type AnalyticsFilters } from "./AnalyticsFilterBar";
import AnalyticsSummaryStrip from "./AnalyticsSummaryStrip";
import AiInsightsCard from "./AiInsightsCard";
import ContentReachChart from "./ContentReachChart";
import EngagementChart from "./EngagementChart";
import PlatformAnalytics from "./PlatformAnalytics";
import PlatformPerformanceCards from "./PlatformPerformanceCards";
import ContentPerformance from "./ContentPerformance";

import {
  KPI_METRICS,
  AI_INSIGHTS,
  REACH_OVER_TIME,
  DAILY_ENGAGEMENT,
  PLATFORM_STATS,
  PLATFORM_CARDS,
  WEEKLY_BY_PLATFORM,
  TOP_CONTENT,
} from "./mock-data";

// ─── Data scenarios ───────────────────────────────────────────────────────────
// Simulates the three states the page must handle gracefully.
// TODO (real data): derive this from the API response:
//   - "no-accounts" → workspace.connectedPlatforms.length === 0
//   - "no-posts"    → analytics.totalPosts === 0
//   - "normal"      → everything else

type DataScenario = "normal" | "no-accounts" | "no-posts";

const SCENARIO_LABELS: Record<DataScenario, string> = {
  normal:       "Normal (data available)",
  "no-accounts": "No accounts connected",
  "no-posts":   "Accounts connected, no posts yet",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * /dashboard/analytics
 *
 * AI-powered analytics page for ZARZOOM.
 * Currently uses mock data — each section is structured so it can be swapped
 * to a real API call (e.g. useSWR with workspaceScopedKey) independently.
 *
 * To connect to real data:
 *  1. Import useWorkspaceFetch + workspaceScopedKey from @/lib/workspace/context
 *  2. Replace the mock-data imports in each sub-component with SWR hooks
 *  3. Pass activeWorkspaceId as a query param (e.g. ?_ws=<id>) to scope requests
 *  4. Pass `filters` (datePreset, customFrom, customTo, platform) as additional
 *     query params so the API can scope results accordingly
 *  5. Derive `scenario` from the API response and remove the demo toggle below
 */
export default function AnalyticsPage() {
  const activeWorkspaceId = useActiveWorkspace();
  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_FILTERS);

  // TODO (real data): derive from API — remove this demo toggle
  const [scenario, setScenario] = useState<DataScenario>("normal");

  // TODO (real data): derive workspace name from workspace list instead of fallback
  const workspaceName = activeWorkspaceId ? "My Workspace" : null;

  // Derive empty-state variants from the active scenario
  const noAccounts = scenario === "no-accounts";
  const noPosts    = scenario === "no-posts";
  const emptyForCharts   = noAccounts ? "no-accounts" : noPosts ? "no-posts" : undefined;
  const emptyForPlatforms = noAccounts ? "no-accounts" : undefined;

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <SiteNavbar />

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-10">
        <AnalyticsHeader workspaceName={workspaceName} />

        {/* Filter bar: date presets, custom date range, platform selector */}
        <AnalyticsFilterBar filters={filters} onChange={setFilters} />

        {/* ── Demo: data scenario switcher (remove when wiring real data) ──── */}
        <div className="mb-6 flex flex-wrap items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide shrink-0">
            Preview state:
          </span>
          {(Object.keys(SCENARIO_LABELS) as DataScenario[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScenario(s)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                scenario === s
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-white border border-amber-200 text-amber-700 hover:border-amber-400"
              }`}
            >
              {SCENARIO_LABELS[s]}
            </button>
          ))}
        </div>
        {/* ── End demo toggle ───────────────────────────────────────────────── */}

        {/* KPI strip — shows placeholders (—) when no data is available */}
        <AnalyticsSummaryStrip
          metrics={KPI_METRICS}
          partial={noAccounts || noPosts}
        />

        {/* TODO (real data): pass useSWR insights instead of AI_INSIGHTS */}
        <AiInsightsCard
          insights={AI_INSIGHTS}
          emptyVariant={emptyForCharts as "no-accounts" | "no-posts" | undefined}
        />

        {/* TODO (real data): pass useSWR reach data instead of REACH_OVER_TIME */}
        <ContentReachChart data={REACH_OVER_TIME} emptyVariant={emptyForCharts} />

        <EngagementChart data={DAILY_ENGAGEMENT} emptyVariant={emptyForCharts} />

        <PlatformAnalytics
          platformStats={PLATFORM_STATS}
          weeklyData={WEEKLY_BY_PLATFORM}
          emptyVariant={emptyForCharts}
        />

        {/* TODO (real data): pass useSWR platform card data instead of PLATFORM_CARDS */}
        <PlatformPerformanceCards
          cards={PLATFORM_CARDS}
          emptyVariant={emptyForPlatforms}
        />

        <ContentPerformance
          rows={TOP_CONTENT}
          emptyVariant={emptyForCharts as "no-accounts" | "no-posts" | undefined}
        />
      </div>

      <Footer />
    </main>
  );
}

