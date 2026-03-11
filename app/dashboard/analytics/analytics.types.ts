/**
 * analytics.types.ts
 *
 * Canonical TypeScript interfaces for the ZARZOOM Analytics API surface.
 * These types define the contract between the frontend and the future backend.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * API INTEGRATION MAP
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * All endpoints are workspace-scoped.
 * Pass X-Tenant-Id header via useWorkspaceFetch() from @/lib/workspace/context.
 * Build SWR keys with workspaceScopedKey(path, activeWorkspaceId, filters).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ 1. PROFILE ANALYTICS                                                        │
 * │    GET /api/v1/analytics/profile                                            │
 * │    Returns: WorkspaceAnalytics                                              │
 * │    Populates: KpiSummaryStrip, AiInsightsCard                               │
 * │                                                                             │
 * │    Query params:                                                            │
 * │      from     ISO date string  e.g. "2026-02-10"                           │
 * │      to       ISO date string  e.g. "2026-03-11"                           │
 * │      platform "all" | platform slug e.g. "instagram"                       │
 * │                                                                             │
 * │ 2. AGGREGATED ANALYTICS                                                     │
 * │    GET /api/v1/analytics/aggregated                                         │
 * │    Returns: AggregatedAnalytics                                             │
 * │    Populates: PerformanceChart (reach + engagement), PlatformCards,        │
 * │              PlatformAnalytics section (bar chart + pie)                   │
 * │                                                                             │
 * │    Query params: same as profile analytics                                  │
 * │                                                                             │
 * │ 3. POST ANALYTICS                                                           │
 * │    GET /api/v1/analytics/posts/:postId                                      │
 * │    Returns: PostAnalytics                                                   │
 * │    Populates: PostDetailDrawer (metrics, profile snapshots)                 │
 * │                                                                             │
 * │ 4. MEDIA LIST                                                               │
 * │    GET /api/v1/analytics/media                                              │
 * │    Returns: MediaListResponse                                               │
 * │    Populates: ContentPerformanceSection (top-performing post grid)          │
 * │                                                                             │
 * │    Query params:                                                            │
 * │      from, to, platform  — same as above                                   │
 * │      limit    number     default 12                                         │
 * │      sort     "engagement_rate" | "views" | "likes" — default "engagement_rate" │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WORKSPACE REACTIVITY
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * The analytics page MUST re-fetch all data when the active workspace changes.
 * Pattern to follow in page.tsx:
 *
 *   const activeWorkspaceId  = useActiveWorkspace();
 *   const workspaceSwitchKey = useWorkspaceSwitchKey();
 *   const fetcher            = useWorkspaceFetcher<T>();
 *
 *   // Key includes workspaceId — SWR refetches automatically on workspace switch.
 *   const { data } = useSWR(
 *     workspaceScopedKey("/api/v1/analytics/profile", activeWorkspaceId, filters),
 *     fetcher
 *   );
 *
 *   // Wrap the page subtree with key={workspaceSwitchKey} to reset all local
 *   // component state (e.g. open drawers, active chart metric) on switch.
 *   return <div key={workspaceSwitchKey}>...</div>;
 */

// ─── Shared primitives ────────────────────────────────────────────────────────

/** ISO 8601 date string, e.g. "2026-03-11" */
export type ISODateString = string;

/** Percentage as a formatted string, e.g. "7.1%" */
export type PercentageString = string;

/**
 * Platform identifier slugs supported by the API.
 * Extend this union as new integrations are added.
 */
export type PlatformSlug =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "facebook"
  | "x"
  | "pinterest"
  | "threads";

/**
 * The primary reach metric each platform exposes.
 * Used to label the "exposure" column on platform cards and charts.
 */
export type ExposureMetricLabel = "Reach" | "Views" | "Impressions";

// ─── 1. WorkspaceAnalytics ────────────────────────────────────────────────────
//
// Returned by: GET /api/v1/analytics/profile
// Populates:   KpiSummaryStrip, AiInsightsCard

/**
 * Aggregate KPIs for the whole workspace across all connected platforms
 * for the requested date range.
 */
export interface WorkspaceAnalytics {
  workspaceId: string;

  /** Human-readable date range label, e.g. "Feb 10 – Mar 11, 2026" */
  periodLabel: string;

  /** ISO date range used to generate this response */
  period: {
    from: ISODateString;
    to: ISODateString;
  };

  /** Cross-platform totals for the period */
  totals: {
    impressions: number;
    /** Normalised cross-platform exposure (Reach + Views + Impressions mapped to one signal) */
    exposure: number;
    engagements: number;
    followers: number;
    posts: number;
  };

