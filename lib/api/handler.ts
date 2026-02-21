import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import { getRequestId } from "./request-id";
import { authenticateRequest } from "./auth";
import { resolveTenant, type TenantMembership } from "./tenancy";
import { requireRole, type Role } from "./roles";
import { enforceRateLimit, rateLimitHeaders } from "./rate-limit";
import { resolveLanguage, type SupportedLanguage } from "./language";
import {
  parseAuthorizationBearer,
  validateZarzApiKey,
  type ApiKeyIdentity,
} from "@/lib/api-keys/validate";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  tooManyRequests,
  serverError,
} from "./http-responses";
import { enforcePlanEntitlement } from "@/lib/billing/enforce";
import { enforceQuota as enforceQuotaCheck, incrementUsage, type QuotaStatus } from "./quotas";
import {
  ApiError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  QuotaExceededError,
  ValidationError,
} from "./errors";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** How the request was authenticated. */
export type AuthMethod = "session" | "api_key";

export interface ApiContext {
  /** Correlation ID for this request. */
  requestId: string;
  /** Authenticated Supabase user (only present for session auth). */
  user: User | null;
  /** Supabase client scoped to the user's session (only for session auth). */
  supabase: SupabaseClient | null;
  /** Resolved tenant membership (present for both auth methods). */
  membership: TenantMembership | null;
  /** Resolved language for this request. */
  language: SupportedLanguage;
  /** The raw Next.js request. */
  req: NextRequest;
  /** How this request was authenticated. */
  authMethod: AuthMethod | null;
  /** API key identity (only present for API key auth). */
  apiKey: ApiKeyIdentity | null;
  /** Client IP address (for audit logging). */
  ip: string;
  /** Client User-Agent (for audit logging). */
  userAgent: string;
  /** Populated when `quotaMetric` is set on the handler config. */
  quotaStatus: QuotaStatus | null;
}

export interface HandlerConfig {
  /**
   * Whether the endpoint requires authentication.
   * When `true`, the handler receives `user`, `supabase`, and `membership`.
   * Default: `true`.
   */
  auth?: boolean;

  /**
   * Make tenant membership optional for this endpoint.
   * When `true`, the handler will not fail if the user has no tenant membership.
   * Useful for user-scoped resources (like support tickets) that don't require multi-tenancy.
   * Default: `false`.
   */
  tenantOptional?: boolean;

  /**
   * Minimum role required. Implies `auth: true`.
   * Uses hierarchy: super_admin > admin > member > viewer.
   */
  requiredRole?: Role;

  /**
   * Rate-limit configuration.
   * `maxRequests` per `windowMs` (default 60s) per tenant.
   */
  rateLimit?: {
    maxRequests: number;
    windowMs?: number;
  };

  /**
   * Declarative plan-level entitlement gate.
   *
   * When set, the handler factory calls `enforcePlanEntitlement(tenantId, action)`
   * **before** the route handler runs. If the tenant's plan is too low, a
   * `ForbiddenError` (403) is returned automatically.
   *
   * Use action keys from `ACTION_PLAN_MAP` (e.g. "research_social",
   * "video_generate", "social.publish").
   */
  requiredEntitlement?: string;

  /**
   * Declarative quota enforcement.
   *
   * When set, the handler factory calls `enforceQuota(tenantId, metric)`
   * before the handler runs and makes the quota status available on `ctx.quotaStatus`.
   * After the handler returns a success response (2xx), it automatically
   * calls `incrementUsage(tenantId, metric)`.
   *
   * This replaces the manual `enforceQuota()` + `incrementUsage()` calls in
   * each route handler.
   */
  quotaMetric?: string;

  /**
   * The actual handler function. Receives the enriched `ApiContext` and must
   * return a `NextResponse`.
   */
  handler: (ctx: ApiContext) => Promise<NextResponse>;
}

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

/**
 * Create an API route handler with all cross-cutting concerns wired up.
 *
 * Execution order:
 *   1. Generate / inherit request ID
 *   2. Authenticate (if `auth !== false`)
 *   3. Resolve tenant (if authenticated)
 *   4. Check role (if `requiredRole` is set)
 *   5. Enforce rate limit (if `rateLimit` is set)
 *   6. Resolve language
 *   7. Execute handler
 *   8. Catch errors and return structured JSON
 *
 * Usage in a route file:
 * ```ts
 * export const GET = createApiHandler({
 *   requiredRole: "member",
 *   rateLimit: { maxRequests: 60 },
 *   handler: async (ctx) => {
 *     return ok({ message: "hello" }, ctx.requestId);
 *   },
 * });
 * ```
 */
