/**
 * GET /api/analyzer/status?analysis_id=<uuid>
 *
 * Lightweight poll endpoint — no auth required.
 * Designed to be called every 1–2 s until status is "completed" or "failed".
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Response contract
 * ──────────────────────────────────────────────────────────────────────────
 * 200  { analysis_id, status: "pending" | "completed" | "failed" }
 * 400  { error: { code: "BAD_REQUEST",   message: string } }
 * 404  { error: { code: "NOT_FOUND",     message: string } }
 * 500  { error: { code: "SERVER_ERROR",  message: string } }
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Frontend polling example
 * ──────────────────────────────────────────────────────────────────────────
 *
 * async function pollStatus(analysisId: string): Promise<"completed" | "failed"> {
 *   const MAX_POLLS = 60;          // 60 × 2 s = 2 min max
 *   const INTERVAL_MS = 2_000;
 *
 *   for (let i = 0; i < MAX_POLLS; i++) {
 *     const res  = await fetch(`/api/analyzer/status?analysis_id=${analysisId}`);
 *     const json = await res.json();
 *
 *     if (json.status === "completed" || json.status === "failed") {
 *       return json.status;
 *     }
 *
 *     await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
 *   }
 *
 *   return "failed"; // treat timeout as failure
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCacheById } from "@/lib/analyzer/db";

// Regex that accepts UUID v4 or the nanoid-style ids we generate (21 url-safe chars)
const ANALYSIS_ID_RE = /^[a-zA-Z0-9_-]{10,40}$/;

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

  // ── DB lookup ──────────────────────────────────────────────────────────────
  let entry;
  try {
    entry = await getCacheById(analysisId);
  } catch (err) {
    console.error("[analyzer/status] DB error:", err);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to read analysis status" } },
      { status: 500 }
    );
  }

  if (!entry) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Analysis not found" } },
      { status: 404 }
    );
  }

  // ── Response ───────────────────────────────────────────────────────────────
  return NextResponse.json(
    { analysis_id: entry.id, status: entry.status },
    {
      status: 200,
      headers: {
        // Prevent stale status from being cached by browsers / CDN
        "Cache-Control": "no-store",
      },
    }
  );
}