  /** Period-over-period deltas (positive = improvement) */
  deltas: {
    impressionsDelta: number;   // e.g. 18.4 → "+18.4%"
    exposureDelta: number;
    engagementsDelta: number;
    followersDelta: number;
    postsDelta: number;
  };

  /** Slug of the best-performing platform by engagement rate this period */
  bestPlatform: PlatformSlug | null;

  /** Number of platforms currently connected to this workspace */
  connectedPlatformsCount: number;

  /** Ordered list of AI-generated insights (highest impact first) */
  insights: WorkspaceInsight[];
}

/**
 * A single AI insight generated by analysing the workspace's performance data.
 */
export interface WorkspaceInsight {
  id: string;

  /**
   * Insight category — determines icon and accent colour in AiInsightsCard.
   * "timing"     — best day / time to post
   * "growth"     — follower or reach growth signals
   * "content"    — content type / topic performance patterns
   * "engagement" — engagement rate or interaction trends
   * "platform"   — cross-platform comparison observations
   * "warning"    — declining metrics that need attention
   */
  category:
    | "timing"
    | "growth"
    | "content"
    | "engagement"
    | "platform"
    | "warning";

  title: string;
  body: string;

  /**
   * A key phrase within `body` the UI should highlight in a green pill.
   * Omit if no fragment needs emphasis.
   */
  highlight?: string;

  /** Confidence score 0–1 assigned by the AI engine. */
  confidence: number;

  /** Optional deep-link to the most relevant dashboard section for this insight. */
  ctaLabel?: string;
  ctaHref?: string;
}

// ─── 2. AggregatedAnalytics ───────────────────────────────────────────────────
//
// Returned by: GET /api/v1/analytics/aggregated
// Populates:   PerformanceChart (ContentReachChart + EngagementChart),
//              PlatformAnalytics section, PlatformCards

/**
 * Full aggregated analytics for the workspace — time-series and per-platform breakdowns.
 */
export interface AggregatedAnalytics {
  workspaceId: string;

  period: {
    from: ISODateString;
    to: ISODateString;
  };

  /**
   * Daily data points for the PerformanceChart (ContentReachChart + EngagementChart).
   * One entry per calendar day in the requested range.
   */
  dailySeries: DailyAnalyticsPoint[];

  /**
   * Per-platform aggregates for the platform analytics section.
   * Connected platforms only — disconnected platforms are NOT included.
   */
  platforms: PlatformAnalyticsData[];

  /**
   * Weekly breakdown by platform for the stacked bar chart.
   * Each entry represents one ISO week.
   */
  weeklySeries: WeeklyPlatformPoint[];
}

/**
 * A single day's aggregated metrics across all connected platforms.
 * Used for the ContentReachChart (exposure) and EngagementChart (impressions, engagements, posts).
 */
export interface DailyAnalyticsPoint {
  /** Formatted date label for chart XAxis, e.g. "Mar 11" */
  date: string;

  /** Full ISO date for building API filter params */
  isoDate: ISODateString;

  /**
   * Normalised cross-platform exposure — the primary metric for ContentReachChart.
   * Backend maps each platform's primary metric (Reach / Views / Impressions) to this field.
   */
  exposure: number;

  /** Total impressions across all platforms */
  impressions: number;

  /** Total engagement actions (likes + comments + shares + saves) */
  engagements: number;

  /** Number of posts published on this day */
  posts: number;
}

/**
 * Aggregated analytics for a single connected platform over the period.
 * Used for the platform breakdown table, bar chart, and pie chart.
 */
export interface PlatformAnalyticsData {
  /** Platform slug, e.g. "instagram" */
  id: PlatformSlug;

  /** Human-readable platform name, e.g. "Instagram" */
  platform: string;

  /**
   * Hex colour for chart rendering.
   * Passed directly to Recharts — do NOT use CSS variables here.
   */
  color: string;

  /** Label for the primary exposure metric on this platform */
  exposureLabel: ExposureMetricLabel;

  impressions: number;
  exposure: number;
  engagements: number;
  posts: number;

  /**
   * Net new followers gained during the period (not the total follower count).
   * Use ProfileAnalytics.currentFollowers for the total.
   */
  followersGained: number;

  engagementRate: PercentageString;

  /** true = API returned data for this platform; false = metrics are unavailable */
  hasData: boolean;
}

/**
 * One week's impression counts broken down by platform.
 * Used for the stacked BarChart in PlatformAnalytics.
 */
export interface WeeklyPlatformPoint {
  /** Week start label for XAxis, e.g. "Feb 10" */
  week: string;

