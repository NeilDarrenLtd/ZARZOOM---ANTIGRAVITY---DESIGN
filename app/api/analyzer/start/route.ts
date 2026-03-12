/**
 * POST /api/analyzer/start
 *
 * 1. Validates request body.
 * 2. Enforces IP (5/hr) and session (3/session) rate limits.
 * 3. Checks analysis_cache for a non-expired completed entry → returns immediately.
 * 4. Runs the instant deterministic engine synchronously.
 * 5. Upserts a `pending` cache entry.
 * 6. Enqueues the AI analysis job.
 * 7. Returns instant data immediately; frontend polls /status.
 *
 * Auth is NOT required — this is a public homepage conversion endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
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

const SESSION_HEADER = "x-analyzer-session-id";

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

  const { profile_url, email } = parsed.data;

  // ── 2. Extract IP & session ───────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const sessionId =
    req.headers.get(SESSION_HEADER) ?? `anon-${randomUUID()}`;

  // ── 3. Rate limits ────────────────────────────────────────────────────────
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

  const sessionAllowed = await checkSessionLimit(sessionId);
  if (!sessionAllowed) {
    return NextResponse.json(
      {
        error: {
          code: "SESSION_LIMIT",
          message:
            "You have used all 3 free analyses for this session. Sign up to unlock more.",
        },
      },
      { status: 429 }
    );
  }

  // ── 4. Detect platform & build hash ──────────────────────────────────────
  const platform = detectPlatform(profile_url);
  const profileHash = buildProfileHash(platform, profile_url);

  // ── 5. Cache hit? Return completed entry immediately ──────────────────────
  const cached = await getCacheEntry(profileHash);
  if (cached?.status === "completed" && cached.instant_json && cached.ui_json) {
    return NextResponse.json({
      analysis_id: cached.id,
      status: "completed",
      instant: cached.instant_json,
      teaser: cached.ui_json.teaser,
      cached: true,
    });
  }

  // If pending entry already exists (another request racing), return it
  if (cached?.status === "pending" && cached.instant_json) {
    return NextResponse.json({
      analysis_id: cached.id,
      status: "pending",
      instant: cached.instant_json,
      cached: false,
    });
  }

  // ── 6. Run instant engine synchronously ──────────────────────────────────
  const instant = runInstantEngine(profile_url);
  const analysisId = randomUUID();

  // ── 7. Persist pending cache row ─────────────────────────────────────────
  await upsertCachePending(
    analysisId,
    profileHash,
    profile_url,
    platform,
    instant
  );

  // ── 8. Enqueue AI analysis job ───────────────────────────────────────────
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

  // ── 9. Emit webhook event (fire-and-forget) ───────────────────────────────
  emitWebhookEvent({
    event: "analysis.started",
    analysis_id: analysisId,
    profile_url,
    platform,
  }).catch((err) =>
    console.warn("[Analyzer] webhook analysis.started failed:", err)
  );

  // ── 10. Return instant data ───────────────────────────────────────────────
  return NextResponse.json(
    {
      analysis_id: analysisId,
      status: "pending",
      instant,
      cached: false,
    },
    { status: 202 }
  );
}

// ============================================================================
// Internal webhook emitter
// ============================================================================

async function emitWebhookEvent(payload: {
  event: string;
  analysis_id: string;
  profile_url: string;
  platform: string;
  ui_json?: unknown;
  error?: string;
}) {
  const webhookUrl = process.env.ANALYZER_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
  });
}
