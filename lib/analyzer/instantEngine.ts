/**
 * ZARZOOM Social Profile Analyzer
 * Instant Deterministic Engine
 *
 * Runs synchronously on every /start request.
 * Produces a stable `Instant` object from the profile URL alone —
 * no AI calls, no network I/O. This keeps /start fast (<50 ms).
 *
 * SERVER-ONLY — never import in client components.
 */

import type { Instant, Platform } from "./types";

// ============================================================================
// Platform detection
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

// ============================================================================
// Username / handle extraction
// ============================================================================

/**
 * Extracts the username / handle from a social profile URL.
 * Returns null if it cannot be determined.
 */
export function extractUsername(profileUrl: string): string | null {
  try {
    const url = new URL(profileUrl);
    // Remove leading slash, query params are already stripped by URL parsing
    const parts = url.pathname.split("/").filter(Boolean);

    // Most platforms: first path segment IS the username
    // LinkedIn: /in/username or /company/name
    if (url.hostname.includes("linkedin.com")) {
      const inIdx = parts.indexOf("in");
      const compIdx = parts.indexOf("company");
      if (inIdx >= 0 && parts[inIdx + 1]) return parts[inIdx + 1];
      if (compIdx >= 0 && parts[compIdx + 1]) return parts[compIdx + 1];
    }

    // YouTube: /channel/UCxxx  or /@handle or /c/name
    if (url.hostname.includes("youtube.com")) {
      const atHandle = parts.find((p) => p.startsWith("@"));
      if (atHandle) return atHandle.replace("@", "");
      const cIdx = parts.indexOf("c");
      if (cIdx >= 0 && parts[cIdx + 1]) return parts[cIdx + 1];
      const chIdx = parts.indexOf("channel");
      if (chIdx >= 0 && parts[chIdx + 1]) return parts[chIdx + 1];
    }

    // Default: first path segment (Instagram, TikTok, Twitter/X, Pinterest)
    if (parts[0]) {
      return parts[0].replace(/^@/, "");
    }
  } catch {
    // Invalid URL
  }
  return null;
}

// ============================================================================
// Keyword extraction from username / URL
// ============================================================================

const KEYWORD_HINTS: Record<string, string[]> = {
  // Lifestyle / wellness
  fit: ["fitness", "health"],
  gym: ["fitness", "gym"],
  yoga: ["wellness", "yoga"],
  health: ["health", "wellness"],
  food: ["food", "recipes"],
  cook: ["cooking", "food"],
  travel: ["travel", "lifestyle"],
  vlog: ["vlog", "lifestyle"],
  beauty: ["beauty", "makeup"],
  makeup: ["beauty", "makeup"],
  fashion: ["fashion", "style"],
  style: ["fashion", "style"],
  // Business / finance
  biz: ["business", "entrepreneur"],
  business: ["business", "entrepreneur"],
  finance: ["finance", "investing"],
  invest: ["investing", "finance"],
  crypto: ["crypto", "finance"],
  // Tech / gaming
  tech: ["tech", "gadgets"],
  code: ["coding", "tech"],
  dev: ["development", "tech"],
  game: ["gaming", "entertainment"],
  gaming: ["gaming", "entertainment"],
  // Education
  learn: ["education", "learning"],
  teach: ["education", "teaching"],
  tips: ["tips", "education"],
  // Photography / art
  photo: ["photography", "art"],
  art: ["art", "creative"],
  design: ["design", "creative"],
};

export function extractKeywords(
  username: string | null,
  platform: Platform
): string[] {
  const keywords = new Set<string>();

  // Add platform-specific content type hints
  const platformKeywords: Partial<Record<Platform, string[]>> = {
    tiktok: ["short-form video", "viral content"],
    youtube: ["long-form video", "tutorials"],
    instagram: ["visual content", "reels"],
    linkedin: ["professional content", "thought leadership"],
    twitter: ["microblogging", "engagement"],
    pinterest: ["visual discovery", "inspiration boards"],
    facebook: ["community", "social sharing"],
  };

  for (const kw of platformKeywords[platform] ?? []) {
    keywords.add(kw);
  }

  if (username) {
    const lower = username.toLowerCase();
    for (const [hint, tags] of Object.entries(KEYWORD_HINTS)) {
      if (lower.includes(hint)) {
        for (const tag of tags) keywords.add(tag);
      }
    }
  }

  return Array.from(keywords).slice(0, 8);
}

// ============================================================================
// Deterministic creator score
// ============================================================================

/**
 * Produces a stable, deterministic creator score (0–100) based purely on
 * URL signals. The score is consistent for the same input — no randomness.
 *
 * Scoring factors:
 *  +20  Platform is recognised
 *  +20  Username is extractable
 *  +15  Username length (7–20 chars = optimal)
 *  +15  Keywords detected from username (≥2)
 *  +15  Profile URL uses HTTPS
 *  +15  Username has no numbers (cleaner brand signal)
 */
