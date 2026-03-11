"use client";

import { useState } from "react";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import { useActiveWorkspace } from "@/lib/workspace/context";

import AnalyticsHeader from "./AnalyticsHeader";
import AnalyticsSummaryStrip from "./AnalyticsSummaryStrip";
import EngagementChart from "./EngagementChart";
import PlatformAnalytics from "./PlatformAnalytics";
import ContentPerformance from "./ContentPerformance";

import {
  SUMMARY_METRICS,
  DAILY_ENGAGEMENT,
  PLATFORM_STATS,
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
 */
export default function AnalyticsPage() {
  const activeWorkspaceId = useActiveWorkspace();
  const [dateRange, setDateRange] = useState("Last 30 days");

  // TODO (real data): derive workspace name from workspace list instead of fallback
  const workspaceName = activeWorkspaceId ? "My Workspace" : null;

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <SiteNavbar />

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-10">
        <AnalyticsHeader
          workspaceName={workspaceName}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        <AnalyticsSummaryStrip metrics={SUMMARY_METRICS} />

        <EngagementChart data={DAILY_ENGAGEMENT} />

        <PlatformAnalytics
          platformStats={PLATFORM_STATS}
          weeklyData={WEEKLY_BY_PLATFORM}
        />

        <ContentPerformance rows={TOP_CONTENT} />
      </div>

      <Footer />
    </main>
  );
}
