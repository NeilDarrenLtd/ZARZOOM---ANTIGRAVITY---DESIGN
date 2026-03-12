/**
 * POST /api/analyzer/fallback-notify
 *
 * Internal worker endpoint. Called by a cron job or queue processor to:
 *   1. Dequeue pending fallback rows that have an email address
 *   2. Send the "Your ZARZOOM Social Growth Report is Ready" email
 *   3. Mark rows as completed (or failed)
 *
 * Protected by ANALYZER_WORKER_SECRET — not callable by the public.
 *
 * Query params:
 *   batch_size  — number of rows to process per call (default 10, max 50)
 *
 * Response 200:
 *   { processed: number; sent: number; failed: number; skipped: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendFallbackEmail } from "@/lib/analyzer/fallbackEmail";

const DEFAULT_BATCH = 10;
const MAX_BATCH = 50;

export async function POST(req: NextRequest) {
  // ── Auth guard ──────────────────────────────────────────────────────────
  const secret = process.env.ANALYZER_WORKER_SECRET;
  const authHeader = req.headers.get("authorization");

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Batch size ──────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const rawBatch = parseInt(searchParams.get("batch_size") ?? String(DEFAULT_BATCH), 10);
  const batchSize = Math.min(MAX_BATCH, Math.max(1, isNaN(rawBatch) ? DEFAULT_BATCH : rawBatch));

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://zarzoom.com";

  const supabase = await createAdminClient();

  // ── Claim a batch of pending fallback rows ──────────────────────────────
  // Mark as 'processing' atomically to avoid duplicate sends across concurrent
  // worker calls.
  const { data: rows, error: fetchErr } = await supabase
    .from("analysis_queue")
    .select("id, profile_url, email, payload_json")
    .eq("is_fallback", true)
    .eq("status", "pending")
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (fetchErr) {
    console.error("[fallback-notify] Failed to fetch rows:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, failed: 0, skipped: 0 });
  }

  const ids = rows.map((r: { id: string }) => r.id);

  // Mark as processing
  await supabase
    .from("analysis_queue")
    .update({ status: "processing" })
    .in("id", ids);

  // ── Process each row ────────────────────────────────────────────────────
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows as Array<{
    id: string;
    profile_url: string;
    email: string | null;
    payload_json: Record<string, unknown>;
  }>) {
    if (!row.email) {
      // No email — mark completed (skipped) so it doesn't re-queue
      await supabase
        .from("analysis_queue")
        .update({ status: "completed" })
        .eq("id", row.id);
      skipped += 1;
      continue;
    }

    // Look for a related analysis_cache row by profile_url
    const { data: cache } = await supabase
      .from("analysis_cache")
      .select("id, status")
      .eq("profile_url", row.profile_url)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const result = await sendFallbackEmail({
      to: row.email,
      profile_url: row.profile_url,
      analysis_id: cache?.id ?? null,
      base_url: baseUrl,
    });

    if (result.success) {
      await supabase
        .from("analysis_queue")
        .update({ status: "completed" })
        .eq("id", row.id);
      sent += 1;
    } else {
      console.error(`[fallback-notify] Email send failed for ${row.id}:`, result.error);
      await supabase
        .from("analysis_queue")
        .update({ status: "failed" })
        .eq("id", row.id);
      failed += 1;
    }
  }

  return NextResponse.json({
    processed: rows.length,
    sent,
    failed,
    skipped,
  });
}

// GET — health check / dry-run count
export async function GET(req: NextRequest) {
  const secret = process.env.ANALYZER_WORKER_SECRET;
  const authHeader = req.headers.get("authorization");

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createAdminClient();

  const { count, error } = await supabase
    .from("analysis_queue")
    .select("id", { count: "exact", head: true })
    .eq("is_fallback", true)
    .eq("status", "pending")
    .not("email", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pending_with_email: count ?? 0 });
}
