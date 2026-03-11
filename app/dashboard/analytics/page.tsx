"use client";

import { useState } from "react";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import {
  useActiveWorkspace,
  useWorkspaceSwitchKey,
  useWorkspaceFetcher,
  workspaceScopedKey,
} from "@/lib/workspace/context";

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

// Imported for type-checking the future SWR hooks — not used at runtime yet.
// Remove this comment once real data fetching is wired up.
import type {
  WorkspaceAnalytics,
  AggregatedAnalytics,
  MediaListResponse,
} from "./analytics.types";

// ─── Data scenarios ───────────────────────────────────────────────────────────
// Simulates the three states the page must handle gracefully.
//
// TODO (real data): derive this from the API response instead of a toggle:
//   - "no-accounts" → WorkspaceAnalytics.connectedPlatformsCount === 0
//   - "no-posts"    → WorkspaceAnalytics.totals.posts === 0
//   - "normal"      → everything else

type DataScenario = "normal" | "no-accounts" | "no-posts";

const SCENARIO_LABELS: Record<DataScenario, string> = {
  normal:         "Normal (data available)",
  "no-accounts":  "No accounts connected",
  "no-posts":     "Accounts connected, no posts yet",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * /dashboard/analytics — AI-powered analytics for ZARZOOM.
 *
 * ── Workspace reactivity ──────────────────────────────────────────────────────
 * The inner <div key={workspaceSwitchKey}> remounts the entire analytics subtree
 * when the active workspace changes, clearing all local component state (open
 * drawers, active chart metric selections, etc.) and ensuring SWR keys rotate
 * so stale data from the previous workspace is never shown.
 *
 * ── Wiring real data ─────────────────────────────────────────────────────────
 * All four API endpoints are pre-annotated below. Steps to activate:
 *
 *   1. Uncomment each useSWR block.
 *   2. Replace the corresponding MOCK_CONSTANT with the `data` from each hook.
 *   3. Forward `isLoading` to the `emptyVariant="loading"` prop where applicable.
 *   4. Derive `scenario` from WorkspaceAnalytics instead of the demo toggle.
 *   5. Remove the amber scenario switcher and `DataScenario` type above.
 *
 * Type contracts (see analytics.types.ts):
 *   GET /api/v1/analytics/profile     → WorkspaceAnalytics   → KpiSummaryStrip, AiInsightsCard
 *   GET /api/v1/analytics/aggregated  → AggregatedAnalytics  → charts, PlatformCards
 *   GET /api/v1/analytics/media       → MediaListResponse    → ContentPerformanceSection
 *   GET /api/v1/analytics/posts/:id   → PostAnalytics        → PostDetailDrawer (lazy, per-post)
 */
export default function AnalyticsPage() {
  const activeWorkspaceId  = useActiveWorkspace();
  const workspaceSwitchKey = useWorkspaceSwitchKey();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetcher            = useWorkspaceFetcher();

  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_FILTERS);

  // TODO (real data): replace with useSWR — remove demo toggle
  const [scenario, setScenario] = useState<DataScenario>("normal");

  // ── Real data hooks (uncomment when backend is ready) ────────────────────
  //
  // 1. Profile analytics → KpiSummaryStrip + AiInsightsCard
  //    const profileKey = workspaceScopedKey("/api/v1/analytics/profile", activeWorkspaceId, filters);
  //    const { data: profileData, isLoading: profileLoading } = useSWR<WorkspaceAnalytics>(profileKey, fetcher);
  //
  // 2. Aggregated analytics → charts + PlatformCards
  //    const aggregatedKey = workspaceScopedKey("/api/v1/analytics/aggregated", activeWorkspaceId, filters);
  //    const { data: aggregatedData, isLoading: aggregatedLoading } = useSWR<AggregatedAnalytics>(aggregatedKey, fetcher);
  //
  // 3. Media list → ContentPerformanceSection
  //    const mediaKey = workspaceScopedKey("/api/v1/analytics/media", activeWorkspaceId, filters);
  //    const { data: mediaData, isLoading: mediaLoading } = useSWR<MediaListResponse>(mediaKey, fetcher);
  //
  // 4. Post detail → PostDetailDrawer (lazy, triggered on card click)
  //    Fetch inside PostDetailDrawer using:
  //      const postKey = postId ? workspaceScopedKey(`/api/v1/analytics/posts/${postId}`, activeWorkspaceId) : null;
  //      const { data: postData } = useSWR<PostAnalytics>(postKey, fetcher);

  // TODO (real data): derive from WorkspaceAnalytics
  const workspaceName = activeWorkspaceId ? "My Workspace" : null;

  // Derive empty-state variants from the active scenario
  const noAccounts = scenario === "no-accounts";
  const noPosts    = scenario === "no-posts";
  const emptyForCharts    = noAccounts ? "no-accounts" : noPosts ? "no-posts" : undefined;
  const emptyForPlatforms = noAccounts ? "no-accounts" : undefined;

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <SiteNavbar />

      {/*
        key={workspaceSwitchKey} — remounts this subtree on every workspace switch.
        This ensures:
          - All local component state (open drawers, selected chart metric) is cleared.
          - SWR keys (which include activeWorkspaceId) rotate and refetch for the new workspace.
          - No stale data from a previous workspace is ever visible.
        See: useWorkspaceSwitchKey() in @/lib/workspace/context
      */}
      <div key={workspaceSwitchKey} className="flex-1 max-w-6xl mx-auto w-full px-4 py-10">
        <AnalyticsHeader workspaceName={workspaceName} />

        {/* Filter bar — date presets, custom date range, platform selector */}
        <AnalyticsFilterBar filters={filters} onChange={setFilters} />

        {/* ── Demo: data scenario switcher — remove when wiring real data ──── */}
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

        {/*
          KpiSummaryStrip
          TODO (real data): replace KPI_METRICS with profileData mapped to KpiMetric[]:
            partial={profileLoading || !profileData}
            metrics={mapWorkspaceAnalyticsToKpis(profileData)}
        */}
        <AnalyticsSummaryStrip
          metrics={KPI_METRICS}
          partial={noAccounts || noPosts}
        />

        {/*
          AiInsightsCard
          TODO (real data): replace AI_INSIGHTS with profileData.insights (WorkspaceInsight[]):
            insights={profileData?.insights ?? []}
            emptyVariant={!profileData ? "loading" : emptyForCharts}
        */}
        <AiInsightsCard
          insights={AI_INSIGHTS}
          emptyVariant={emptyForCharts as "no-accounts" | "no-posts" | undefined}
        />

        {/*
          PerformanceChart — ContentReachChart
          TODO (real data): replace REACH_OVER_TIME with aggregatedData.dailySeries:
            data={aggregatedData?.dailySeries ?? []}
            emptyVariant={aggregatedLoading ? "loading" : emptyForCharts}
        */}
        <ContentReachChart data={REACH_OVER_TIME} emptyVariant={emptyForCharts} />

        {/*
          PerformanceChart — EngagementChart
          TODO (real data): same aggregatedData.dailySeries — both charts share the series.
            data={aggregatedData?.dailySeries ?? []}
        */}
        <EngagementChart data={DAILY_ENGAGEMENT} emptyVariant={emptyForCharts} />

        {/*
          PlatformAnalytics section
          TODO (real data): replace PLATFORM_STATS + WEEKLY_BY_PLATFORM with aggregatedData:
            platformStats={aggregatedData?.platforms ?? []}
            weeklyData={aggregatedData?.weeklySeries ?? []}
        */}
        <PlatformAnalytics
          platformStats={PLATFORM_STATS}
          weeklyData={WEEKLY_BY_PLATFORM}
          emptyVariant={emptyForCharts}
        />

        {/*
          PlatformCards
          TODO (real data): replace PLATFORM_CARDS with aggregatedData.platforms mapped to PlatformCard[].
            cards={mapPlatformDataToCards(aggregatedData?.platforms ?? [])}
        */}
        <PlatformPerformanceCards
          cards={PLATFORM_CARDS}
          emptyVariant={emptyForPlatforms}
        />

        {/*
          ContentPerformanceSection
          TODO (real data): replace TOP_CONTENT with mediaData.items mapped to ContentPerformanceRow[]:
            rows={mapMediaItemsToRows(mediaData?.items ?? [])}
            emptyVariant={mediaLoading ? "loading" : emptyForCharts}
          PostDetailDrawer: fetch PostAnalytics lazily inside ContentPerformance on card click.
        */}
        <ContentPerformance
          rows={TOP_CONTENT}
          emptyVariant={emptyForCharts as "no-accounts" | "no-posts" | undefined}
        />
      </div>

      <Footer />
    </main>
  );
}

