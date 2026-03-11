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
 */
export default function AnalyticsPage() {
  const activeWorkspaceId = useActiveWorkspace();
  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_FILTERS);

  // TODO (real data): derive workspace name from workspace list instead of fallback
  const workspaceName = activeWorkspaceId ? "My Workspace" : null;

  // TODO (real data): when filters change, re-fetch all analytics sections:
  //   const { data: kpiData }        = useSWR(["/api/analytics/kpis",        filters, activeWorkspaceId])
  //   const { data: engagementData } = useSWR(["/api/analytics/engagement",   filters, activeWorkspaceId])
  //   const { data: platformData }   = useSWR(["/api/analytics/platforms",    filters, activeWorkspaceId])
  //   const { data: contentData }    = useSWR(["/api/analytics/top-content",  filters, activeWorkspaceId])

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <SiteNavbar />

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-10">
        <AnalyticsHeader workspaceName={workspaceName} />

        {/* Filter bar: date presets, custom date range, platform selector */}
        <AnalyticsFilterBar filters={filters} onChange={setFilters} />

        <AnalyticsSummaryStrip metrics={KPI_METRICS} />

        {/* TODO (real data): pass useSWR insights instead of AI_INSIGHTS */}
        <AiInsightsCard insights={AI_INSIGHTS} />

        {/* TODO (real data): pass useSWR reach data instead of REACH_OVER_TIME */}
        <ContentReachChart data={REACH_OVER_TIME} />

        <EngagementChart data={DAILY_ENGAGEMENT} />

        <PlatformAnalytics
          platformStats={PLATFORM_STATS}
          weeklyData={WEEKLY_BY_PLATFORM}
        />

        {/* TODO (real data): pass useSWR platform card data instead of PLATFORM_CARDS */}
        <PlatformPerformanceCards cards={PLATFORM_CARDS} />

        <ContentPerformance rows={TOP_CONTENT} />
      </div>

      <Footer />
    </main>
  );
}

