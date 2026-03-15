/**
 * ZARZOOM Social Profile Analyzer
 * DB-backed cache + rate-limit helpers
 *
 * SERVER-ONLY — never import in client components.
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import type { AnalysisResult, Instant } from "./types";

// ============================================================================
// Admin Supabase client (no cookie context)
// ============================================================================

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// ============================================================================
// Profile hash
// ============================================================================

/**
 * Deterministic, stable cache key for a profile.
 * SHA-256(platform + ":" + lowercased URL with trailing slash stripped).
 */
export function buildProfileHash(platform: string, profileUrl: string): string {
  const normalised = profileUrl.toLowerCase().replace(/\/$/, "");
  return createHash("sha256")
    .update(`${platform}:${normalised}`)
    .digest("hex");
}

// ============================================================================
// Cache read
// ============================================================================

export interface CacheHit {
  id: string;
  status: "pending" | "completed" | "failed";
  profile_url: string | null;
  platform: string | null;
  instant_json: Instant | null;
  ui_json: AnalysisResult | null;
  analysis_json: unknown | null;
  expires_at: string;
}

/**
 * Look up a non-expired cache entry by profile hash.
 * Returns null on cache miss or if the entry is expired.
 */
export async function getCacheEntry(
  profileHash: string
): Promise<CacheHit | null> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("analysis_cache")
    .select("id, status, profile_url, platform, instant_json, ui_json, analysis_json, expires_at")
    .eq("profile_hash", profileHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return data as CacheHit;
}

/**
 * Debug helper: read back a cache row by id without any expires_at filtering.
 * Used by analyzer routes to trace row lifecycle issues.
 */
export async function debugReadCacheById(cacheId: string): Promise<{
  row: {
    id: string;
    status: string;
    profile_hash: string;
    profile_url: string;
    platform: string;
  } | null;
  error: Error | null;
}> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("analysis_cache")
    .select("id, status, profile_hash, profile_url, platform")
    .eq("id", cacheId)
    .maybeSingle();

  if (error || !data) {
    return {
      row: null,
      error: error
        ? new Error(error.message)
        : null,
    };
  }

  return {
    row: data as {
      id: string;
      status: string;
      profile_hash: string;
      profile_url: string;
      platform: string;
    },
    error: null,
  };
}

// ============================================================================
// Cache write helpers
// ============================================================================

/**
 * Insert a new cache row with `pending` status after instant engine runs.
 *
 * The table has a UNIQUE constraint on `profile_hash`, so we delete any
 * previous row for the same profile before inserting.  This guarantees each
 * analysis run gets its own fresh row keyed by `id` (analysis_id) while
 * respecting the existing schema constraint.
 */
export async function upsertCachePending(
  id: string,
  profileHash: string,
  profileUrl: string,
  platform: string,
  instantJson: Instant
): Promise<void> {
  const admin = getAdmin();

  await admin
    .from("analysis_cache")
    .delete()
    .eq("profile_hash", profileHash);

  const { error } = await admin.from("analysis_cache").insert({
    id,
    profile_hash: profileHash,
    profile_url: profileUrl,
    platform,
    status: "pending",
    instant_json: instantJson,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  if (error) {
    throw new Error(
      `[analyzer/db] upsertCachePending failed for analysis_id=${id}: ${error.message}`
    );
  }
}

/**
 * Write completed AI output to the cache row identified by `cacheId`.
 * Stores raw AI output in `analysis_json` and the normalised UI contract in `ui_json`.
 */
export async function updateCacheCompleted(
  cacheId: string,
  analysisJson: unknown,
  uiJson: AnalysisResult,
  debugCtx?: { profileUrl?: string; platform?: string; sourcePath?: string }
): Promise<void> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("analysis_cache")
    .update({
      status: "completed",
      analysis_json: analysisJson,
      ui_json: uiJson,
    })
    .eq("id", cacheId)
    .select("id");

  if (error) {
    throw new Error(
      `[analyzer/db] updateCacheCompleted failed for analysis_id=${cacheId}: ${error.message}`
    );
  }

  const updatedCount = data?.length ?? 0;
  if (updatedCount !== 1) {
    if (debugCtx?.profileUrl) {
      const { data: nearby } = await admin
        .from("analysis_cache")
        .select("id, profile_hash, status, profile_url")
        .eq("profile_url", debugCtx.profileUrl)
        .order("created_at", { ascending: false })
        .limit(5);

      // eslint-disable-next-line no-console
      console.error("[analyzer/db] updateCacheCompleted debug", {
        analysis_id: cacheId,
        profile_url: debugCtx.profileUrl,
        platform: debugCtx.platform,
        source_path: debugCtx.sourcePath,
        rows: nearby ?? [],
      });
    }

    throw new Error(
      `[analyzer/db] updateCacheCompleted: expected to update 1 row for analysis_id=${cacheId}, updated ${updatedCount}`
    );
  }
}

/**
 * Mark a cache entry as failed with an optional error payload.
 */
export async function updateCacheFailed(
  cacheId: string,
  error: string
): Promise<void> {
  const admin = getAdmin();
  await admin
    .from("analysis_cache")
    .update({
      status: "failed",
      analysis_json: { error },
    })
    .eq("id", cacheId);
}

/**
 * Read a single cache entry by its primary key (analysis_id).
 */
export async function getCacheById(cacheId: string): Promise<CacheHit | null> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("analysis_cache")
    .select("id, status, profile_url, platform, instant_json, ui_json, analysis_json, expires_at")
    .eq("id", cacheId)
    .maybeSingle();

  if (error || !data) return null;
  return data as CacheHit;
}

