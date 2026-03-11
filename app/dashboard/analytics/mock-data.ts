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

// ─── Content Reach Over Time (30-day, "Exposure" metric) ─────────────────────
//
// TODO (real data): replace with API call scoped to workspace + date filter:
//   GET /api/analytics/reach?workspaceId=<id>&from=<iso>&to=<iso>&platform=<all|slug>
//
// "Exposure" is a normalised cross-platform metric that collapses Reach / Views /
// Impressions into one comparable number — each platform surfaces a different
// primary metric, so the backend should map them consistently before returning.

export interface ReachDataPoint {
  date: string;      // "Feb 10", "Feb 11", … — used for XAxis + tooltip
  isoDate: string;   // full ISO string — useful for future API param building
  exposure: number;  // normalised cross-platform exposure value
}

function makeReachData(): ReachDataPoint[] {
  const points: ReachDataPoint[] = [];
  const now = new Date(2026, 2, 11); // March 11 2026 (month is 0-indexed)
  // Start with a realistic base and apply a gentle upward trend + organic noise
  let base = 28000;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const iso   = d.toISOString().split("T")[0];
    // Trending growth with a weekend dip pattern (day 0 = Sunday) + random noise
    const dayOfWeek = d.getDay();
    const weekendDip = dayOfWeek === 0 || dayOfWeek === 6 ? 0.82 : 1;
    const trend  = Math.round((29 - i) * 520);
    const noise  = Math.round((Math.random() - 0.4) * 6000);
    const value  = Math.max(8000, Math.round((base + trend + noise) * weekendDip));
    points.push({ date: label, isoDate: iso, exposure: value });
    base += 180; // small compounding drift upward
  }
  return points;
}

export const REACH_OVER_TIME: ReachDataPoint[] = makeReachData();

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

// ─── Per-Platform Performance Cards ──────────────────────────────────────────
//
// Each platform exposes a different primary metric (Reach vs Views vs Impressions).
// Metrics are defined as a key-value map so the card component can render them
// dynamically — no hardcoded assumptions about what is available.
//
// TODO (real data): replace with:
//   GET /api/analytics/platform-cards?workspaceId=<id>&from=<iso>&to=<iso>
//
// Supported metric keys (card renders whatever is present):
//   followers        — total follower / subscriber count
//   exposureLabel    — human label for the primary exposure metric ("Reach", "Views", etc.)
//   exposure         — numeric exposure value
//   likes            — total likes / reactions
//   comments         — total comments
//   shares           — shares / reposts / retweets
//   saves            — saves / bookmarks (Instagram, Pinterest, etc.)
//   views            — video views where distinct from reach (YouTube, TikTok)
//   clickThroughs    — link clicks (LinkedIn, X)
//   engagementRate   — percentage string e.g. "7.1%"

export interface PlatformMetrics {
  followers?: number;
  exposureLabel?: string; // e.g. "Reach", "Impressions", "Views"
  exposure?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  views?: number;
  clickThroughs?: number;
  engagementRate?: string;
}

export interface PlatformCard {
  id: string;
  platform: string;
  /** Tailwind bg colour class for the icon badge */
  colorClass: string;
  /** Hex accent for inline styles where needed */
  accent: string;
  metrics: PlatformMetrics;
  /** true = connected, false = not yet connected (greyed-out state) */
  connected: boolean;
}

export const PLATFORM_CARDS: PlatformCard[] = [
  {
    id: "instagram",
    platform: "Instagram",
    colorClass: "bg-pink-50",
    accent: "#E1306C",
    connected: true,
    metrics: {
      followers: 54200,
      exposureLabel: "Reach",
      exposure: 480000,
      likes: 21800,
      comments: 4300,
      shares: 6100,
      saves: 3900,
      engagementRate: "7.1%",
    },
  },
  {
    id: "tiktok",
    platform: "TikTok",
    colorClass: "bg-gray-50",
    accent: "#010101",
    connected: true,
    metrics: {
      followers: 38900,
      exposureLabel: "Views",
      exposure: 920000,
      likes: 74100,
      comments: 8200,
      shares: 12400,
      engagementRate: "10.3%",
    },
  },
  {
    id: "youtube",
    platform: "YouTube",
    colorClass: "bg-red-50",
    accent: "#FF0000",
    connected: true,
    metrics: {
      followers: 12400,
      exposureLabel: "Views",
      exposure: 210000,
      likes: 9800,
      comments: 1420,
      shares: 3100,
      engagementRate: "5.8%",
    },
  },
  {
    id: "linkedin",
    platform: "LinkedIn",
    colorClass: "bg-blue-50",
    accent: "#0A66C2",
    connected: true,
    metrics: {
      followers: 18700,
      exposureLabel: "Impressions",
      exposure: 310000,
      likes: 14200,
      comments: 2100,
      shares: 3800,
      clickThroughs: 4600,
      engagementRate: "6.9%",
    },
  },
  {
    id: "facebook",
    platform: "Facebook",
    colorClass: "bg-blue-50",
    accent: "#1877F2",
    connected: true,
    metrics: {
      followers: 29300,
      exposureLabel: "Reach",
      exposure: 185000,
      likes: 8900,
      comments: 1640,
      shares: 2900,
      engagementRate: "5.1%",
    },
  },
  {
    id: "x",
    platform: "X / Twitter",
    colorClass: "bg-gray-50",
    accent: "#14171A",
    connected: true,
    metrics: {
      followers: 22100,
      exposureLabel: "Impressions",
      exposure: 260000,
      likes: 11300,
      comments: 1820,
      shares: 4400,
      clickThroughs: 3200,
      engagementRate: "7.2%",
    },
  },
  {
    id: "pinterest",
    platform: "Pinterest",
    colorClass: "bg-red-50",
    accent: "#E60023",
    connected: false,
    metrics: {},
  },
  {
    id: "threads",
    platform: "Threads",
    colorClass: "bg-gray-50",
    accent: "#000000",
    connected: false,
    metrics: {},
  },
];

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
