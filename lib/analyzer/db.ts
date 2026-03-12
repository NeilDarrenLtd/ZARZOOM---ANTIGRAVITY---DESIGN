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
    .select("id, status, instant_json, ui_json, analysis_json, expires_at")
    .eq("profile_hash", profileHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return data as CacheHit;
}

// ============================================================================
// Cache write helpers
// ============================================================================

/**
 * Upsert a new cache row with `pending` status after instant engine runs.
 * Uses ON CONFLICT on profile_hash to handle race conditions.
 */
export async function upsertCachePending(
  id: string,
  profileHash: string,
  profileUrl: string,
  platform: string,
  instantJson: Instant
): Promise<void> {
  const admin = getAdmin();
  await admin.from("analysis_cache").upsert(
    {
      id,
      profile_hash: profileHash,
      profile_url: profileUrl,
      platform,
      status: "pending",
      instant_json: instantJson,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "profile_hash" }
  );
}

/**
 * Write completed AI output to the cache row identified by `cacheId`.
 * Stores raw AI output in `analysis_json` and the normalised UI contract in `ui_json`.
 */
export async function updateCacheCompleted(
  cacheId: string,
  analysisJson: unknown,
  uiJson: AnalysisResult
): Promise<void> {
  const admin = getAdmin();
  await admin
    .from("analysis_cache")
    .update({
      status: "completed",
      analysis_json: analysisJson,
      ui_json: uiJson,
    })
    .eq("id", cacheId);
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
    .select("id, status, instant_json, ui_json, analysis_json, expires_at")
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
