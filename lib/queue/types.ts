import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Queue Message Schema                                               */
/* ------------------------------------------------------------------ */

/**
 * The canonical shape of a queue message that a Worker receives.
 *
 * This is the "Queue Contract" -- every message pushed to the external
 * worker (via HTTP push queue or SQS-style pull queue) will contain
 * exactly these fields.
 */
export const QueueMessageSchema = z.object({
  /** UUID of the job row in the `jobs` table. Primary key. */
  job_id: z.string().uuid(),

  /** Tenant that owns this job. Used for isolation and quota. */
  tenant_id: z.string().uuid(),

  /**
   * Job type -- the worker uses this to route to the correct handler.
   * Convention: `domain.entity.action` e.g. `social.post.publish`,
   * `images.generate`, `research.social`, `writing.article`.
   */
  type: z.string().min(1),

  /**
   * Zero-indexed attempt counter. The producer always sends `attempt: 0`.
   * On retries the worker increments this before re-enqueuing.
   */
  attempt: z.number().int().min(0).default(0),

  /**
   * ISO-8601 timestamp. For immediate jobs this equals `enqueued_at`.
   * For delayed jobs (e.g. polling back-off) it is in the future.
   */
  scheduled_for: z.string().datetime(),

  /**
   * ISO-8601 timestamp when the message was first created.
   */
  enqueued_at: z.string().datetime(),

  /**
   * Opaque job payload. The worker interprets this based on `type`.
   * The queue layer never inspects payload contents.
   */
  payload: z.record(z.unknown()),

  /**
   * Maximum delivery attempts before the job is moved to `failed`.
   */
  max_attempts: z.number().int().min(1).default(3),

  /** Job priority (lower number = higher priority). Default: 100. */
  priority: z.number().int().default(100),

  /** Optional URL the worker should POST results to on completion. */
  callback_url: z.string().url().nullable().default(null),

  /**
   * HMAC-SHA256 signature of `job_id + tenant_id + type + scheduled_for`
   * using the `QUEUE_SIGNING_SECRET`. Workers MUST verify this before
   * processing. Prevents forged messages.
   */
  signature: z.string().min(1),
});

export type QueueMessage = z.infer<typeof QueueMessageSchema>;

/* ------------------------------------------------------------------ */
/*  Retry Configuration                                                */
/* ------------------------------------------------------------------ */

/**
 * Per-job-type retry configuration.
 * Workers use this to decide max attempts and backoff.
 */
export interface RetryConfig {
  /** Maximum total attempts (including the first). Default: 3. */
  maxAttempts: number;

  /**
   * Base delay in milliseconds for exponential backoff.
   * Actual delay = baseDelayMs * 2^attempt (capped at maxDelayMs).
   * Default: 5_000 (5 seconds).
   */
  baseDelayMs: number;

  /**
   * Maximum delay in milliseconds. Default: 300_000 (5 minutes).
   */
  maxDelayMs: number;
}

/**
 * Default retry configs keyed by job type prefix.
 * The worker falls back to `default` if no specific config matches.
 *
 * Recommendation: This table lives in the worker config, not in Vercel.
 * It is published here as the contract so both sides agree.
 */
export const RETRY_DEFAULTS: Record<string, RetryConfig> = {
  default: { maxAttempts: 3, baseDelayMs: 5_000, maxDelayMs: 300_000 },
  "social.post": { maxAttempts: 5, baseDelayMs: 10_000, maxDelayMs: 600_000 },
  "images.generate": {
    maxAttempts: 3,
    baseDelayMs: 15_000,
    maxDelayMs: 300_000,
  },
  "images.edit": { maxAttempts: 3, baseDelayMs: 15_000, maxDelayMs: 300_000 },
  "videos.generate": {
    maxAttempts: 3,
    baseDelayMs: 30_000,
    maxDelayMs: 600_000,
  },
  "research.social": {
    maxAttempts: 3,
    baseDelayMs: 10_000,
    maxDelayMs: 300_000,
  },
  "writing.article": {
    maxAttempts: 3,
    baseDelayMs: 10_000,
    maxDelayMs: 300_000,
  },
  "writing.script": {
    maxAttempts: 3,
    baseDelayMs: 10_000,
    maxDelayMs: 300_000,
  },
  prompt_test: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
  test_provider_key: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
};

/**
 * Resolve retry config for a job type.
 * Tries exact match, then prefix match (e.g. `social.post.publish`
 * matches `social.post`), then falls back to `default`.
 */
export function getRetryConfig(jobType: string): RetryConfig {
  if (RETRY_DEFAULTS[jobType]) return RETRY_DEFAULTS[jobType];

  // Prefix match: "social.post.publish" -> "social.post"
  const parts = jobType.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const prefix = parts.slice(0, i).join(".");
    if (RETRY_DEFAULTS[prefix]) return RETRY_DEFAULTS[prefix];
  }

  return RETRY_DEFAULTS.default;
}

/**
 * Calculate the next retry delay using exponential backoff with jitter.
 */
export function calculateBackoff(
  attempt: number,
  config: RetryConfig
): number {
  if (config.baseDelayMs === 0) return 0;
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * config.baseDelayMs * 0.5;
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}
