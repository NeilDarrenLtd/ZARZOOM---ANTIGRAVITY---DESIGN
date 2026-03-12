/**
 * POST /api/analyzer/worker
 *
 * Internal queue consumer route. Called by:
 *   a) The queue producer's QUEUE_PUSH_URL (HTTP push mode), OR
 *   b) A cron / external poll worker (pull mode) that POSTs each job.
 *
 * Verifies a shared ANALYZER_WORKER_SECRET header before processing.
 * Performs the AI analysis, normalises the result into the UI contract,
 * and writes it back to `analysis_cache`.
 *
 * Retry contract:
 *   - If OpenRouter returns a JSON parse error, retries once automatically
 *     (MAX_RETRIES=1 is enforced inside callOpenRouterTyped).
 *   - If the AI call fails after retries, the cache entry is marked `failed`
 *     and a `analysis.failed` webhook event is emitted.
 *   - This route always returns 200 so the queue does NOT re-deliver on
 *     application-level failures (the error is captured in the DB).
 *     On network errors (5xx) the queue will retry via its own mechanism.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAiAnalysis, normalizeToUiContract } from "@/lib/analyzer/aiAnalysis";
import {
  getCacheById,
  updateCacheCompleted,
  updateCacheFailed,
  markQueueProcessing,
  markQueueCompleted,
  markQueueFailed,
} from "@/lib/analyzer/db";
import type { Instant } from "@/lib/analyzer/types";

// ============================================================================
// Worker job payload schema
// ============================================================================

/**
 * Signals shape mirrors the spec's worker input contract.
 * Stored in analysis_queue.payload_json.signals and forwarded verbatim
 * to the normalizer — the instant engine values are authoritative.
 */
const WorkerSignalsSchema = z.object({
  platform_detected: z.string().optional(),
  keywords_detected: z.array(z.string()).optional(),
  posting_frequency_estimate: z.enum(["low", "medium", "high", "unknown"]).optional(),
  creator_score: z.number().optional(),
  strengths: z.array(z.string()).optional(),
  opportunities: z.array(z.string()).optional(),
}).passthrough(); // allow extra fields from future engine versions

const WorkerPayloadSchema = z.object({
  analysis_id: z.string().uuid(),
  profile_url: z.string().url(),
  platform: z.string(),
  profile_hash: z.string(),
  instant_json: z.record(z.unknown()),
  session_id: z.string().optional(),
  /** Optional pre-computed signals forwarded from /start */
  signals: WorkerSignalsSchema.optional(),
});

// ============================================================================
// Route handler
// ============================================================================

export async function POST(req: NextRequest) {
  // ── Auth: verify worker secret ────────────────────────────────────────────
  const secret = process.env.ANALYZER_WORKER_SECRET;
  if (secret) {
    const provided = req.headers.get("x-worker-secret");
    if (provided !== secret) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Invalid worker secret" } },
        { status: 403 }
      );
    }
  }

  // ── Parse payload ─────────────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON" } },
      { status: 400 }
    );
  }

  // Support both direct payload and queue-wrapped message
  const payloadCandidate =
    rawBody &&
    typeof rawBody === "object" &&
    "payload" in (rawBody as Record<string, unknown>)
      ? (rawBody as Record<string, unknown>).payload
      : rawBody;

  const parsed = WorkerPayloadSchema.safeParse(payloadCandidate);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid worker payload",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 422 }
    );
  }

  const {
    analysis_id,
    profile_url,
    platform,
    instant_json,
  } = parsed.data;

  // ── Guard: skip if already completed ─────────────────────────────────────
  const existing = await getCacheById(analysis_id);
  if (!existing) {
    // Entry was deleted or never created; nothing to do
    return NextResponse.json({ ok: true, skipped: true });
  }
  if (existing.status === "completed") {
    return NextResponse.json({ ok: true, skipped: true, reason: "already_completed" });
  }

  // ── Mark queue as processing ──────────────────────────────────────────────
  await markQueueProcessing(analysis_id);

  // ── Run AI analysis ───────────────────────────────────────────────────────
  try {
    const instant = instant_json as Instant;
    const aiResult = await runAiAnalysis(instant, profile_url);

    if (aiResult.attempt === "retry") {
      console.warn(
        `[Worker] AI analysis for ${analysis_id} required a retry (JSON parse failure on first attempt)`
      );
    }

    // Normalise raw AI output + instant into stable UI contract
    const uiContract = normalizeToUiContract(
      analysis_id,
      instant,
      aiResult.raw
    );

    // Persist to cache
    await updateCacheCompleted(analysis_id, aiResult.raw, uiContract);
    await markQueueCompleted(analysis_id);

    // Emit completion webhook (fire-and-forget)
    emitWebhook({
      event: "analysis.completed",
      analysis_id,
      profile_url,
      platform,
      ui_json: uiContract,
    }).catch((e) =>
      console.warn("[Worker] webhook analysis.completed failed:", e)
    );

    return NextResponse.json({
      ok: true,
      analysis_id,
      tokens_used: aiResult.tokensUsed,
      model: aiResult.model,
      attempt: aiResult.attempt,
    });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown AI analysis error";
    console.error(`[Worker] AI analysis failed for ${analysis_id}:`, err);

    await updateCacheFailed(analysis_id, errorMessage);
    await markQueueFailed(analysis_id);

    emitWebhook({
      event: "analysis.failed",
      analysis_id,
      profile_url,
      platform,
      error: errorMessage,
    }).catch((e) =>
      console.warn("[Worker] webhook analysis.failed failed:", e)
    );

    // Return 200 so the queue does not re-deliver.
    // The failure is captured in the DB and surfaced to the frontend via /status.
    return NextResponse.json({
      ok: false,
      analysis_id,
      error: errorMessage,
    });
  }
}

// ============================================================================
// Webhook emitter
// ============================================================================

async function emitWebhook(payload: {
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
