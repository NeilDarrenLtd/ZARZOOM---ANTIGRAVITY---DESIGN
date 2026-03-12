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
} from "@/lib/analyzer/db";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_HEADER = "x-analyzer-session-id";

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

  // ── 2. Platform check ─────────────────────────────────────────────────────
  const platform = detectPlatform(profile_url);

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

  // ── 4. CAPTCHA verification ───────────────────────────────────────────────
  // Token is passed in the request body as `captcha_token` or via the
  // `cf-turnstile-response` header (both are checked for flexibility).
  const captchaToken =
    (body as Record<string, unknown>)["captcha_token"] as string | null ??
    req.headers.get("cf-turnstile-response");

  const captchaOk = await verifyCaptcha(captchaToken, ip);
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

  // ── 7. Build profile hash ─────────────────────────────────────────────────
  const profileHash = buildProfileHash(platform, profile_url);

  // ── 8. Cache hit? Return completed entry immediately ─────────────────────
  const cached = await getCacheEntry(profileHash);

  if (cached?.status === "completed" && cached.instant_json && cached.ui_json) {
    return NextResponse.json({
      analysis_id: cached.id,
      status: "completed" as const,
      instant: cached.instant_json,
      teaser: cached.ui_json.teaser ?? null,
      full_report: null, // full_report requires auth — withheld here
      cache_hit: true,
    });
  }

  // Race-safe: if a pending entry already exists (e.g. concurrent request),
  // return it so the caller can poll /status without spawning a duplicate job.
  if (cached?.status === "pending" && cached.instant_json) {
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

  // ── 10. Persist pending cache row ─────────────────────────────────────────
  await upsertCachePending(analysisId, profileHash, profile_url, platform, instant);

  // ── 11. Enqueue AI analysis job ───────────────────────────────────────────
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

  // ── 12. Emit webhook event (fire-and-forget) ──────────────────────────────
  emitWebhookEvent({
    event: "analysis.started",
    analysis_id: analysisId,
    profile_url,
    platform,
  }).catch((err) =>
    console.warn("[Analyzer/start] analysis.started webhook failed:", err)
  );

  // ── 13. Return instant result ─────────────────────────────────────────────
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
