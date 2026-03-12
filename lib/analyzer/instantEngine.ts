/**
 * ZARZOOM Live Social Score Engine
 * Instant Deterministic Engine — v2
 *
 * Runs synchronously before any AI call. Produces a stable `Instant` object
 * from a profile URL plus optional scraped signals (bio, image, links, etc.).
 *
 * Constraints:
 *   - No AI dependency
 *   - No network I/O
 *   - Deterministic: identical inputs always produce identical outputs
 *   - Target runtime: <300 ms (actual: <5 ms)
 *
 * Weighting model (100 pts total):
 * ┌──────────────────────────────────┬────────┐
 * │ Category                         │ Weight │
 * ├──────────────────────────────────┼────────┤
 * │ Platform suitability             │  15 pts│
 * │ Username clarity                 │  15 pts│
 * │ Profile image presence           │  15 pts│
 * │ Bio completeness                 │  20 pts│
 * │ External link presence           │  10 pts│
 * │ Topic keyword detection          │  15 pts│
 * │ Posting frequency / activity     │  10 pts│
 * └──────────────────────────────────┴────────┘
 *
 * SERVER-ONLY — never import in client components.
 */

import type { Instant, Platform, ProfileSignals } from "./types";

// ============================================================================
// 1. Platform detection
// ============================================================================

const PLATFORM_PATTERNS: Array<{ pattern: RegExp; platform: Platform }> = [
  { pattern: /instagram\.com/i, platform: "instagram" },
  { pattern: /tiktok\.com/i, platform: "tiktok" },
  { pattern: /youtube\.com|youtu\.be/i, platform: "youtube" },
  { pattern: /twitter\.com|x\.com/i, platform: "twitter" },
  { pattern: /linkedin\.com/i, platform: "linkedin" },
  { pattern: /facebook\.com/i, platform: "facebook" },
  { pattern: /pinterest\.com/i, platform: "pinterest" },
];

export function detectPlatform(profileUrl: string): Platform {
  for (const { pattern, platform } of PLATFORM_PATTERNS) {
    if (pattern.test(profileUrl)) return platform;
  }
  return "unknown";
}

/**
 * Platform suitability score (0–15).
 * Known platforms score full marks. Unknown gets 0 — spam filter.
 */
function scorePlatformSuitability(platform: Platform): number {
  return platform !== "unknown" ? 15 : 0;
}

// ============================================================================
// 2. Username extraction & clarity scoring
// ============================================================================

export function extractUsername(
  profileUrl: string,
  signals?: ProfileSignals
): string | null {
  // Prefer explicitly scraped username
  if (signals?.username) return signals.username;

  try {
    const url = new URL(profileUrl);
    const parts = url.pathname.split("/").filter(Boolean);

    if (url.hostname.includes("linkedin.com")) {
      const inIdx = parts.indexOf("in");
      const compIdx = parts.indexOf("company");
      if (inIdx >= 0 && parts[inIdx + 1]) return parts[inIdx + 1];
      if (compIdx >= 0 && parts[compIdx + 1]) return parts[compIdx + 1];
    }

    if (url.hostname.includes("youtube.com")) {
      const atHandle = parts.find((p) => p.startsWith("@"));
      if (atHandle) return atHandle.replace("@", "");
      const cIdx = parts.indexOf("c");
      if (cIdx >= 0 && parts[cIdx + 1]) return parts[cIdx + 1];
      const chIdx = parts.indexOf("channel");
      if (chIdx >= 0 && parts[chIdx + 1]) return parts[chIdx + 1];
    }

    if (parts[0]) return parts[0].replace(/^@/, "");
  } catch {
    // malformed URL — fall through
  }
  return null;
}

/**
 * Username clarity score (0–15).
 *
 * Rubric:
 *   +5   Username is extractable at all
 *   +4   Length in the optimal brand range (5–22 chars)
 *   +3   No trailing numbers (e.g. username123 looks spammy)
 *   +3   No excessive underscores/hyphens (≤1)
 */
function scoreUsernameClarity(username: string | null): number {
  if (!username) return 0;
  let pts = 5;

  const len = username.length;
  if (len >= 5 && len <= 22) pts += 4;
  else if (len >= 3) pts += 2;

  if (!/\d{2,}$/.test(username)) pts += 3; // no 2+ trailing digits
  const specialCount = (username.match(/[_.\-]/g) || []).length;
  if (specialCount <= 1) pts += 3;

  return Math.min(pts, 15);
}

