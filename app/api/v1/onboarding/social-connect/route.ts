import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePlanForTenant } from "@/lib/billing/entitlements";
import { deriveWorkspaceUploadPostUsername } from "@/lib/upload-post/identity";

// ──────────────────────────────────────────────────────────────────
// POST /api/v1/onboarding/social-connect
//
// Onboarding-scoped endpoint that:
//   1. Derives a deterministic Upload-Post username from workspace/tenant ID
//   2. Persists it to onboarding_profiles.uploadpost_profile_username
//   3. Calls Upload-Post to create the profile (if not already created)
//   4. Calls Upload-Post to generate a JWT connect URL
//   5. Returns { connect_url, profile_username }
//
// If Upload-Post env vars are missing, returns a fallback connect_url
// so the UI can still render the modal in demo / staging mode.
// ──────────────────────────────────────────────────────────────────

async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  request: NextRequest
): Promise<string | null> {
  const tenantId = request.headers.get("x-tenant-id")?.trim();
  if (!tenantId) return null;
  const { data } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.tenant_id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = await resolveTenantId(supabase, user.id, request);
    if (!tenantId) {
      return NextResponse.json(
        { error: "Workspace context required. Send X-Tenant-Id header." },
        { status: 400 }
      );
    }

    const plan = await getEffectivePlanForTenant(tenantId);
    if (plan.subscriptionStatus !== "active" && plan.subscriptionStatus !== "trialing") {
      return NextResponse.json(
        {
          error:
            "Subscription required to connect social accounts for this workspace. Choose a plan to continue.",
        },
        { status: 402 }
      );
    }

    // 1. Derive workspace-scoped username (or reuse if already stored and matches)
    const { data: profile } = await supabase
      .from("onboarding_profiles")
      .select("uploadpost_profile_username")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const workspaceUsername = deriveWorkspaceUploadPostUsername(tenantId);
    const username =
      profile?.uploadpost_profile_username === workspaceUsername
        ? profile.uploadpost_profile_username
        : workspaceUsername;

    // 2. Persist workspace-scoped username (update if stale or missing)
    if (profile?.uploadpost_profile_username !== username) {
      await supabase
        .from("onboarding_profiles")
        .update({ uploadpost_profile_username: username })
        .eq("tenant_id", tenantId);
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
      Authorization: `ApiKey ${apiKey}`,
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
