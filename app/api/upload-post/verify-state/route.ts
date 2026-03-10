import { NextRequest, NextResponse } from "next/server";
import { verifyState } from "@/lib/upload-post/state";
import { sanitizeReturnTo } from "@/lib/upload-post/returnTo";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/upload-post/verify-state
 * Body: { state: string }
 *
 * Verifies the HMAC-signed state token from the Upload-Post redirect.
 * Optionally checks the token's userId against the current session.
 *
 * Returns: { success: true, returnTo: string }
 *       or { success: false, error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { state } = body as { state?: string };

    if (!state || typeof state !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing state parameter" },
        { status: 400 }
      );
    }

    // 1. Verify HMAC + expiry
    const payload = await verifyState(state);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired state token" },
        { status: 401 }
      );
    }

    // 2. Optionally bind to the current session user (if a session exists)
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && user.id !== payload.userId) {
        return NextResponse.json(
          { success: false, error: "Session user does not match token" },
          { status: 403 }
        );
      }
    } catch {
      // If we can't check the session, proceed — the HMAC is sufficient
    }

    // 3. Return sanitized returnTo and workspace context
    const returnTo = sanitizeReturnTo(payload.returnTo);

    return NextResponse.json({
      success: true,
      returnTo,
      tenantId: payload.tenantId ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