// ============================================================================
// 3. Profile image presence (0–15)
// ============================================================================

/**
 * Profile image score (0–15).
 * If the signal is unknown (undefined) we give a neutral partial score (8)
 * rather than penalising a URL-only analysis.
 */
function scoreProfileImage(signals?: ProfileSignals): number {
  if (signals?.has_profile_image === true) return 15;
  if (signals?.has_profile_image === false) return 0;
  return 8; // unknown — neutral
}

// ============================================================================
// 4. Bio completeness (0–20)
// ============================================================================

/**
 * Bio score (0–20).
 *
 * Optimal bio length varies by platform but 60–160 chars is universally good.
 *
 * Rubric:
 *   0 chars            →  0 pts   (no bio)
 *   1–29 chars         →  5 pts   (too short)
 *   30–59 chars        → 10 pts   (minimal)
 *   60–159 chars       → 20 pts   (optimal)
 *   160–300 chars      → 15 pts   (good but long)
 *   >300 chars         →  8 pts   (wall of text)
 */
function scoreBioCompleteness(signals?: ProfileSignals): number {
  const len = signals?.bio_length;
  if (len === undefined) return 10; // unknown — neutral

  if (len === 0) return 0;
  if (len < 30) return 5;
  if (len < 60) return 10;
  if (len < 160) return 20;
  if (len <= 300) return 15;
  return 8;
}

// ============================================================================
// 5. External link presence (0–10)
// ============================================================================

function scoreExternalLink(signals?: ProfileSignals): number {
  if (signals?.has_external_link === true) return 10;
  if (signals?.has_external_link === false) return 0;
  return 5; // unknown — neutral
}

// ============================================================================
// 6. Topic keyword detection (0–15)
// ============================================================================

const KEYWORD_HINTS: Record<string, string[]> = {
  // Lifestyle / wellness
  fit: ["fitness", "health"],
  gym: ["fitness", "gym"],
  yoga: ["wellness", "yoga"],
  health: ["health", "wellness"],
  food: ["food", "recipes"],
  cook: ["cooking", "food"],
  recipe: ["recipes", "food"],
  travel: ["travel", "lifestyle"],
  vlog: ["vlog", "lifestyle"],
  beauty: ["beauty", "makeup"],
  makeup: ["beauty", "makeup"],
  fashion: ["fashion", "style"],
  style: ["fashion", "style"],
  mom: ["parenting", "family"],
  dad: ["parenting", "family"],
  parent: ["parenting", "family"],
  // Business / finance
  biz: ["business", "entrepreneur"],
  business: ["business", "entrepreneur"],
  brand: ["branding", "business"],
  marketing: ["marketing", "business"],
  finance: ["finance", "investing"],
  invest: ["investing", "finance"],
  money: ["finance", "money"],
  crypto: ["crypto", "finance"],
  nft: ["crypto", "web3"],
  // Tech / gaming
  tech: ["tech", "gadgets"],
  code: ["coding", "tech"],
  dev: ["development", "tech"],
  software: ["software", "tech"],
  ai: ["AI", "tech"],
  game: ["gaming", "entertainment"],
  gaming: ["gaming", "entertainment"],
  esport: ["esports", "gaming"],
  // Education
  learn: ["education", "learning"],
  teach: ["education", "teaching"],
  tutor: ["education", "tutoring"],
  tips: ["tips", "education"],
  guide: ["guides", "education"],
  // Photography / art / music
  photo: ["photography", "art"],
  photographer: ["photography", "art"],
  art: ["art", "creative"],
  design: ["design", "creative"],
  music: ["music", "entertainment"],
  dj: ["music", "DJ"],
  podcast: ["podcast", "audio"],
  // Sport
  sport: ["sports", "fitness"],
  football: ["football", "sports"],
  soccer: ["soccer", "sports"],
  run: ["running", "fitness"],
  athlete: ["athlete", "sports"],
};

export function extractKeywords(
  username: string | null,
  platform: Platform,
  signals?: ProfileSignals
): string[] {
  const keywords = new Set<string>();

  // Platform-specific content type hints
  const platformKeywords: Partial<Record<Platform, string[]>> = {
    tiktok: ["short-form video", "viral content"],
    youtube: ["long-form video", "tutorials"],
    instagram: ["visual content", "reels"],
    linkedin: ["professional content", "thought leadership"],
    twitter: ["microblogging", "real-time engagement"],
    pinterest: ["visual discovery", "inspiration"],
    facebook: ["community", "social sharing"],
  };
  for (const kw of platformKeywords[platform] ?? []) keywords.add(kw);

  // Scan username + bio text for topic hints
  const searchText = [
    username ?? "",
    signals?.bio_text ?? "",
    signals?.display_name ?? "",
  ]
    .join(" ")
    .toLowerCase();

  for (const [hint, tags] of Object.entries(KEYWORD_HINTS)) {
    if (searchText.includes(hint)) {
      for (const tag of tags) keywords.add(tag);
    }
  }

  return Array.from(keywords).slice(0, 8);
}

