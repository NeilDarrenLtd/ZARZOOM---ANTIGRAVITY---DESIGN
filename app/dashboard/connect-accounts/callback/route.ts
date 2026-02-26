/**
 * app/dashboard/connect-accounts/callback/route.ts
 *
 * Handles the redirect back from the social-connect provider (Upload-Post).
 *
 * Flow:
 *  1. Read `state` query param from the incoming URL.
 *  2. Verify the HMAC-signed state token via verifyState().
 *  3. Compare the token's userId against the currently authenticated user.
 *  4. Redirect to the sanitized returnTo path on success.
 *  5. Redirect to /dashboard on any failure (invalid/expired state, user mismatch).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyState } from "@/lib/upload-post/state";
import { sanitizeReturnTo } from "@/lib/upload-post/returnTo";
import { createClient } from "@/lib/supabase/server";

const FALLBACK = "/dashboard";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const rawState = searchParams.get("state");

  // ── 1. State param must be present ────────────────────────────────
  if (!rawState) {
    return NextResponse.redirect(new URL(FALLBACK, request.url));
  }

  // ── 2. Verify HMAC signature + expiry ─────────────────────────────
  let payload: Awaited<ReturnType<typeof verifyState>>;
  try {
    payload = await verifyState(rawState);
  } catch {
    payload = null;
  }

  if (!payload) {
    return NextResponse.redirect(new URL(FALLBACK, request.url));
  }

  // ── 3. Match token userId against current session ──────────────────
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // If a session exists, the userId in the token must match it.
    // (If no session exists we still fall through — the returnTo page
    //  will handle any auth-gating itself.)
    if (user && user.id !== payload.userId) {
      return NextResponse.redirect(new URL(FALLBACK, request.url));
    }
  } catch {
    // createClient / getUser should not throw in normal operation,
    // but if it does we fall through rather than blocking the redirect.
  }

  // ── 4. Redirect to sanitized returnTo ─────────────────────────────
  // sanitizeReturnTo is called a second time here to guarantee the path
  // embedded in the token is still valid, even if the allow-list changes.
  const destination = sanitizeReturnTo(payload.returnTo);

  return NextResponse.redirect(new URL(destination, request.url));
}
