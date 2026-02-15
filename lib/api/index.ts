/**
 * API Service Layer -- barrel export.
 *
 * Import everything from `@/lib/api` in your route handlers:
 *
 * ```ts
 * import { createApiHandler, ok, accepted, enqueueJob } from "@/lib/api";
 * ```
 */

// Core
export { env } from "./env";
export { getRequestId } from "./request-id";

// Responses
export {
  ok,
  created,
  accepted,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  tooManyRequests,
  serverError,
} from "./http-responses";

// Errors
export {
  ApiError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  QuotaExceededError,
  ValidationError,
} from "./errors";

// Auth & tenancy
export { authenticateRequest, type AuthResult } from "./auth";
export { resolveTenant, type TenantMembership } from "./tenancy";
export { requireRole, hasRole, type Role } from "./roles";

// Rate limiting
export {
  checkRateLimit,
  enforceRateLimit,
  rateLimitHeaders,
  type RateLimitResult,
} from "./rate-limit";

// Idempotency
export {
  checkIdempotency,
  saveIdempotency,
  replayResponse,
  type IdempotencyRecord,
} from "./idempotency";

// Quotas
export {
  checkQuota,
  enforceQuota,
  incrementUsage,
  quotaHeaders,
  type QuotaStatus,
} from "./quotas";

// Job queue
export {
  enqueueJob,
  getJobStatus,
  type EnqueueOptions,
  type EnqueueResult,
} from "./queue";

// Language
export { resolveLanguage, type SupportedLanguage } from "./language";

// Handler factory
export {
  createApiHandler,
  type ApiContext,
  type HandlerConfig,
  type AuthMethod,
} from "./handler";

// Plan entitlement enforcement
export {
  enforcePlanEntitlement,
  meetsMinimumTier,
  ACTION_PLAN_MAP,
  type PlanTier,
} from "@/lib/billing/enforce";

// API key validation
export {
  parseAuthorizationBearer,
  validateZarzApiKey,
  type ApiKeyIdentity,
} from "@/lib/api-keys/validate";
