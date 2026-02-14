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
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  tooManyRequests,
  serverError,
} from "./http-responses";
import {
  ApiError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "./errors";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ApiContext {
  /** Correlation ID for this request. */
  requestId: string;
  /** Authenticated Supabase user (only present if `auth: true`). */
  user: User | null;
  /** Supabase client scoped to the user's session. */
  supabase: SupabaseClient | null;
  /** Resolved tenant membership (only present if `auth: true`). */
  membership: TenantMembership | null;
  /** Resolved language for this request. */
  language: SupportedLanguage;
  /** The raw Next.js request. */
  req: NextRequest;
}

export interface HandlerConfig {
  /**
   * Whether the endpoint requires authentication.
   * When `true`, the handler receives `user`, `supabase`, and `membership`.
   * Default: `true`.
   */
  auth?: boolean;

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

    try {
      /* -- Auth ---------------------------------------------------- */
      let user: User | null = null;
      let supabase: SupabaseClient | null = null;
      let membership: TenantMembership | null = null;

      if (needsAuth) {
        const auth = await authenticateRequest(req);
        user = auth.user;
        supabase = auth.supabase;

        // Tenant resolution -- prefer X-Tenant-Id header
        const preferredTenantId = req.headers.get("x-tenant-id");
        membership = await resolveTenant(
          supabase,
          user.id,
          preferredTenantId
        );

        // Role check
        if (config.requiredRole) {
          requireRole(membership, config.requiredRole);
        }

        // Rate limit (per tenant)
        if (config.rateLimit) {
          const endpoint = `${req.method} ${req.nextUrl.pathname}`;
          rateLimitResult = await enforceRateLimit(
            membership.tenantId,
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
      };

      const response = await config.handler(ctx);

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
