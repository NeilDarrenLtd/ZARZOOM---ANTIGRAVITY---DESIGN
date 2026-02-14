import { createServerClient } from "@supabase/ssr";
import { env } from "./env";
import { RateLimitError } from "./errors";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Sliding-window rate limiter backed by the `rate_limits` table.
 *
 * Each (tenant, endpoint, window) combination gets a counter row. When the
 * window expires a new row is created and the old count is ignored.
 *
 * @param tenantId   The tenant making the request.
 * @param endpoint   Identifier for the endpoint (e.g. "POST /api/v1/jobs").
 * @param windowMs   Window size in milliseconds (default 60 000 = 1 minute).
 * @param maxRequests Maximum requests allowed within the window.
 */
export async function checkRateLimit(
  tenantId: string,
  endpoint: string,
  maxRequests: number,
  windowMs = 60_000
): Promise<RateLimitResult> {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

  // Use service-role client because rate_limits RLS only allows service role
  const admin = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { cookies: { getAll: () => [], setAll() {} } }
  );

  const now = new Date();
  const windowStart = new Date(
    Math.floor(now.getTime() / windowMs) * windowMs
  );
  const windowEnd = new Date(windowStart.getTime() + windowMs);
  const windowKey = `${endpoint}:${windowStart.toISOString()}`;

  // Try to increment the existing counter
  const { data: existing } = await admin
    .from("rate_limits")
    .select("id, count")
    .eq("tenant_id", tenantId)
    .eq("window_key", windowKey)
    .single();

  let currentCount: number;

  if (existing) {
    const newCount = existing.count + 1;
    await admin
      .from("rate_limits")
      .update({ count: newCount })
      .eq("id", existing.id);
    currentCount = newCount;
  } else {
    // Create a new window counter
    await admin.from("rate_limits").insert({
      tenant_id: tenantId,
      window_key: windowKey,
      count: 1,
    });
    currentCount = 1;
  }

  const remaining = Math.max(0, maxRequests - currentCount);
  const result: RateLimitResult = {
    allowed: currentCount <= maxRequests,
    remaining,
    resetAt: windowEnd,
  };

  return result;
}

/**
 * Enforce rate limit -- throws `RateLimitError` if the limit is breached.
 */
export async function enforceRateLimit(
  tenantId: string,
  endpoint: string,
  maxRequests: number,
  windowMs = 60_000
): Promise<RateLimitResult> {
  const result = await checkRateLimit(tenantId, endpoint, maxRequests, windowMs);
  if (!result.allowed) {
    const retryAfter = Math.ceil(
      (result.resetAt.getTime() - Date.now()) / 1000
    );
    throw new RateLimitError(retryAfter);
  }
  return result;
}

/**
 * Build standard rate-limit headers for the response.
 */
export function rateLimitHeaders(
  maxRequests: number,
  result: RateLimitResult
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(maxRequests),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt.getTime() / 1000)),
  };
}
