/**
 * ZARZOOM Social Profile Analyzer
 * Types, Zod schemas, and the canonical UI contract.
 *
 * SERVER-ONLY — never import in client components.
 */

import { z } from "zod";

// ============================================================================
// Platform detection
// ============================================================================

export const SUPPORTED_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "twitter",
  "linkedin",
  "facebook",
  "pinterest",
  "unknown",
] as const;

export type Platform = (typeof SUPPORTED_PLATFORMS)[number];

// ============================================================================
// Analysis status
// ============================================================================

export const AnalysisStatusSchema = z.enum(["pending", "completed", "failed"]);
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;

// ============================================================================
// Instant (deterministic) section
// ============================================================================

export const InstantSchema = z.object({
  platform_detected: z.string(),
  keywords_detected: z.array(z.string()),
  posting_frequency_estimate: z.enum(["low", "medium", "high", "unknown"]),
  creator_score: z.number().int().min(0).max(100),
  strengths: z.array(z.string()),
  opportunities: z.array(z.string()),
});

export type Instant = z.infer<typeof InstantSchema>;

// ============================================================================
// Teaser section (gated — shown before sign-up)
// ============================================================================

export const AiPostPreviewSchema = z.object({
  title: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
});

export const TeaserSchema = z.object({
  growth_insights: z.array(z.string()),
  ai_post_preview: AiPostPreviewSchema,
  benchmark_text: z.string(),
});

export type Teaser = z.infer<typeof TeaserSchema>;

// ============================================================================
// Full report section (unlocked after sign-up)
// ============================================================================

export const ViralPostIdeaSchema = z.object({
  title: z.string(),
  hook: z.string(),
  description: z.string(),
});

export const PostingScheduleSchema = z.object({
  posts_per_week: z.string(),
  best_days: z.array(z.string()),
  best_times: z.array(z.string()),
});

export const FullReportSchema = z.object({
  creator_score_explanation: z.string(),
  content_pillars: z.array(z.string()),
  viral_post_ideas: z.array(ViralPostIdeaSchema),
  posting_schedule: PostingScheduleSchema,
  growth_insights: z.array(z.string()),
});

export type FullReport = z.infer<typeof FullReportSchema>;

// ============================================================================
// Canonical UI contract — the /result response shape
// ============================================================================

export const AnalysisResultSchema = z.object({
  analysis_id: z.string().uuid(),
  status: AnalysisStatusSchema,
  instant: InstantSchema.nullable(),
  teaser: TeaserSchema.nullable(),
  full_report: FullReportSchema.nullable(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// ============================================================================
// Raw AI output schema (stored in analysis_json for debugging)
// ============================================================================

export const RawAiOutputSchema = z.object({
  teaser: TeaserSchema,
  full_report: FullReportSchema,
  // AI may also attempt to refine the creator score
  creator_score_override: z.number().int().min(0).max(100).optional(),
  creator_score_explanation: z.string().optional(),
});

export type RawAiOutput = z.infer<typeof RawAiOutputSchema>;

// ============================================================================
// Request / response schemas for the API routes
// ============================================================================

// ============================================================================
// Profile signals — scraped metadata passed into the instant engine
// All fields are optional: the engine degrades gracefully on partial data
// ============================================================================

export const ProfileSignalsSchema = z.object({
  /** URL of the profile being analysed */
  profile_url: z.string().url(),
  /** Whether the account has a profile picture */
  has_profile_image: z.boolean().optional(),
  /** Raw character length of the bio / description */
  bio_length: z.number().int().min(0).optional(),
  /** Whether the profile contains an external link (website/linktree etc.) */
  has_external_link: z.boolean().optional(),
  /** Total number of posts / videos / pins visible */
  post_count: z.number().int().min(0).optional(),
  /** Follower count — used to infer posting frequency tier */
  follower_count: z.number().int().min(0).optional(),
  /** Raw bio text, used for keyword extraction */
  bio_text: z.string().optional(),
  /** Display name / full name shown on profile */
  display_name: z.string().optional(),
  /** Account handle / username without @ */
  username: z.string().optional(),
  /** Whether the account is verified */
  is_verified: z.boolean().optional(),
  /** Number of accounts this profile follows */
  following_count: z.number().int().min(0).optional(),
  /** Average post engagement rate 0–1, if available */
  engagement_rate: z.number().min(0).max(1).optional(),
});

export type ProfileSignals = z.infer<typeof ProfileSignalsSchema>;

/** POST /api/analyzer/start */
export const StartRequestSchema = z.object({
  profile_url: z.string().url("Must be a valid URL"),
  email: z.string().email().optional(),
  /** Optional pre-scraped metadata — enriches instant engine output */
  signals: ProfileSignalsSchema.optional(),
});
export type StartRequest = z.infer<typeof StartRequestSchema>;

/** Response from POST /api/analyzer/start */
export const StartResponseSchema = z.object({
  analysis_id: z.string().uuid(),
  status: AnalysisStatusSchema,
  instant: InstantSchema,
  /** Present only when a valid completed cache hit is returned immediately */
  teaser: TeaserSchema.optional(),
  cached: z.boolean().optional(),
});
export type StartResponse = z.infer<typeof StartResponseSchema>;

/** GET /api/analyzer/status */
export const StatusResponseSchema = z.object({
  analysis_id: z.string().uuid(),
  status: AnalysisStatusSchema,
  /** ISO-8601 */
  created_at: z.string(),
  /** ISO-8601 */
  expires_at: z.string(),
});
export type StatusResponse = z.infer<typeof StatusResponseSchema>;

// ============================================================================
// Webhook event payloads
// ============================================================================

export const WebhookEventTypeSchema = z.enum([
  "analysis.started",
  "analysis.completed",
  "analysis.failed",
]);
export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>;

export interface AnalysisWebhookPayload {
  event: WebhookEventType;
  analysis_id: string;
  profile_url: string;
  platform: Platform;
  timestamp: string;
  /** Present on analysis.completed */
  ui_json?: AnalysisResult;
  /** Present on analysis.failed */
  error?: string;
}
