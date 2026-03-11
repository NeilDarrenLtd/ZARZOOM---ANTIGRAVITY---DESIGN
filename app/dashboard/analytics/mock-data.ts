/**
 * Mock analytics data for the ZARZOOM Analytics page.
 * Structured so each section can be swapped to a real API call independently.
 */

// ─── AI Insights ──────────────────────────────────────────────────────────────
//
// TODO (real data): replace with:
//   GET /api/analytics/insights?workspaceId=<id>&from=<iso>&to=<iso>
//
// The response should return an ordered array of insight objects, highest
// confidence / impact first. The `category` field drives the icon and accent
// colour rendered by AiInsightsCard — extend the union as needed.
//
// category values:
//   "timing"     — best day / time to post observations
//   "growth"     — follower or reach growth signals
//   "content"    — content type / topic performance patterns
//   "engagement" — engagement rate or interaction trends
//   "platform"   — cross-platform comparison observations
//   "warning"    — declining metrics that need attention

export type InsightCategory =
  | "timing"
  | "growth"
  | "content"
  | "engagement"
  | "platform"
  | "warning";

export interface AiInsight {
  id: string;
  category: InsightCategory;
  title: string;
  body: string;
  /** Highlighted fragment within `body` that the card wraps in a green pill */
  highlight?: string;
  /** Optional CTA label — links to the most relevant section of the dashboard */
  ctaLabel?: string;
  ctaHref?: string;
}

export const AI_INSIGHTS: AiInsight[] = [
  {
    id: "ins-1",
    category: "timing",
    title: "Best day to post",
    body: "Video content posted on Tuesdays generates 2.4x more views than any other day of the week across your connected platforms.",
    highlight: "Tuesdays",
    ctaLabel: "Open Planner",
    ctaHref: "/dashboard/planner",
  },
  {
    id: "ins-2",
    category: "growth",
    title: "Instagram on a strong run",
    body: "Your Instagram engagement rate increased 18% this month — the highest single-month growth since your account was connected.",
    highlight: "+18% this month",
    ctaLabel: "View Instagram",
    ctaHref: "/dashboard/analytics",
  },
  {
    id: "ins-3",
    category: "content",
    title: "Educational content is your top performer",
    body: "Educational posts are generating 3.1x more saves and shares than promotional content. Your audience responds best to actionable takeaways.",
    highlight: "3.1x more saves and shares",
  },
  {
    id: "ins-4",
    category: "platform",
    title: "TikTok has your highest raw reach",
    body: "Despite having fewer followers on TikTok, your videos are reaching 920K people — more than any other platform. Consider increasing your posting frequency there.",
    highlight: "920K reach",
    ctaLabel: "See TikTok stats",
    ctaHref: "/dashboard/analytics",
  },
  {
    id: "ins-5",
    category: "engagement",
    title: "Carousel format outperforms single images",
    body: "Carousel posts across Instagram and LinkedIn average a 7.5% engagement rate versus 4.2% for single-image posts. Scheduling more carousels could compound your results.",
    highlight: "7.5% vs 4.2%",
    ctaLabel: "Create a carousel",
    ctaHref: "/dashboard/planner",
  },
  {
    id: "ins-6",
    category: "warning",
    title: "Facebook engagement is declining",
    body: "Your Facebook engagement rate dropped from 6.8% to 5.1% over the last 30 days. The AI suggests refreshing your content format or posting cadence on this platform.",
    highlight: "5.1% (was 6.8%)",
    ctaLabel: "Review Facebook",
    ctaHref: "/dashboard/analytics",
  },
];

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
//
// TODO (real data): replace with:
//   GET /api/analytics/top-content?workspaceId=<id>&from=<iso>&to=<iso>&limit=12
//
// `thumbnail` should be a CDN URL returned by the API; thumbnails are stored in
// Vercel Blob and referenced here as local public paths for mock purposes.

export interface ProfileSnapshot {
  followers: number;
  following: number;
  totalPosts: number;
  avgEngagementRate: string;
}

export interface ContentPerformanceRow {
  id: string;
  platform: string;
  /** Content format — Carousel, Article, Thread, Short Clip, Story Post, etc. */
  type: string;
  /** Opening hook / headline — the first line of the post */
  snippet: string;
  /** Full post caption */
  caption: string;
  /** Path to thumbnail image (local public path for mock; CDN URL in production) */
  thumbnail: string;
  /** Direct URL to the live post on the platform */
  platformUrl: string;
  // ── Metrics ──────────────────────────────────────────────────────────────
  // TODO (real data): populate from GET /api/analytics/post/:id
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
  engagementRate: string;
  publishedAt: string;
  aiGenerated: boolean;
  // ── Profile snapshots ─────────────────────────────────────────────────────
  // TODO (real data): populate from GET /api/analytics/post/:id/profile-snapshots
  // profileAtPost  = account stats captured at time of posting
  // profileLatest  = current account stats at time of API call
  profileAtPost: ProfileSnapshot;
  profileLatest: ProfileSnapshot;
}