/**
 * Keyword score (0–15).
 * The more distinct topic signals detected (beyond the platform defaults),
 * the higher the score — indicates a defined content niche.
 *
 *   0 niche keywords   →  0 pts
 *   1 niche keyword    →  5 pts
 *   2 niche keywords   → 10 pts
 *   3+ niche keywords  → 15 pts
 */
function scoreKeywords(
  username: string | null,
  platform: Platform,
  signals?: ProfileSignals
): { score: number; keywords: string[] } {
  const platformDefaults = new Set<string>([
    "short-form video",
    "viral content",
    "long-form video",
    "tutorials",
    "visual content",
    "reels",
    "professional content",
    "thought leadership",
    "microblogging",
    "real-time engagement",
    "visual discovery",
    "inspiration",
    "community",
    "social sharing",
  ]);

  const all = extractKeywords(username, platform, signals);
  const niche = all.filter((kw) => !platformDefaults.has(kw));

  let score = 0;
  if (niche.length >= 3) score = 15;
  else if (niche.length === 2) score = 10;
  else if (niche.length === 1) score = 5;

  return { score, keywords: all };
}

// ============================================================================
// 7. Posting frequency estimate (0–10)
// ============================================================================

/**
 * Derives a posting frequency tier from available signals:
 * post_count, follower_count, and platform norms.
 *
 * Heuristic (no timestamps available):
 *   - High post count relative to follower ratio → likely active
 *   - Platform norms: LinkedIn is lower-cadence than TikTok
 */
export function estimatePostingFrequency(
  platform: Platform,
  signals?: ProfileSignals
): Instant["posting_frequency_estimate"] {
  const posts = signals?.post_count;
  const followers = signals?.follower_count;

  if (posts === undefined) return "unknown";

  // Platform-specific high-frequency thresholds (posts to qualify as "high")
  const highThresholds: Partial<Record<Platform, number>> = {
    tiktok: 100,
    instagram: 80,
    youtube: 50,
    twitter: 200,
    linkedin: 30,
    facebook: 60,
    pinterest: 150,
  };
  const medThresholds: Partial<Record<Platform, number>> = {
    tiktok: 30,
    instagram: 25,
    youtube: 15,
    twitter: 60,
    linkedin: 10,
    facebook: 20,
    pinterest: 50,
  };

  const highThresh = highThresholds[platform] ?? 80;
  const medThresh = medThresholds[platform] ?? 25;

  // Adjust thresholds down for very small accounts (might be new + active)
  const scale = followers !== undefined && followers < 500 ? 0.5 : 1;

  if (posts >= highThresh * scale) return "high";
  if (posts >= medThresh * scale) return "medium";
  if (posts > 0) return "low";
  return "low";
}

/**
 * Posting frequency score (0–10).
 */
function scorePostingFrequency(
  platform: Platform,
  signals?: ProfileSignals
): { score: number; freq: Instant["posting_frequency_estimate"] } {
  const freq = estimatePostingFrequency(platform, signals);
  const map: Record<Instant["posting_frequency_estimate"], number> = {
    high: 10,
    medium: 7,
    low: 3,
    unknown: 5, // neutral when data absent
  };
  return { score: map[freq], freq };
}

// ============================================================================
// 8. Engagement rate bonus (up to +5 bonus — can't push over 100)
// ============================================================================

/**
 * Optional engagement rate bonus (0–5 extra pts).
 * Only applied when the signal is explicitly provided.
 *
 *   ≥5%  engagement rate → +5
 *   ≥2%                  → +3
 *   ≥0.5%                → +1
 */
function scoreEngagementBonus(signals?: ProfileSignals): number {
  const rate = signals?.engagement_rate;
  if (rate === undefined) return 0;
  if (rate >= 0.05) return 5;
  if (rate >= 0.02) return 3;
  if (rate >= 0.005) return 1;
  return 0;
}

// ============================================================================
// 9. Strengths & opportunities — signal-aware messages
// ============================================================================

