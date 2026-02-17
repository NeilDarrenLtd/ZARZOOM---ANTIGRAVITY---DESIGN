import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ──────────────────────────────────────────────────────────────────
// GET /api/v1/onboarding/social-connect/status
//
// Returns the current social connection status for the onboarding user.
// Checks Upload-Post API for the profile's connected platforms,
// and updates onboarding_profiles.socials_connected accordingly.
// ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("onboarding_profiles")
      .select("uploadpost_profile_username, socials_connected")
      .eq("user_id", user.id)
      .single();

    if (!profile?.uploadpost_profile_username) {
      return NextResponse.json({
        data: {
          connected: false,
          platforms: [],
          profile_username: null,
        },
      });
    }

    const username = profile.uploadpost_profile_username;
    const baseUrl = process.env.UPLOADPOST_BASE_URL;
    const apiKey = process.env.UPLOADPOST_API_KEY;

    if (!baseUrl || !apiKey) {
      // Demo mode — return current DB state
      return NextResponse.json({
        data: {
          connected: profile.socials_connected ?? false,
          platforms: [],
          profile_username: username,
          demo_mode: true,
        },
      });
    }

    // Query Upload-Post for profile status
    let connected = false;
    let platforms: string[] = [];

    try {
      const cleanBase = baseUrl.replace(/\/+$/, "");
      const res = await fetch(
        `${cleanBase}/profiles/${encodeURIComponent(username)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      if (res.ok) {
        const body = await res.json();
        const profileData = body.data ?? body;
        platforms = Array.isArray(profileData.platforms)
          ? profileData.platforms
          : [];
        connected = platforms.length > 0;
      }
    } catch {
      // If Upload-Post is unreachable, fall back to DB state
      connected = profile.socials_connected ?? false;
    }

    // Persist the connected state back to onboarding_profiles
    if (connected !== profile.socials_connected) {
      await supabase
        .from("onboarding_profiles")
        .update({ socials_connected: connected })
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      data: {
        connected,
        platforms,
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
