/**
 * Mock analytics data for the ZARZOOM Analytics page.
 * Structured so each section can be swapped to a real API call independently.
 */

// ─── KPI Summary Strip ────────────────────────────────────────────────────────

export type KpiVariant = "accent" | "neutral" | "info";

export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  /** e.g. "+12% vs last period" — omit for purely informational cards */
  trend?: string;
  /** true = up/positive (green), false = down/negative (red), undefined = neutral */
  positive?: boolean;
  variant: KpiVariant;
}

export const KPI_METRICS: KpiMetric[] = [
  {
    id: "impressions",
    label: "Total Impressions",
    value: "1.24M",
    trend: "+18.4% vs last period",
    positive: true,
    variant: "accent",
  },
  {
    id: "followers",
    label: "Total Followers",
    value: "128.6K",
    trend: "+4,821 this period",
    positive: true,
    variant: "accent",
  },
  {
    id: "engagements",
    label: "Engagement Actions",
    value: "87.3K",
    trend: "+12.1% vs last period",
    positive: true,
    variant: "accent",
  },
  {
    id: "platforms",
    label: "Connected Platforms",
    value: "4",
    trend: "Instagram, LinkedIn, X, TikTok",
    variant: "neutral",
  },
  {
    id: "best_platform",
    label: "Best Performing",
    value: "Instagram",
    trend: "480K impressions · 7.1% ER",
    variant: "info",
  },
];

// ─── Main Engagement Chart (30-day daily) ─────────────────────────────────────

export interface EngagementDataPoint {
  date: string;
  impressions: number;
  engagements: number;
  posts: number;
}

function makeDailyData(): EngagementDataPoint[] {
  const data: EngagementDataPoint[] = [];
  const now = new Date(2026, 2, 11); // March 11 2026
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const base = 30000 + Math.round(Math.sin(i / 4) * 8000);
    const noise = Math.round(Math.random() * 5000);
    data.push({
      date: label,
      impressions: base + noise,
      engagements: Math.round((base + noise) * (0.06 + Math.random() * 0.03)),
      posts: Math.round(Math.random() * 4) + 1,
    });
  }
  return data;
}

export const DAILY_ENGAGEMENT: EngagementDataPoint[] = makeDailyData();

// ─── Platform Analytics ───────────────────────────────────────────────────────

export interface PlatformStat {
  platform: string;
  color: string;
  impressions: number;
  engagements: number;
  posts: number;
  followers: number;
  engagementRate: string;
}

export const PLATFORM_STATS: PlatformStat[] = [
  {
    platform: "Instagram",
    color: "#E1306C",
    impressions: 480000,
    engagements: 34200,
    posts: 68,
    followers: 2100,
    engagementRate: "7.1%",
  },
  {
    platform: "LinkedIn",
    color: "#0A66C2",
    impressions: 310000,
    engagements: 21400,
    posts: 52,
    followers: 1380,
    engagementRate: "6.9%",
  },
  {
    platform: "X / Twitter",
    color: "#14171A",
    impressions: 260000,
    engagements: 18600,
    posts: 61,
    followers: 820,
    engagementRate: "7.2%",
  },
  {
    platform: "TikTok",
    color: "#010101",
    impressions: 190000,
    engagements: 13100,
    posts: 33,
    followers: 521,
    engagementRate: "6.9%",
  },
];

export interface PlatformShare {
  platform: string;
  value: number;
  color: string;
}

export const PLATFORM_SHARE: PlatformShare[] = PLATFORM_STATS.map((p) => ({
  platform: p.platform,
  value: p.impressions,
  color: p.color,
}));

// ─── Content Performance ──────────────────────────────────────────────────────

export interface ContentPerformanceRow {
  id: string;
  platform: string;
  type: string;
  snippet: string;
  impressions: number;
  engagements: number;
  engagementRate: string;
  publishedAt: string;
  aiGenerated: boolean;
}

export const TOP_CONTENT: ContentPerformanceRow[] = [
  {
    id: "1",
    platform: "Instagram",
    type: "Carousel",
    snippet: "5 AI productivity hacks your competitors aren't using yet",
    impressions: 42800,
    engagements: 3210,
    engagementRate: "7.5%",
    publishedAt: "Mar 8, 2026",
    aiGenerated: true,
  },
  {
    id: "2",
    platform: "LinkedIn",
    type: "Article",
    snippet: "Why most social media strategies fail in 2026 (and how to fix yours)",
    impressions: 38100,
    engagements: 2890,
    engagementRate: "7.6%",
    publishedAt: "Mar 5, 2026",
    aiGenerated: true,
  },
  {
    id: "3",
    platform: "X / Twitter",
    type: "Thread",
    snippet: "We analyzed 10,000 viral posts. Here's what they all have in common",
    impressions: 31400,
    engagements: 2410,
    engagementRate: "7.7%",
    publishedAt: "Mar 3, 2026",
    aiGenerated: true,
  },
  {
    id: "4",
    platform: "TikTok",
    type: "Short Clip",
    snippet: "This one tweak doubled our engagement in 48 hours",
    impressions: 28600,
    engagements: 2010,
    engagementRate: "7.0%",
    publishedAt: "Mar 1, 2026",
    aiGenerated: true,
  },
  {
    id: "5",
    platform: "Instagram",
    type: "Story Post",
    snippet: "Behind the scenes: how our AI writes content that actually converts",
    impressions: 21900,
    engagements: 1540,
    engagementRate: "7.0%",
    publishedAt: "Feb 27, 2026",
    aiGenerated: true,
  },
  {
    id: "6",
    platform: "LinkedIn",
    type: "Carousel",
    snippet: "The 7-step framework we use to build thought leadership at scale",
    impressions: 19200,
    engagements: 1310,
    engagementRate: "6.8%",
    publishedAt: "Feb 24, 2026",
    aiGenerated: false,
  },
];

// ─── Weekly Breakdown (bar chart) ─────────────────────────────────────────────

export interface WeeklyDataPoint {
  week: string;
  instagram: number;
  linkedin: number;
  twitter: number;
  tiktok: number;
}

export const WEEKLY_BY_PLATFORM: WeeklyDataPoint[] = [
  { week: "Feb 10", instagram: 98000, linkedin: 64000, twitter: 52000, tiktok: 31000 },
  { week: "Feb 17", instagram: 112000, linkedin: 71000, twitter: 58000, tiktok: 38000 },
  { week: "Feb 24", instagram: 104000, linkedin: 68000, twitter: 55000, tiktok: 42000 },
  { week: "Mar 3",  instagram: 128000, linkedin: 79000, twitter: 66000, tiktok: 47000 },
  { week: "Mar 10", instagram: 138000, linkedin: 88000, twitter: 79000, tiktok: 52000 },
];