interface StrengthOpportunity {
  strengths: string[];
  opportunities: string[];
}

const PLATFORM_BASE: Partial<Record<Platform, StrengthOpportunity>> = {
  instagram: {
    strengths: [
      "Strong visual storytelling potential on the platform",
      "Reels algorithm actively rewards consistent posting",
      "High engagement through Stories and DMs",
    ],
    opportunities: [
      "Collab posts can double reach quickly",
      "Bio optimisation can lift follow-through rate",
      "Hashtag strategy review could improve discovery",
    ],
  },
  tiktok: {
    strengths: [
      "Massive organic reach potential with trending audio",
      "Fast growth possible even for brand-new accounts",
      "Viral loops reward authentic, raw content",
    ],
    opportunities: [
      "Trend participation could accelerate growth significantly",
      "Duets and stitches expand reach to new audiences",
      "Pinning a high-performing intro video boosts follow rate",
    ],
  },
  youtube: {
    strengths: [
      "Long-form content builds deep audience loyalty",
      "Search-driven traffic provides evergreen reach",
      "Strong monetisation options: ads, memberships, Super Thanks",
    ],
    opportunities: [
      "Shorts cross-promotion can funnel new subscribers",
      "Playlist architecture improves watch-time metrics",
      "Thumbnail A/B testing can lift click-through rate by 30%+",
    ],
  },
  twitter: {
    strengths: [
      "Real-time conversations amplify organic reach",
      "Threads drive consistently high impressions",
      "Strong community-building through replies and quote tweets",
    ],
    opportunities: [
      "Scheduling threads at peak hours maximises impressions",
      "Pinned tweet is prime conversion real estate",
      "Cross-promoting to a newsletter compounds long-term growth",
    ],
  },
  linkedin: {
    strengths: [
      "Thought leadership content earns high-quality leads",
      "B2B content consistently performs above average here",
      "Algorithm favours personal posts over company pages",
    ],
    opportunities: [
      "Commenting on niche leaders drives profile views",
      "The newsletter feature provides direct inbox access",
      "Carousel posts outperform plain text by an average of 3x",
    ],
  },
  facebook: {
    strengths: [
      "Established audience with robust community tools",
      "Groups drive repeat, high-intent engagement",
      "Paid amplification remains cost-effective",
    ],
    opportunities: [
      "Video content is currently prioritised in the feed algorithm",
      "Going live weekly builds loyal recurring viewers",
      "Cross-posting to Reels extends reach to Instagram audiences",
    ],
  },
  pinterest: {
    strengths: [
      "Evergreen Pins drive referral traffic for months",
      "High-intent audience with strong purchase-ready mindset",
      "SEO-rich descriptions improve long-term discovery",
    ],
    opportunities: [
      "Idea Pins attract new followers very effectively",
      "Keyword-rich board names improve search ranking",
      "Posting 5–10 Pins per day accelerates impression growth",
    ],
  },
};

const GENERIC: StrengthOpportunity = {
  strengths: [
    "Unique profile handle detected — good brand foundation",
    "Platform choice aligns with content goals",
    "Clear content niche signal present",
  ],
  opportunities: [
    "Profile optimisation can improve discoverability",
    "Cross-platform repurposing would amplify reach",
    "Consistent posting schedule is the most reliable growth lever",
  ],
};

const SIGNAL_STRENGTHS: Record<string, string> = {
  verified: "Verified badge adds immediate credibility",
  has_external_link: "External link in bio converts profile visitors to leads",
  has_profile_image: "Professional profile image improves first impressions",
  good_bio: "Well-crafted bio clearly communicates value proposition",
  high_posting: "High posting volume signals sustained content commitment",
  strong_keywords: "Defined content niche improves algorithmic targeting",
};

const SIGNAL_OPPORTUNITIES: Record<string, string> = {
  no_external_link: "Adding a link in bio (e.g. Linktree) drives off-platform conversions",
  no_profile_image: "Adding a professional profile image increases trust and follows",
  short_bio: "Expanding your bio to 60–160 characters increases follow conversion",
  low_posting: "Increasing posting cadence is the single fastest growth lever",
  no_keywords: "Defining a content niche helps the algorithm surface your profile",
};