  /** Keyed by PlatformSlug — value is total impressions for that week */
  [platform: string]: number | string; // string to accommodate the `week` key
}

// ─── 3. PostAnalytics ─────────────────────────────────────────────────────────
//
// Returned by: GET /api/v1/analytics/posts/:postId
// Populates:   PostDetailDrawer

/**
 * Full analytics for a single published post.
 * Fetched lazily when the user opens the PostDetailDrawer.
 */
export interface PostAnalytics {
  postId: string;
  workspaceId: string;

  platform: PlatformSlug;

  /** Content format, e.g. "Carousel", "Article", "Thread", "Short Clip" */
  type: string;

  /** Opening hook / first line of the post */
  snippet: string;

  /** Full post caption text */
  caption: string;

  /**
   * CDN URL of the post thumbnail.
   * In production: returned by the API from Vercel Blob storage.
   * In mock: local public path, e.g. "/images/analytics/post-1.jpg"
   */
  thumbnailUrl: string;

  /** Direct link to the live post on the platform */
  platformUrl: string;

  /** ISO timestamp of when the post was published */
  publishedAt: ISODateString;

  /** true = this post was generated by the ZARZOOM AI engine */
  aiGenerated: boolean;

  /** Post-level engagement metrics */
  metrics: PostMetrics;

  /**
   * Account stats captured at the moment the post was published.
   * Used in PostDetailDrawer to show "before" context.
   * Populated from: GET /api/v1/analytics/posts/:postId/profile-snapshots
   */
  profileAtPost: AccountSnapshot;

  /**
   * Current account stats as of the API call time.
   * Used in PostDetailDrawer to show growth since publishing.
   * Populated from: GET /api/v1/analytics/posts/:postId/profile-snapshots
   */
  profileLatest: AccountSnapshot;
}

/**
 * Engagement metrics for a single post.
 * Not all fields are available on every platform — optional fields may be omitted.
 */
export interface PostMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;

  /** Available on Instagram and Pinterest */
  saves?: number;

  /** Available on LinkedIn and X */
  clickThroughs?: number;

  engagementRate: PercentageString;
}

/**
 * A snapshot of the connected account's profile stats at a point in time.
 * Stored by the backend at time-of-posting and refreshed on each API call.
 */
export interface AccountSnapshot {
  followers: number;
  following: number;
  totalPosts: number;
  avgEngagementRate: PercentageString;
  /** ISO timestamp of when this snapshot was captured */
  capturedAt?: ISODateString;
}

// ─── 4. MediaListResponse ─────────────────────────────────────────────────────
//
// Returned by: GET /api/v1/analytics/media
// Populates:   ContentPerformanceSection

/**
 * Paginated list of top-performing posts for the ContentPerformanceSection grid.
 */
export interface MediaListResponse {
  workspaceId: string;

  period: {
    from: ISODateString;
    to: ISODateString;
  };

  /** Requested sort field */
  sort: "engagement_rate" | "views" | "likes";

  items: MediaListItem[];

  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * A single item in the top-performing content grid.
 * Lighter-weight than PostAnalytics — no profile snapshots or full caption.
 * Full details are loaded lazily via GET /api/v1/analytics/posts/:postId when
 * the user opens the PostDetailDrawer.
 */
export interface MediaListItem {
  postId: string;
  platform: PlatformSlug;
  type: string;
  snippet: string;

  /**
   * CDN URL of the post thumbnail.
   * In production: Vercel Blob URL. In mock: local public path.
   */
  thumbnailUrl: string;

  platformUrl: string;
  publishedAt: ISODateString;
  aiGenerated: boolean;

  /** Summary metrics for the card grid — detail is in PostAnalytics */
  metrics: PostMetrics;
}

// ─── Analytics filter params ──────────────────────────────────────────────────

/**
 * Shared filter shape used by AnalyticsFilterBar and passed as SWR key params.
 * Serialise to query string before passing to the API.
 *
 * Usage:
 *   const key = workspaceScopedKey("/api/v1/analytics/profile", workspaceId, filters);
 *   const { data } = useSWR<WorkspaceAnalytics>(key, fetcher);
 */
export interface AnalyticsFilterParams {
  /**
   * Preset range identifier.
   * "custom" means `from` and `to` are set explicitly.
   */
  datePreset: "7d" | "30d" | "90d" | "this_month" | "this_year" | "custom";

  /** Inclusive range start — required when datePreset is "custom" */
  from?: ISODateString;

  /** Inclusive range end — required when datePreset is "custom" */
  to?: ISODateString;

  /**
   * Platform filter.
   * "all" = aggregate across all connected platforms (default).
   */
  platform: PlatformSlug | "all";
}