export function createApiHandler(config: HandlerConfig) {
  const needsAuth = config.auth !== false || !!config.requiredRole;

  return async (req: NextRequest): Promise<NextResponse> => {
    const requestId = getRequestId(req);
    let rateLimitResult: Awaited<ReturnType<typeof enforceRateLimit>> | null =
      null;

    // Extract client metadata once (for audit logging)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    try {
      /* -- Auth ---------------------------------------------------- */
      let user: User | null = null;
      let supabase: SupabaseClient | null = null;
      let membership: TenantMembership | null = null;
      let authMethod: AuthMethod | null = null;
      let apiKeyIdentity: ApiKeyIdentity | null = null;
      let quotaStatus: QuotaStatus | null = null;

      if (needsAuth) {
        const bearerToken = parseAuthorizationBearer(
          req.headers.get("authorization")
        );

        // Strategy 1: ZARZOOM API key (zarz_live_...)
        if (bearerToken) {
          apiKeyIdentity = await validateZarzApiKey(bearerToken);
        }

        if (apiKeyIdentity) {
          // API key auth verified -- build a synthetic membership
          authMethod = "api_key";
          membership = {
            id: apiKeyIdentity.apiKeyId,
            tenantId: apiKeyIdentity.tenantId,
            userId: apiKeyIdentity.userId,
            role: "member", // API keys always get member-level access
          };
        } else {
          // Strategy 2: Supabase session (cookies or bearer JWT)
          const auth = await authenticateRequest(req);
          user = auth.user;
          supabase = auth.supabase;
          authMethod = "session";

          // Tenant resolution -- prefer X-Tenant-Id header
          // Skip tenant resolution if tenantOptional is true
          if (!config.tenantOptional) {
            const preferredTenantId = req.headers.get("x-tenant-id");
            membership = await resolveTenant(
              supabase,
              user.id,
              preferredTenantId
            );
          } else {
            // Try to resolve tenant but don't fail if not found
            try {
              const preferredTenantId = req.headers.get("x-tenant-id");
              membership = await resolveTenant(
                supabase,
                user.id,
                preferredTenantId
              );
            } catch (err) {
              // Tenant membership not required for this endpoint
              membership = null;
            }
          }
        }

        // Role check (only if membership exists, or check global admin for tenant-optional endpoints)
        if (config.requiredRole) {
          if (membership) {
            requireRole(membership, config.requiredRole);
          } else if (config.tenantOptional && config.requiredRole === "admin") {
            // For tenant-optional endpoints that require admin, check the global is_admin flag
            if (!supabase) {
              throw new AuthError("Authentication required");
            }
            
            const { data: profile } = await supabase
              .from("profiles")
              .select("is_admin")
              .eq("id", user!.id)
              .single();

            if (!profile?.is_admin) {
              throw new ForbiddenError("Admin access required");
            }
          } else {
            // Required role but no membership and not tenant-optional admin check
            throw new ForbiddenError(`Role "${config.requiredRole}" required but no tenant membership found`);
          }
        }

        // Plan-level entitlement gate (only if membership exists)
        if (config.requiredEntitlement && membership) {
          await enforcePlanEntitlement(
            membership.tenantId,
            config.requiredEntitlement
          );
        }

        // Declarative quota enforcement (pre-handler check, only if membership exists)
        if (config.quotaMetric && membership) {
          quotaStatus = await enforceQuotaCheck(
            membership.tenantId,
            config.quotaMetric
          );
        }

        // Rate limit (per tenant or per user if no tenant)
        if (config.rateLimit) {
          const endpoint = `${req.method} ${req.nextUrl.pathname}`;
          const limitKey = membership?.tenantId || user?.id || ip;
          rateLimitResult = await enforceRateLimit(
            limitKey,
            endpoint,
            config.rateLimit.maxRequests,
            config.rateLimit.windowMs
          );
        }
      }

      /* -- Language ------------------------------------------------ */
      const language = resolveLanguage(req);

      /* -- Execute handler ----------------------------------------- */
      const ctx: ApiContext = {
        requestId,
        user,
        supabase,
        membership,
        language,
        req,
        authMethod,
        apiKey: apiKeyIdentity,
        ip,
        userAgent,
        quotaStatus,
      };

      const response = await config.handler(ctx);

      // Auto-increment quota after a successful response
      if (
        config.quotaMetric &&
        membership &&
        response.status >= 200 &&
        response.status < 300
      ) {
        await incrementUsage(membership.tenantId, config.quotaMetric);
      }

      // Attach request ID and rate-limit headers to the response
      response.headers.set("X-Request-Id", requestId);
      if (rateLimitResult && config.rateLimit) {
        const rlHeaders = rateLimitHeaders(
          config.rateLimit.maxRequests,
          rateLimitResult
        );
        for (const [key, value] of Object.entries(rlHeaders)) {
          response.headers.set(key, value);
        }
      }

      return response;
    } catch (err) {
      /* -- Error handling ------------------------------------------ */
      if (err instanceof AuthError) {
        return unauthorized(requestId, err.message);
      }
      if (err instanceof ForbiddenError) {
        return forbidden(requestId, err.message);
      }
      if (err instanceof NotFoundError) {
        return notFound(requestId, err.message);
      }
      if (err instanceof QuotaExceededError) {
        return NextResponse.json(
          {
            error: {
              code: err.code,
              message: err.message,
              requestId,
            },
          },
          {
            status: 402,
            headers: {
              "X-Request-Id": requestId,
              "X-Quota-Exceeded": "true",
            },
          }
        );
      }
      if (err instanceof RateLimitError) {
        return tooManyRequests(requestId, err.retryAfterSeconds, err.message);
      }
      if (err instanceof ValidationError) {
        return badRequest(requestId, err.message, err.details);
      }
      if (err instanceof ApiError) {
        return NextResponse.json(
          {
            error: {
              code: err.code,
              message: err.message,
              ...(err.details ? { details: err.details } : {}),
              requestId,
            },
          },
          {
            status: err.statusCode,
            headers: { "X-Request-Id": requestId },
          }
        );
      }

      // Unexpected error -- log and return 500
      console.error(`[API] Unhandled error (${requestId}):`, err);
      return serverError(requestId);
    }
  };
}