function buildStrengthsAndOpportunities(
  platform: Platform,
  username: string | null,
  keywords: string[],
  signals?: ProfileSignals,
  freq?: Instant["posting_frequency_estimate"]
): { strengths: string[]; opportunities: string[] } {
  const base = PLATFORM_BASE[platform] ?? GENERIC;
  const strengths: string[] = [...base.strengths.slice(0, 2)];
  const opportunities: string[] = [...base.opportunities.slice(0, 1)];

  // Signal-aware additions
  if (signals?.is_verified) strengths.push(SIGNAL_STRENGTHS.verified);
  if (signals?.has_profile_image === true)
    strengths.push(SIGNAL_STRENGTHS.has_profile_image);
  if (signals?.has_external_link === true)
    strengths.push(SIGNAL_STRENGTHS.has_external_link);
  if (signals?.bio_length !== undefined && signals.bio_length >= 60 && signals.bio_length <= 160)
    strengths.push(SIGNAL_STRENGTHS.good_bio);
  if (freq === "high") strengths.push(SIGNAL_STRENGTHS.high_posting);
  if (keywords.length >= 4) strengths.push(SIGNAL_STRENGTHS.strong_keywords);

  // Signal-aware opportunities
  if (signals?.has_external_link === false)
    opportunities.push(SIGNAL_OPPORTUNITIES.no_external_link);
  if (signals?.has_profile_image === false)
    opportunities.push(SIGNAL_OPPORTUNITIES.no_profile_image);
  if (signals?.bio_length !== undefined && signals.bio_length < 30)
    opportunities.push(SIGNAL_OPPORTUNITIES.short_bio);
  if (freq === "low")
    opportunities.push(SIGNAL_OPPORTUNITIES.low_posting);
  if (keywords.filter((k) => !["short-form video", "long-form video", "visual content", "professional content", "microblogging", "visual discovery", "community", "social sharing", "viral content", "reels", "tutorials", "inspiration", "real-time engagement"].includes(k)).length === 0)
    opportunities.push(SIGNAL_OPPORTUNITIES.no_keywords);

  // Fill from base if we still have room
  for (const s of base.strengths.slice(2)) {
    if (strengths.length >= 4) break;
    strengths.push(s);
  }
  for (const o of base.opportunities.slice(1)) {
    if (opportunities.length >= 4) break;
    opportunities.push(o);
  }

  return {
    strengths: [...new Set(strengths)].slice(0, 4),
    opportunities: [...new Set(opportunities)].slice(0, 4),
  };
}

// ============================================================================
// 10. Main entry point
// ============================================================================

/**
 * Run the instant deterministic scoring engine.
 *
 * Accepts a profile URL and optional pre-scraped signals.
 * When signals are absent the engine falls back to URL-only analysis,
 * scoring unknown fields at neutral midpoints rather than zero.
 *
 * @param profileUrl  - Canonical social profile URL
 * @param signals     - Optional scraped profile metadata
 * @returns           - Instant analysis object
 */
export function runInstantEngine(
  profileUrl: string,
  signals?: ProfileSignals
): Instant {
  // ── Detect platform ──────────────────────────────────────────────────────
  const platform = detectPlatform(profileUrl);

  // ── Extract username ─────────────────────────────────────────────────────
  const username = extractUsername(profileUrl, signals);

  // ── Run all signal scorers ────────────────────────────────────────────────
  const platformPts = scorePlatformSuitability(platform);             // 0–15
  const usernamePts = scoreUsernameClarity(username);                 // 0–15
  const imagePts    = scoreProfileImage(signals);                     // 0–15
  const bioPts      = scoreBioCompleteness(signals);                  // 0–20
  const linkPts     = scoreExternalLink(signals);                     // 0–10
  const { score: keywordPts, keywords } = scoreKeywords(             // 0–15
    username,
    platform,
    signals,
  );
  const { score: freqPts, freq } = scorePostingFrequency(            // 0–10
    platform,
    signals,
  );
  const engagementBonus = scoreEngagementBonus(signals);             // 0–5

  // ── Composite score ───────────────────────────────────────────────────────
  const raw =
    platformPts +
    usernamePts +
    imagePts +
    bioPts +
    linkPts +
    keywordPts +
    freqPts +
    engagementBonus;

  const creatorScore = Math.min(Math.round(raw), 100);

  // ── Strengths / opportunities ─────────────────────────────────────────────
  const { strengths, opportunities } = buildStrengthsAndOpportunities(
    platform,
    username,
    keywords,
    signals,
    freq,
  );

  return {
    platform_detected: platform,
    keywords_detected: keywords,
    posting_frequency_estimate: freq,
    creator_score: creatorScore,
    strengths,
    opportunities,
  };
}