// ============================================================================
// Analysis queue helpers
// ============================================================================

export async function enqueueAnalysis(opts: {
  id: string;
  profileUrl: string;
  platform: string;
  sessionId: string;
  ipAddress: string;
  email?: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const admin = getAdmin();
  await admin.from("analysis_queue").insert({
    id: opts.id,
    profile_url: opts.profileUrl,
    platform: opts.platform,
    session_id: opts.sessionId,
    ip_address: opts.ipAddress,
    email: opts.email ?? null,
    status: "pending",
    payload_json: opts.payload,
  });

  console.log("[analyzer/db] Queue row inserted", {
    id: opts.id,
    platform: opts.platform,
    hasEmail: !!opts.email,
  });
}

export async function markQueueProcessing(queueId: string): Promise<void> {
  const admin = getAdmin();
  await admin
    .from("analysis_queue")
    .update({ status: "processing" })
    .eq("id", queueId);
}

export async function markQueueCompleted(queueId: string): Promise<void> {
  const admin = getAdmin();
  await admin
    .from("analysis_queue")
    .update({ status: "completed" })
    .eq("id", queueId);
}

export async function markQueueFailed(queueId: string): Promise<void> {
  const admin = getAdmin();
  await admin
    .from("analysis_queue")
    .update({ status: "failed" })
    .eq("id", queueId);
}

// ============================================================================
// IP-based rate limiting (5 per IP per hour)
// Uses the existing `rate_limits` table with a synthetic tenant_id from IP hash.
// ============================================================================

const IP_MAX_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Check and increment the IP rate limit counter.
 * Returns true if the request is allowed, false if the limit is exceeded.
 */
export async function checkIpRateLimit(ipAddress: string): Promise<boolean> {
  const admin = getAdmin();
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
  const windowKey = `analyzer:ip:${ipAddress}:${windowStart.toISOString()}`;

  // Use a hashed IP as the tenant_id placeholder (UUID v5-ish from hash)
  const ipHash = createHash("sha256").update(ipAddress).digest("hex");
  const fakeTenantId = [
    ipHash.slice(0, 8),
    ipHash.slice(8, 12),
    "4" + ipHash.slice(13, 16),
    ((parseInt(ipHash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) +
      ipHash.slice(18, 20),
    ipHash.slice(20, 32),
  ].join("-");

  const { data: existing } = await admin
    .from("rate_limits")
    .select("id, count")
    .eq("tenant_id", fakeTenantId)
    .eq("window_key", windowKey)
    .maybeSingle();

  if (existing) {
    if (existing.count >= IP_MAX_PER_HOUR) return false;
    await admin
      .from("rate_limits")
      .update({ count: existing.count + 1 })
      .eq("id", existing.id);
  } else {
    await admin.from("rate_limits").insert({
      tenant_id: fakeTenantId,
      window_key: windowKey,
      count: 1,
    });
  }

  return true;
}

// ============================================================================
// Session-based rate limiting (3 analyses per session)
// ============================================================================

const SESSION_MAX = 3;

/**
 * Check how many analyses the session has started.
 * Returns true if allowed (under limit), false if capped.
 */
export async function checkSessionLimit(sessionId: string): Promise<boolean> {
  const admin = getAdmin();
  const { count } = await admin
    .from("analysis_queue")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  return (count ?? 0) < SESSION_MAX;
}

// ============================================================================
// Per-user analyzer usage limit (with site-wide default from site_settings)
// ============================================================================

/**
 * Checks whether a user has remaining analyzer uses.
 * Increments the counter if allowed.
 * Returns true if the user is under the limit.
 */
export async function checkAndIncrementAnalyzerUsage(
  userId: string
): Promise<boolean> {
  const admin = getAdmin();

  const [{ data: profile }, { data: setting }] = await Promise.all([
    admin
      .from("profiles")
      .select("analyzer_usage_count, analyzer_usage_limit")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("site_settings")
      .select("value")
      .eq("key", "usage_analyzer_default")
      .maybeSingle(),
  ]);

  if (!profile) return true; // unknown user — fall through to session/IP limits

  const globalLimit = (() => {
    const raw = setting?.value as string | null | undefined;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 3;
  })();

  const limit = profile.analyzer_usage_limit ?? globalLimit;
  const count = profile.analyzer_usage_count ?? 0;

  if (count >= limit) return false;

  await admin
    .from("profiles")
    .update({ analyzer_usage_count: count + 1 })
    .eq("id", userId);

  return true;
}

// ============================================================================
// 1 refresh per profile per 24 hours
// ============================================================================

/**
 * Returns true if the profile can be re-analyzed (no valid cache exists or cache expired).
 */
export async function canRefreshProfile(profileHash: string): Promise<boolean> {
  const admin = getAdmin();
  const { data } = await admin
    .from("analysis_cache")
    .select("expires_at")
    .eq("profile_hash", profileHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  // If a non-expired entry exists, block refresh
  return data === null;
}
