/**
 * POST /api/analyzer/start
 *
 * Public homepage conversion endpoint — no auth required.
 *
 * Pipeline:
 *   1.  Parse & validate request body
 *   2.  Detect platform (rejects "unknown" as unsupported)
 *   3.  Verify Cloudflare Turnstile CAPTCHA token
 *   4.  Enforce IP rate limit  (5 analyses / IP / hour)
 *   5.  Enforce session limit  (3 analyses / session)
 *   6.  Build deterministic profile hash
 *   7.  Check analysis_cache for a valid, non-expired completed entry → early return
 *   8.  Return pending entry if one already exists (race-safe)
 *   9.  Run instant deterministic engine (<5 ms, no I/O)
 *  10.  Upsert pending cache row
 *  11.  Enqueue AI analysis job
 *  12.  Emit analysis.started webhook (fire-and-forget)
 *  13.  Return instant result with 202 Accepted
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { StartRequestSchema } from "@/lib/analyzer/types";
import { runInstantEngine, detectPlatform } from "@/lib/analyzer/instantEngine";
import {
  buildProfileHash,
  getCacheEntry,
  upsertCachePending,
  enqueueAnalysis,
  checkIpRateLimit,
  checkSessionLimit,
  checkAndIncrementAnalyzerUsage,
  updateCacheCompleted,
  updateCacheFailed,
} from "@/lib/analyzer/db";
import { createServerClient } from "@supabase/ssr";
import { runAiAnalysis, normalizeToUiContract } from "@/lib/analyzer/aiAnalysis";
import { logActivity } from "@/lib/logging/activity";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_HEADER = "x-analyzer-session-id";
// For now we prefer a fully synchronous, reliable path that does not depend
// on an external worker/queue being online. Async mode can be restored later
// once the worker infrastructure is guaranteed to run.
const USE_ASYNC_WORKER = false;

// Temporary: when true, skip returning cached completed analyses so every request
// runs the full flow (instant engine + prompt substitution + OpenRouter). Revert when caching is wanted again.
const DISABLE_ANALYZER_CACHE = process.env.DISABLE_ANALYZER_CACHE === "true";

/**
 * Platforms supported by the analyzer.
 * Requests for "unknown" profiles are rejected before any DB work.
 */
const SUPPORTED_PLATFORMS = new Set([
  "instagram",
  "tiktok",
  "youtube",
  "twitter",
  "linkedin",
  "facebook",
  "pinterest",
  "threads",
  "reddit",
  "bluesky",
]);

// ─────────────────────────────────────────────────────────────────────────────
// CAPTCHA verification (Cloudflare Turnstile)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies a Cloudflare Turnstile token server-side.
 *
 * If TURNSTILE_SECRET_KEY is not set (e.g. local dev), verification is skipped
 * and the function returns true — so the endpoint still works without CAPTCHA
 * configured in the environment.
 *
 * @param token   - The cf-turnstile-response token from the client
 * @param remoteip - Caller IP, forwarded to Turnstile for additional signal
 */
