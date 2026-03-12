/**
 * POST /api/analyzer/claim
 *
 * Assigns a completed (or pending) analysis to the currently authenticated user.
 * Called from the auth callback immediately after a new account is confirmed.
 *
 * Body: { analysis_id: string }
 *
 * Security:
 *  - Requires a valid Supabase session cookie (createClient reads it).
 *  - Uses the service-role admin client to bypass RLS for the UPDATE so the
 *    route works even before the user's session cookie is fully propagated.
 *  - Only claims if claimed_user_id IS NULL (first-come, first-served; prevents
 *    one user hijacking another user's analysis by guessing a UUID).
 *  - Returns 200 even when the row is already claimed by the same user (idempotent).
 *  - Returns 409 when the row is already claimed by a DIFFERENT user.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminSupa } from "@supabase/supabase-js";

const ANALYSIS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  analysis_id: z
    .string()
    .refine((v) => ANALYSIS_ID_RE.test(v), { message: "Invalid analysis_id" }),
});

function getAdmin() {
  return createAdminSupa(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  // 1. Authenticate
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validate body
  let analysisId: string;
  try {
    const body = await req.json();
    ({ analysis_id: analysisId } = BodySchema.parse(body));
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const admin = getAdmin();

  // 3. Read current claimed_user_id from analysis_cache
  const { data: row, error: readErr } = await admin
    .from("analysis_cache")
    .select("id, claimed_user_id, status")
    .eq("id", analysisId)
    .maybeSingle();

  if (readErr || !row) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  // 4. Guard: already claimed by a different user
  if (row.claimed_user_id && row.claimed_user_id !== user.id) {
    return NextResponse.json(
      { error: "Analysis already claimed by another account" },
      { status: 409 }
    );
  }

  // 5. Idempotent: already claimed by this user
  if (row.claimed_user_id === user.id) {
    return NextResponse.json({ ok: true, claimed: false, already_owned: true });
  }

  // 6. Claim both tables in parallel
  const [cacheResult, queueResult] = await Promise.allSettled([
    admin
      .from("analysis_cache")
      .update({ claimed_user_id: user.id })
      .eq("id", analysisId)
      .is("claimed_user_id", null),
    admin
      .from("analysis_queue")
      .update({ claimed_user_id: user.id })
      .eq("id", analysisId)
      .is("claimed_user_id", null),
  ]);

  if (cacheResult.status === "rejected") {
    console.error("[Claim] Failed to update analysis_cache:", cacheResult.reason);
    return NextResponse.json({ error: "Claim failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    claimed: true,
    analysis_id: analysisId,
    status: row.status,
  });
}