export const TOP_CONTENT: ContentPerformanceRow[] = [
  {
    id: "1",
    platform: "Instagram",
    type: "Carousel",
    snippet: "5 AI productivity hacks your competitors aren't using yet",
    caption: "Stop working harder. Start working smarter. 🧠\n\nWe've spent the last 6 months testing every AI productivity tool on the market so you don't have to.\n\nHere are the 5 that actually moved the needle for our team →\n\nSave this post — you'll want to come back to it.\n\n#AI #Productivity #ContentStrategy #ZARZOOM",
    thumbnail: "/images/analytics/post-1.jpg",
    platformUrl: "https://www.instagram.com/",
    views: 42800,
    likes: 3100,
    comments: 410,
    shares: 620,
    saves: 1840,
    engagementRate: "7.5%",
    publishedAt: "Mar 8, 2026",
    aiGenerated: true,
    profileAtPost:  { followers: 52100, following: 420, totalPosts: 214, avgEngagementRate: "6.9%" },
    profileLatest:  { followers: 54200, following: 421, totalPosts: 218, avgEngagementRate: "7.1%" },
  },
  {
    id: "2",
    platform: "LinkedIn",
    type: "Article",
    snippet: "Why most social media strategies fail in 2026 (and how to fix yours)",
    caption: "I've reviewed over 300 brand social media strategies this year. The same pattern keeps appearing in the ones that fail.\n\nThey optimise for vanity metrics. Not outcomes.\n\nHere's the framework I now use with every client — and why it consistently outperforms the old playbook.\n\n[Swipe to read the full breakdown]\n\n#SocialMedia #MarketingStrategy #B2B #ContentMarketing",
    thumbnail: "/images/analytics/post-2.jpg",
    platformUrl: "https://www.linkedin.com/",
    views: 38100,
    likes: 2600,
    comments: 390,
    shares: 480,
    engagementRate: "7.6%",
    publishedAt: "Mar 5, 2026",
    aiGenerated: true,
    profileAtPost:  { followers: 17900, following: 610, totalPosts: 87, avgEngagementRate: "6.5%" },
    profileLatest:  { followers: 18700, following: 612, totalPosts: 91, avgEngagementRate: "6.9%" },
  },
  {
    id: "3",
    platform: "X / Twitter",
    type: "Thread",
    snippet: "We analyzed 10,000 viral posts. Here's what they all have in common",
    caption: "We analyzed 10,000 viral posts across Instagram, LinkedIn, TikTok and X.\n\nHere's what they all have in common (thread) 🧵\n\n1/ They all open with a pattern interrupt. Not a welcome. Not an intro. A hook that makes you stop scrolling.\n\n2/ They compress a complex idea into one sentence. The simpler the takeaway, the wider the reach.\n\n[Full thread continues…]\n\n#ViralContent #ContentStrategy #SocialMediaMarketing",
    thumbnail: "/images/analytics/post-3.jpg",
    platformUrl: "https://x.com/",
    views: 31400,
    likes: 2200,
    comments: 310,
    shares: 740,
    engagementRate: "7.7%",
    publishedAt: "Mar 3, 2026",
    aiGenerated: true,
    profileAtPost:  { followers: 21400, following: 880, totalPosts: 412, avgEngagementRate: "7.0%" },
    profileLatest:  { followers: 22100, following: 883, totalPosts: 421, avgEngagementRate: "7.2%" },
  },
  {
    id: "4",
    platform: "TikTok",
    type: "Short Clip",
    snippet: "This one tweak doubled our engagement in 48 hours",
    caption: "We changed one thing in our posting schedule and engagement doubled in 48 hours 👀\n\nNo new content. No new strategy. Just better timing.\n\nWatch to find out what we changed.\n\n#TikTokTips #SocialMediaGrowth #ContentCreator #ZARZOOM #GrowthHack",
    thumbnail: "/images/analytics/post-4.jpg",
    platformUrl: "https://www.tiktok.com/",
    views: 28600,
    likes: 1840,
    comments: 260,
    shares: 390,
    engagementRate: "7.0%",
    publishedAt: "Mar 1, 2026",
    aiGenerated: true,
    profileAtPost:  { followers: 37200, following: 290, totalPosts: 143, avgEngagementRate: "9.8%" },
    profileLatest:  { followers: 38900, following: 291, totalPosts: 149, avgEngagementRate: "10.3%" },
  },
  {
    id: "5",
    platform: "Instagram",
    type: "Story Post",
    snippet: "Behind the scenes: how our AI writes content that actually converts",
    caption: "People keep asking us: \"Is the content really AI-written?\"\n\nYes. And here's exactly how it works — no magic, no shortcuts.\n\nSwipe through for a behind-the-scenes look at our content pipeline.\n\nTag a brand or creator who should see this 👇\n\n#BehindTheScenes #AIContent #ContentMarketing #ZARZOOM",
    thumbnail: "/images/analytics/post-5.jpg",
    platformUrl: "https://www.instagram.com/",
    views: 21900,
    likes: 1380,
    comments: 190,
    shares: 280,
    saves: 920,
    engagementRate: "7.0%",
    publishedAt: "Feb 27, 2026",
    aiGenerated: true,
    profileAtPost:  { followers: 51800, following: 418, totalPosts: 211, avgEngagementRate: "6.8%" },
    profileLatest:  { followers: 54200, following: 421, totalPosts: 218, avgEngagementRate: "7.1%" },
  },
  {
    id: "6",
    platform: "LinkedIn",
    type: "Carousel",
    snippet: "The 7-step framework we use to build thought leadership at scale",
    caption: "Most \"thought leadership\" is just recycled opinions dressed up as insight.\n\nHere's the 7-step framework we actually use to build genuine authority at scale — for brands with real things to say.\n\nStep 1: Find the intersection of what you know deeply and what your audience fears most.\n\n[Swipe for steps 2–7]\n\n#ThoughtLeadership #B2BMarketing #LinkedInStrategy #ContentFramework",
    thumbnail: "/images/analytics/post-6.jpg",
    platformUrl: "https://www.linkedin.com/",
    views: 19200,
    likes: 1180,
    comments: 160,
    shares: 220,
    engagementRate: "6.8%",
    publishedAt: "Feb 24, 2026",
    aiGenerated: false,
    profileAtPost:  { followers: 17600, following: 608, totalPosts: 84, avgEngagementRate: "6.4%" },
    profileLatest:  { followers: 18700, following: 612, totalPosts: 91, avgEngagementRate: "6.9%" },
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
