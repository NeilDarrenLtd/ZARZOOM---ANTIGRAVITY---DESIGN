import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/logging/activity";

/**
 * POST /api/analyzer/log
 *
 * Lightweight endpoint used by the public homepage analyzer UI to write
 * structured "analyzer.ui.*" events into the shared activity_logs table.
 *
 * This route is deliberately permissive (no auth) but only accepts a narrow,
 * validated payload and always records category="analyzer" with source="frontend".
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const stage = typeof body.stage === "string" ? body.stage : null;
    if (!stage) {
      return NextResponse.json(
        { error: "stage is required" },
        { status: 400 }
      );
    }

    const levelRaw = typeof body.level === "string" ? body.level : "info";
    const level = (["info", "warn", "error"] as const).includes(
      levelRaw as typeof levelRaw & ("info" | "warn" | "error")
    )
      ? (levelRaw as "info" | "warn" | "error")
      : "info";

    const analysisId =
      typeof body.analysis_id === "string" ? body.analysis_id : null;
    const sessionId =
      typeof body.session_id === "string" ? body.session_id : null;
    const profileUrl =
      typeof body.profile_url === "string" ? body.profile_url : null;
    const platform =
      typeof body.platform === "string" ? body.platform : null;

    const details =
      body.details && typeof body.details === "object"
        ? (body.details as Record<string, unknown>)
        : null;

    await logActivity({
      category: "analyzer",
      stage,
      level,
      analysisId,
      sessionId,
      profileUrl,
      platform,
      source: "frontend",
      details,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[analyzer/log] Failed to record UI log", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to record analyzer log",
      },
      { status: 500 }
    );
  }
}