export function computeCreatorScore(
  profileUrl: string,
  platform: Platform,
  username: string | null,
  keywords: string[]
): number {
  let score = 0;

  if (platform !== "unknown") score += 20;
  if (username) score += 20;

  if (username) {
    const len = username.length;
    if (len >= 7 && len <= 20) score += 15;
    else if (len >= 4) score += 8;
  }

  if (keywords.length >= 2) score += 15;

  try {
    if (new URL(profileUrl).protocol === "https:") score += 15;
  } catch {
    // malformed URL
  }

  if (username && !/\d/.test(username)) score += 15;

  return Math.min(score, 100);
}

// ============================================================================
// Strengths / opportunities
// ============================================================================

const PLATFORM_STRENGTHS: Partial<Record<Platform, string[]>> = {
  instagram: [
    "Strong visual storytelling potential",
    "Reels algorithm rewards consistent posting",
    "High engagement through Stories and DMs",
  ],
  tiktok: [
    "Massive organic reach with trending audio",
    "Fast growth possible even for new accounts",
    "Viral loops reward authentic, raw content",
  ],
  youtube: [
    "Long-form content builds deep audience loyalty",
    "Search-driven evergreen traffic",
    "Strong monetisation options (ads, memberships)",
  ],
  twitter: [
    "Real-time conversations amplify reach",
    "Threads drive high organic impressions",
    "Strong community-building through replies",
  ],
  linkedin: [
    "Thought leadership earns high-quality leads",
    "B2B content performs extremely well",
    "Algorithm favours personal over company posts",
  ],
  facebook: [
    "Established audience with strong community tools",
    "Groups drive repeat, high-intent engagement",
    "Paid amplification is cost-effective",
  ],
  pinterest: [
    "Evergreen pins drive traffic for months",
    "High-intent audience with strong purchase intent",
    "SEO-rich descriptions boost discovery",
  ],
};

const PLATFORM_OPPORTUNITIES: Partial<Record<Platform, string[]>> = {
  instagram: [
    "Posting frequency appears improvable",
    "Bio optimisation can lift follow conversion",
    "Collab posts can double reach quickly",
  ],
  tiktok: [
    "Trend participation could accelerate growth",
    "Duets and stitches expand reach to new audiences",
    "Pinning a high-performing intro video boosts follow rate",
  ],
  youtube: [
    "Shorts cross-promotion can funnel new subscribers",
    "Playlist architecture improves watch time",
    "Thumbnail A/B testing can lift CTR by 30%+",
  ],
  twitter: [
    "Scheduling threads at peak hours maximises impressions",
    "Pinned tweet is prime conversion real estate",
    "Cross-promoting to newsletters compounds growth",
  ],
  linkedin: [
    "Commenting on niche leaders drives profile views",
    "Newsletter feature provides direct inbox access",
    "Carousel posts outperform plain text by 3x",
  ],
  facebook: [
    "Video content is currently prioritised in the feed",
    "Going live weekly builds loyal recurring viewers",
    "Cross-posting to Reels extends reach to Instagram",
  ],
  pinterest: [
    "Idea Pins attract new followers effectively",
    "Keyword-rich board names improve SEO ranking",
    "Posting 5–10 pins/day accelerates impression growth",
  ],
};

const GENERIC_STRENGTHS = [
  "Unique profile handle is memorable",
  "Platform choice aligns with content goals",
  "Clear content niche signal detected",
];

const GENERIC_OPPORTUNITIES = [
  "Profile optimisation can improve discoverability",
  "Cross-platform repurposing would amplify reach",
  "Consistent posting schedule is a key growth lever",
];

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Run the instant deterministic analysis on a profile URL.
 * Executes synchronously in <5 ms with no external calls.
 */
export function runInstantEngine(profileUrl: string): Instant {
  const platform = detectPlatform(profileUrl);
  const username = extractUsername(profileUrl);
  const keywords = extractKeywords(username, platform);
  const creatorScore = computeCreatorScore(profileUrl, platform, username, keywords);

  const strengths =
    PLATFORM_STRENGTHS[platform]?.slice(0, 3) ?? GENERIC_STRENGTHS;
  const opportunities =
    PLATFORM_OPPORTUNITIES[platform]?.slice(0, 3) ?? GENERIC_OPPORTUNITIES;

  return {
    platform_detected: platform,
    keywords_detected: keywords,
    posting_frequency_estimate: "unknown",
    creator_score: creatorScore,
    strengths,
    opportunities,
  };
}