async function verifyCaptcha(token: string | null, remoteip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Skip in dev / if secret not configured
  if (!secret) return true;
  // Missing token = fail
  if (!token) return false;

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token, remoteip }),
      }
    );

    if (!res.ok) return false;
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch (err) {
    console.warn("[Analyzer/start] Turnstile verification failed:", err);
    // Fail open in case of network error to avoid blocking legitimate users
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Parse & validate ───────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = StartRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 422 }
    );
  }

  const { profile_url, email, signals } = parsed.data;

  // ──── TEMPORARY DEBUG CHECKPOINT ────
  console.log("🔴 [1] FLOATING_ANALYZER_REQUEST_RECEIVED", {
    profile_url,
    hasEmail: !!email,
    hasSignals: !!signals,
    timestamp: new Date().toISOString(),
  });
  // ──── END TEMPORARY DEBUG CHECKPOINT ────

  // ── 2. Platform check ─────────────────────────────────────────────────────
  const platform = detectPlatform(profile_url);

  // ──── TEMPORARY DEBUG CHECKPOINT ────
  console.log("🔴 [2] FLOATING_ANALYZER_PLATFORM_INFERRED", {
    profile_url,
    platform,
    isSupported: SUPPORTED_PLATFORMS.has(platform),
    timestamp: new Date().toISOString(),
  });
  // ──── END TEMPORARY DEBUG CHECKPOINT ────

  if (!SUPPORTED_PLATFORMS.has(platform)) {
    return NextResponse.json(
      {
        error: {
          code: "UNSUPPORTED_PLATFORM",
          message:
            "We only analyse Instagram, TikTok, YouTube, X, LinkedIn, Facebook, Pinterest, Threads, Reddit, and Bluesky profiles.",
        },
      },
      { status: 422 }
    );
  }

  // ── 3. Extract IP & session ───────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const sessionId =
    req.headers.get(SESSION_HEADER) ?? `anon-${randomUUID()}`;

  void logActivity({
    category: "analyzer",
    stage: "analyzer.workflow_started",
    level: "info",
    profileUrl: profile_url,
    platform,
    sessionId,
    details: { profileUrl: profile_url, platform, sessionId },
  });

  // ── 4. CAPTCHA verification ───────────────────────────────────────────────
  // Token is passed in the request body as `captcha_token` or via the
  // `cf-turnstile-response` header (both are checked for flexibility).
  const captchaToken =
    (body as Record<string, unknown>)["captcha_token"] as string | null ??
    req.headers.get("cf-turnstile-response");

  const captchaOk = await verifyCaptcha(captchaToken, ip);
  void logActivity({
    category: "analyzer",
    stage: "analyzer.limit_check",
    level: captchaOk ? "info" : "warn",
    profileUrl: profile_url,
    platform,
    sessionId,
    details: { check: "captcha", passed: captchaOk },
  });
  if (!captchaOk) {
    return NextResponse.json(
      {
        error: {
          code: "CAPTCHA_FAILED",
          message: "CAPTCHA verification failed. Please refresh and try again.",
        },
      },
      { status: 403 }
    );
  }

  // ── 5. IP rate limit ──────────────────────────────────────────────────────
  const ipAllowed = await checkIpRateLimit(ip);
  void logActivity({
    category: "analyzer",
    stage: "analyzer.limit_check",
    level: ipAllowed ? "info" : "warn",
    profileUrl: profile_url,
    platform,
    sessionId,
    details: { check: "ip_rate", passed: ipAllowed },
  });
  if (!ipAllowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many analyses from this IP. Please try again in 1 hour.",
        },
      },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  // ── 6. Session rate limit ─────────────────────────────────────────────────
  const sessionAllowed = await checkSessionLimit(sessionId);
  void logActivity({
    category: "analyzer",
    stage: "analyzer.limit_check",
    level: sessionAllowed ? "info" : "warn",
    profileUrl: profile_url,
    platform,
    sessionId,
    details: { check: "session", passed: sessionAllowed },
  });
  if (!sessionAllowed) {
    return NextResponse.json(
      {
        error: {
          code: "SESSION_LIMIT",
          message:
            "You have used all 3 free analyses for this session. Sign up to unlock unlimited analyses.",
        },
      },
      { status: 429 }
    );
  }

  // ── 6b. Per-user analyzer limit (only when logged in) ──────────────────
  let resolvedUserId: string | null = null;
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    resolvedUserId = user?.id ?? null;
  } catch { /* not logged in — skip */ }

  if (resolvedUserId) {
    const userAllowed = await checkAndIncrementAnalyzerUsage(resolvedUserId);
    void logActivity({
      category: "analyzer",
      stage: "analyzer.limit_check",
      level: userAllowed ? "info" : "warn",
      profileUrl: profile_url,
      platform,
      sessionId,
      details: { check: "user_analyzer", passed: userAllowed, userId: resolvedUserId },
    });
    if (!userAllowed) {
      return NextResponse.json(
        {
          error: {
            code: "USER_ANALYZER_LIMIT",
            message: "You have reached your analyzer usage limit. Contact support to increase it.",
          },
        },
        { status: 429 }
      );
    }
  }

  // ── 7. Build profile hash ─────────────────────────────────────────────────
  const profileHash = buildProfileHash(platform, profile_url);
  console.log("[Analyzer/start] Platform + hash", { platform, profileHash });

  // ── 8. Cache hit? Return completed entry immediately ─────────────────────
  const cached = await getCacheEntry(profileHash);

  if (cached?.status === "completed" && cached.instant_json && cached.ui_json) {
    if (!DISABLE_ANALYZER_CACHE) {
      void logActivity({
        category: "analyzer",
        stage: "**FAILURE** analyzer_cache_hit_skip_openrouter",
        level: "warn",
        analysisId: cached.id,
        profileUrl: profile_url,
        platform,
        sessionId,
        details: {
          reason: "cache_hit",
          profileUrl: profile_url,
          platform,
          analysisId: cached.id,
          served: "cache",
          status: "completed",
        },
      });

      return NextResponse.json({
        analysis_id: cached.id,
        status: "completed" as const,
        instant: cached.instant_json,
        teaser: cached.ui_json.teaser ?? null,
        full_report: null, // full_report requires auth — withheld here
        cache_hit: true,
      });
    }
    // Cache disabled: fall through so full pipeline (instant + substitution + OpenRouter) runs
  }

  // Race-safe pending behavior only makes sense when the async worker path
  // is enabled. In sync mode we treat "pending" cache rows as stale and
  // re-run analysis instead of returning a forever-pending status.
  if (USE_ASYNC_WORKER && cached?.status === "pending" && cached.instant_json) {
    void logActivity({
      category: "analyzer",
      stage: "analyzer.served_to_user",
      level: "info",
      analysisId: cached.id,
      profileUrl: profile_url,
      platform,
      sessionId,
      details: { served: "pending", status: "pending", source: "async" },
    });
    return NextResponse.json(
      {
        analysis_id: cached.id,
        status: "pending" as const,
        instant: cached.instant_json,
        cache_hit: false,
      },
      { status: 202 }
    );
  }

  // ── 9. Run instant engine synchronously (<5 ms) ───────────────────────────
  // Pass optional scraped signals to enrich the deterministic score.
  const instant = runInstantEngine(profile_url, signals);
  const analysisId = randomUUID();

  if (USE_ASYNC_WORKER) {
    // ── 10a. Async path: persist pending + enqueue worker job ───────────────
    await upsertCachePending(analysisId, profileHash, profile_url, platform, instant);

    await enqueueAnalysis({
      id: analysisId,
      profileUrl: profile_url,
      platform,
      sessionId,
      ipAddress: ip,
      email,
      payload: {
        analysis_id: analysisId,
        profile_url,
        platform,
        profile_hash: profileHash,
        instant_json: instant,
        session_id: sessionId,
      },
    });

    emitWebhookEvent({
      event: "analysis.started",
      analysis_id: analysisId,
      profile_url,
      platform,
    }).catch((err) =>
      console.warn("[Analyzer/start] analysis.started webhook failed:", err)
    );

    void logActivity({
      category: "analyzer",
      stage: "analyzer.served_to_user",
      level: "info",
      analysisId,
      profileUrl: profile_url,
      platform,
      sessionId,
      details: { served: "pending", status: "pending", source: "async" },
    });

    return NextResponse.json(
      {
        analysis_id: analysisId,
        status: "pending" as const,
        instant,
        cache_hit: false,
      },
      { status: 202 }
    );
  }

  // ── 10b. Sync path: call OpenRouter directly and return completed result ──
  console.log("[Analyzer/start] Sync mode enabled, calling OpenRouter inline", {
    analysis_id: analysisId,
    platform,
  });

  // Persist a pending cache row up-front so the analysis_id is durable and
  // discoverable by /api/analyzer/result, even if something goes wrong later.
  await upsertCachePending(analysisId, profileHash, profile_url, platform, instant);

  try {
    const aiResult = await runAiAnalysis(instant, profile_url, analysisId);
    const uiContract = normalizeToUiContract(analysisId, instant, aiResult.raw);

    await updateCacheCompleted(analysisId, aiResult.raw, uiContract, {
      profileUrl: profile_url,
      platform,
      sourcePath: "sync_start_route",
    });

    void logActivity({
      category: "analyzer",
      stage: "analyzer.openrouter_result_written_to_cache",
      level: "info",
      analysisId,
      profileUrl: profile_url,
      platform,
      sessionId,
      details: {
        analysis_id: analysisId,
        profile_url: profile_url,
        platform,
        source: "openrouter",
        written: "analysis_cache (analysis_json + ui_json)",
      },
    });

    void logActivity({
      category: "analyzer",
      stage: "analyzer.served_to_user",
      level: "info",
      analysisId,
      profileUrl: profile_url,
      platform,
      sessionId,
      details: {
        served: "openrouter",
        status: "completed",
        cache_hit: false,
        source: "openrouter",
      },
    });

    return NextResponse.json(
      {
        analysis_id: analysisId,
        status: "completed" as const,
        instant: uiContract.instant,
        teaser: uiContract.teaser,
        cache_hit: false,
      },
      { status: 200 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown AI analysis error";
    console.error("[Analyzer/start] Sync analysis failed", {
      analysis_id: analysisId,
      error: message,
    });

    await updateCacheFailed(analysisId, message);
    void logActivity({
      category: "analyzer",
      stage: "**FAILURE** analyzer_openrouter_call_failed",
      level: "error",
      analysisId,
      profileUrl: profile_url,
      platform,
      sessionId,
      details: {
        reason: "openrouter_call_failed",
        error_summary: message,
        served: "failed",
      },
    });

    return NextResponse.json(
      {
        analysis_id: analysisId,
        status: "failed" as const,
        instant,
        cache_hit: false,
        error: { code: "AI_ERROR", message },
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal webhook emitter
// ─────────────────────────────────────────────────────────────────────────────

interface WebhookPayload {
  event: string;
  analysis_id: string;
  profile_url: string;
  platform: string;
  ui_json?: unknown;
  error?: string;
}

async function emitWebhookEvent(payload: WebhookPayload): Promise<void> {
  const webhookUrl = process.env.ANALYZER_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
  });
}
