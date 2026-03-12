/**
 * GET /api/analyzer/status?analysis_id=...
 *
 * Lightweight poll endpoint. Returns current status of an analysis.
 * No auth required.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCacheById } from "@/lib/analyzer/db";

export async function GET(req: NextRequest) {
  const analysisId = req.nextUrl.searchParams.get("analysis_id");

  if (!analysisId) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "analysis_id query param is required" } },
      { status: 400 }
    );
  }

  const entry = await getCacheById(analysisId);

  if (!entry) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Analysis not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    analysis_id: entry.id,
    status: entry.status,
    created_at: null, // not stored individually; omit for now
    expires_at: entry.expires_at,
  });
}
