/**
 * ZARZOOM Social Profile Analyzer — lib barrel export.
 *
 * SERVER-ONLY. Never import in client components.
 *
 * ```ts
 * import { runInstantEngine, runAiAnalysis, normalizeToUiContract } from "@/lib/analyzer";
 * ```
 */

// Types & schemas
export type {
  Platform,
  AnalysisStatus,
  Instant,
  Teaser,
  FullReport,
  AnalysisResult,
  RawAiOutput,
  StartRequest,
  StartResponse,
  StatusResponse,
  WebhookEventType,
  AnalysisWebhookPayload,
  ProfileSignals,
} from "./types";

export {
  ProfileSignalsSchema,
  SUPPORTED_PLATFORMS,
  AnalysisStatusSchema,
  InstantSchema,
  TeaserSchema,
  FullReportSchema,
  AnalysisResultSchema,
  RawAiOutputSchema,
  StartRequestSchema,
  StartResponseSchema,
  StatusResponseSchema,
  WebhookEventTypeSchema,
} from "./types";

// Instant deterministic engine
export {
  runInstantEngine,
  detectPlatform,
  extractUsername,
  extractKeywords,
  estimatePostingFrequency,
} from "./instantEngine";

// AI analysis + normalizer
export { runAiAnalysis, normalizeToUiContract } from "./aiAnalysis";

// DB helpers
export {
  buildProfileHash,
  getCacheEntry,
  getCacheById,
  upsertCachePending,
  updateCacheCompleted,
  updateCacheFailed,
  enqueueAnalysis,
  markQueueProcessing,
  markQueueCompleted,
  markQueueFailed,
  checkIpRateLimit,
  checkSessionLimit,
  canRefreshProfile,
} from "./db";
