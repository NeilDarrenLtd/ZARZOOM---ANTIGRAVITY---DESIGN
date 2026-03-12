/**
 * GET /api/analyzer/result?analysis_id=...
 *
 * Returns the canonical AnalysisResult (UI contract) for a completed analysis.
 * - full_report is returned only when the caller is authenticated (claimed_user_id is set).
 * - Unauthenticated callers receive instant + teaser only.
 *
 * No auth is *required* — the endpoint decides what to surface based on auth state.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getCacheById } from "@/lib/analyzer/db";

export async function GET(req: NextRequest) {
  const analysisId = req.nextUrl.searchParams.get("analysis_id");

  if (!analysisId) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "analysis_id query param is required" } },
      { status: 400 }
    );
  }

  // ── Try to resolve the caller's identity (optional) ───────────────────────
  let userId: string | null = null;
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll() {},
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Not fatal — treat as unauthenticated
  }

  // ── Fetch cache entry ─────────────────────────────────────────────────────
  const entry = await getCacheById(analysisId);

  if (!entry) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Analysis not found" } },
      { status: 404 }
    );
  }

  if (entry.status === "pending") {
    return NextResponse.json(
      {
        analysis_id: entry.id,
        status: "pending",
        instant: entry.instant_json,
        teaser: null,
        full_report: null,
      },
      { status: 202 }
    );
  }

  if (entry.status === "failed") {
    return NextResponse.json(
      {
        analysis_id: entry.id,
        status: "failed",
        instant: entry.instant_json,
        teaser: null,
        full_report: null,
      },
      { status: 200 }
    );
  }

  // ── Completed — assemble response ─────────────────────────────────────────
  const uiJson = entry.ui_json;
  if (!uiJson) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Analysis result not available" } },
      { status: 404 }
    );
  }

  // Authenticated (or claimed) users get the full report.
  // Unauthenticated users get instant + teaser only (conversion gate).
  const isAuthenticated = userId !== null;

  return NextResponse.json({
    analysis_id: entry.id,
    status: "completed",
    instant: uiJson.instant,
    teaser: uiJson.teaser,
    full_report: isAuthenticated ? uiJson.full_report : null,
  });
}
