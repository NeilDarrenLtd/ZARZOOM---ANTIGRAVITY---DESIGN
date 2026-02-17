import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ──────────────────────────────────────────────────────────────────
// POST /api/v1/onboarding/social-connect
//
// Onboarding-scoped endpoint that:
//   1. Derives a deterministic Upload-Post username from user_id
//   2. Persists it to onboarding_profiles.uploadpost_profile_username
//   3. Calls Upload-Post to create the profile (if not already created)
//   4. Calls Upload-Post to generate a JWT connect URL
//   5. Returns { connect_url, profile_username }
//
// If Upload-Post env vars are missing, returns a fallback connect_url
// so the UI can still render the modal in demo / staging mode.
// ──────────────────────────────────────────────────────────────────

function deriveUsername(userId: string): string {
  // Deterministic: "u_" + first 8 chars of the UUID (hyphens stripped)
  return `u_${userId.replace(/-/g, "").slice(0, 8)}`;
}

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Derive or reuse existing username
    const { data: profile } = await supabase
      .from("onboarding_profiles")
      .select("uploadpost_profile_username")
      .eq("user_id", user.id)
      .single();

    const username =
      profile?.uploadpost_profile_username || deriveUsername(user.id);

    // 2. Persist username to onboarding_profiles (if not already set)
    if (!profile?.uploadpost_profile_username) {
      await supabase
        .from("onboarding_profiles")
        .update({ uploadpost_profile_username: username })
        .eq("user_id", user.id);
    }

    // 3. Attempt Upload-Post API calls (gracefully degrade if not configured)
    const baseUrl = process.env.UPLOADPOST_BASE_URL;
    const apiKey = process.env.UPLOADPOST_API_KEY;

    if (!baseUrl || !apiKey) {
      // Return a demo/staging fallback so the modal can still render
      return NextResponse.json({
        data: {
          connect_url: null,
          profile_username: username,
          demo_mode: true,
          message:
            "Upload-Post is not configured. Social connection will be available once provider keys are set.",
        },
      });
    }

    const cleanBase = baseUrl.replace(/\/+$/, "");
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // 3a. Ensure the profile exists on Upload-Post
    try {
      await fetch(`${cleanBase}/profiles`, {
        method: "POST",
        headers,
        body: JSON.stringify({ profile_username: username }),
      });
      // Ignore 409 (already exists) — that's fine
    } catch {
      // Upload-Post create failed — continue anyway, connect may still work
    }

    // 3b. Generate a connect URL
    let connectUrl: string | null = null;

    try {
      const connectRes = await fetch(
        `${cleanBase}/profiles/${encodeURIComponent(username)}/connect`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/onboarding?connected=1`,
          }),
        }
      );

      if (connectRes.ok) {
        const connectBody = await connectRes.json();
        connectUrl =
          connectBody.connect_url ??
          connectBody.data?.connect_url ??
          null;
      }
    } catch {
      // connect URL generation failed
    }

    return NextResponse.json({
      data: {
        connect_url: connectUrl,
        profile_username: username,
        demo_mode: false,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
