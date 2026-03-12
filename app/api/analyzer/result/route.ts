/**
 * GET /api/analyzer/result?analysis_id=<uuid>
 *
 * Returns the full canonical AnalysisResult for a completed analysis.
 * No auth is *required* — the endpoint gates full_report on authentication.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Response contract
 * ──────────────────────────────────────────────────────────────────────────
 *
 * 200 completed (authenticated):
 * {
 *   "analysis_id": "string",
 *   "status": "completed",
 *   "instant": {
 *     "platform_detected": "string",
 *     "keywords_detected": ["string"],
 *     "posting_frequency_estimate": "low" | "medium" | "high" | "unknown",
 *     "creator_score": number,            // 0–100
 *     "strengths": ["string"],
 *     "opportunities": ["string"]
 *   },
 *   "teaser": {
 *     "growth_insights": ["string"],
 *     "ai_post_preview": {
 *       "title": "string",
 *       "caption": "string",
 *       "hashtags": ["string"]
 *     },
 *     "benchmark_text": "string"
 *   },
 *   "full_report": {
 *     "creator_score_explanation": "string",
 *     "content_pillars": ["string"],
 *     "viral_post_ideas": [
 *       { "title": "string", "hook": "string", "description": "string" }
 *     ],
 *     "posting_schedule": {
 *       "posts_per_week": "string",
 *       "best_days": ["string"],
 *       "best_times": ["string"]
 *     },
 *     "growth_insights": ["string"]
 *   }
 * }
 *
 * 200 completed (unauthenticated) — full_report is null (conversion gate):
 * { ..., "full_report": null }
 *
 * 202 pending:
 * { "analysis_id": "string", "status": "pending", "instant": Instant | null,
 *   "teaser": null, "full_report": null }
 *
 * 200 failed — safe fallback (never exposes internals):
 * { "analysis_id": "string", "status": "failed",
 *   "instant": Instant | null, "teaser": null, "full_report": null }
 *
 * 400  { error: { code: "BAD_REQUEST",   message: string } }
 * 404  { error: { code: "NOT_FOUND",     message: string } }
 * 500  { error: { code: "SERVER_ERROR",  message: string } }
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Frontend polling + result fetch example
 * ──────────────────────────────────────────────────────────────────────────
 *
 * async function waitForResult(analysisId: string) {
 *   const MAX_POLLS  = 60;          // 60 × 2 s = 2 min
 *   const INTERVAL   = 2_000;
 *
 *   for (let i = 0; i < MAX_POLLS; i++) {
 *     const statusRes  = await fetch(`/api/analyzer/status?analysis_id=${analysisId}`);
 *     const { status } = await statusRes.json();
 *
 *     if (status === "completed" || status === "failed") {
 *       const resultRes = await fetch(`/api/analyzer/result?analysis_id=${analysisId}`);
 *       return resultRes.json();
 *     }
 *
 *     await new Promise(r => setTimeout(r, INTERVAL));
 *   }
 *
 *   throw new Error("Analysis timed out");
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getCacheById } from "@/lib/analyzer/db";
import type { Instant, Teaser, FullReport } from "@/lib/analyzer/types";

const ANALYSIS_ID_RE = /^[a-zA-Z0-9_-]{10,40}$/;

// ── Safe fallback shapes returned when data is missing ────────────────────────

const FALLBACK_INSTANT: Instant = {
  platform_detected: "unknown",
  keywords_detected: [],
  posting_frequency_estimate: "unknown",
  creator_score: 0,
  strengths: [],
  opportunities: ["We were unable to analyse this profile. Please try again."],
};

const FALLBACK_TEASER: Teaser = {
  growth_insights: [],
  ai_post_preview: {
    title: "",
    caption: "",
    hashtags: [],
  },
  benchmark_text: "",
};

// ── Helper: resolve authenticated user from request cookies (optional) ────────

async function resolveUserId(req: NextRequest): Promise<string | null> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: () => {},
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Query validation ───────────────────────────────────────────────────────
  const analysisId = req.nextUrl.searchParams.get("analysis_id")?.trim();

  if (!analysisId) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "analysis_id query param is required" } },
      { status: 400 }
    );
  }

  if (!ANALYSIS_ID_RE.test(analysisId)) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "analysis_id format is invalid" } },
      { status: 400 }
    );
  }

  // ── Resolve auth (non-blocking) ────────────────────────────────────────────
  const userId = await resolveUserId(req);
  const isAuthenticated = userId !== null;

  // ── DB lookup ──────────────────────────────────────────────────────────────
  let entry;
  try {
    entry = await getCacheById(analysisId);
  } catch (err) {
    console.error("[analyzer/result] DB error:", err);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to read analysis result" } },
      { status: 500 }
    );
  }

  if (!entry) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Analysis not found" } },
      { status: 404 }
    );
  }

  // ── Pending ────────────────────────────────────────────────────────────────
  if (entry.status === "pending") {
    return NextResponse.json(
      {
        analysis_id: entry.id,
        status: "pending" as const,
        instant: entry.instant_json ?? null,
        teaser: null,
        full_report: null,
      },
      { status: 202, headers: { "Cache-Control": "no-store" } }
    );
  }

  // ── Failed — safe fallback, never expose internals ────────────────────────
  if (entry.status === "failed") {
    return NextResponse.json(
      {
        analysis_id: entry.id,
        status: "failed" as const,
        instant: entry.instant_json ?? FALLBACK_INSTANT,
        teaser: null,
        full_report: null,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  // ── Completed ──────────────────────────────────────────────────────────────
  const ui = entry.ui_json;

  if (!ui) {
    // Completed row but ui_json not yet written — treat as pending
    return NextResponse.json(
      {
        analysis_id: entry.id,
        status: "pending" as const,
        instant: entry.instant_json ?? null,
        teaser: null,
        full_report: null,
      },
      { status: 202, headers: { "Cache-Control": "no-store" } }
    );
  }

  const instant: Instant = ui.instant ?? FALLBACK_INSTANT;
  const teaser: Teaser    = ui.teaser  ?? FALLBACK_TEASER;
  const fullReport: FullReport | null = isAuthenticated
    ? (ui.full_report ?? null)
    : null;

  return NextResponse.json(
    {
      analysis_id: entry.id,
      status: "completed" as const,
      instant,
      teaser,
      full_report: fullReport,
    },
    {
      status: 200,
      headers: {
        // Allow short-lived CDN caching for completed results (they are immutable)
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    }
  );
}
