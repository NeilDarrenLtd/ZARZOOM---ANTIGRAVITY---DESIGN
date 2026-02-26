import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/api/env";
import { getRequestId } from "@/lib/api/request-id";
import {
  unauthorized,
  serverError,
} from "@/lib/api/http-responses";
import { getBaseUrl, getUploadPostUiConfig } from "@/lib/upload-post/config";
import { createState } from "@/lib/upload-post/state";

const UPLOAD_POST_API_BASE = "https://api.upload-post.com/api/uploadposts";

/**
 * GET /api/upload-post/connect-url
 *
 * Returns an Upload-Post accessUrl for the authenticated user.
 *
 * Query params:
 *   returnTo  – internal path to redirect after connecting (optional, defaults to /dashboard)
 *   state     – pre-built state token (optional; if absent one is generated)
 *
 * Response: { accessUrl: string }
 *
 * SECURITY: Never exposes the API key to the browser.
 */
export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  console.log(`[v0] [connect-url] === ROUTE ENTERED === requestId=${requestId}`);

  try {
    // ── 1. Authenticate the Supabase user ────────────────────────────────
    const cookieStore = await cookies();
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = env();

    const supabase = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Read-only in Route Handler context — safe to ignore
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return unauthorized(requestId, "Authentication required");
    }

    // ── 2. Resolve the API key: DB row → env fallback ────────────────────
    const { createClient: createSupabaseRaw } = await import("@supabase/supabase-js");
    const admin = createSupabaseRaw(
      NEXT_PUBLIC_SUPABASE_URL,
      env().SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Ensure the singleton row exists before reading
    await admin
      .from("app_settings")
      .upsert({ id: 1 }, { onConflict: "id", ignoreDuplicates: true });

    const { data: settings, error: settingsErr } = await admin
      .from("app_settings")
      .select("upload_post_api_key")
      .eq("id", 1)
      .maybeSingle();

    console.log(`[v0] [connect-url] settings query: data=${JSON.stringify(settings)}, error=${settingsErr?.message ?? "none"}`);

    const apiKey =
      settings?.upload_post_api_key?.trim() ||
      process.env.UPLOAD_POST_API_KEY?.trim() ||
      null;

    console.log(`[v0] [connect-url] apiKey resolved: ${apiKey ? "yes (length=" + apiKey.length + ")" : "NO"}`);

    if (!apiKey) {
      return NextResponse.json(
        { error: { code: "NOT_CONFIGURED", message: "Social connector is not configured. Please ask an administrator to add the API key in Admin > Social Connector.", requestId } },
        { status: 500, headers: { "X-Request-Id": requestId } }
      );
    }

    // ── 3. Ensure the Upload-Post user exists (idempotent) ───────────────
    console.log(`[v0] [connect-url] Calling ensure-user: POST ${UPLOAD_POST_API_BASE}/users with username=${user.id}`);
    const ensureRes = await fetch(`${UPLOAD_POST_API_BASE}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ username: user.id }),
    });

    const ensureBody = await ensureRes.text().catch(() => "");
    console.log(`[v0] [connect-url] ensure-user response: status=${ensureRes.status} body=${ensureBody}`);

    // 409 Conflict = user already exists — treat as success
    if (!ensureRes.ok && ensureRes.status !== 409) {
      return serverError(requestId, `Failed to initialise social account (status: ${ensureRes.status})`);
    }

    // ── 4. Build the signed state token ─────────────────────────────────
    const returnTo =
      req.nextUrl.searchParams.get("returnTo") ?? "/dashboard";

    const state = await createState({ returnTo, userId: user.id });

    // ── 5. Build redirect_url ────────────────────────────────────────────
    const baseUrl = getBaseUrl();
    const redirectUrl = `${baseUrl}/dashboard/connect-accounts/callback?state=${encodeURIComponent(state)}`;

    // ── 6. Fetch the Upload-Post JWT / accessUrl ─────────────────────────
    const uiConfig = getUploadPostUiConfig();

    const jwtPayload: Record<string, unknown> = {
      username: user.id,
      redirect_url: redirectUrl,
      show_calendar: true,
    };

    if (uiConfig.logoUrl) jwtPayload.logo_image = uiConfig.logoUrl;
    if (uiConfig.connectTitle) jwtPayload.connect_title = uiConfig.connectTitle;
    if (uiConfig.connectDescription) jwtPayload.connect_description = uiConfig.connectDescription;
    if (uiConfig.redirectButtonText) jwtPayload.redirect_button_text = uiConfig.redirectButtonText;
    if (uiConfig.defaultPlatforms?.length) jwtPayload.platforms = uiConfig.defaultPlatforms;

    const jwtRes = await fetch(
      `${UPLOAD_POST_API_BASE}/users/generate-jwt`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(jwtPayload),
      }
    );

    if (!jwtRes.ok) {
      const body = await jwtRes.text().catch(() => "");
      console.error(
        `[connect-url] generate-jwt failed (${jwtRes.status}):`,
        body
      );
      return serverError(requestId, "Failed to generate social connect URL");
    }

    const jwtData = (await jwtRes.json()) as { accessUrl?: string; access_url?: string };
    const accessUrl = jwtData.accessUrl ?? jwtData.access_url;

    if (!accessUrl) {
      console.error("[connect-url] No accessUrl in generate-jwt response:", jwtData);
      return serverError(requestId, "Invalid response from social connect provider");
    }

    // ── 7. Upsert audit trail ───────────────────────────────────────────
    await admin
      .from("upload_post_mapping")
      .upsert(
        {
          user_id: user.id,
          upload_post_username: user.id,
          last_connect_url_generated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .then(({ error: upsertErr }) => {
        if (upsertErr) {
          // Non-fatal — log but don't block the user
          console.warn(`[connect-url] Mapping upsert failed (${requestId}):`, upsertErr.message);
        }
      });

    // ── 8. Return to client ──────────────────────────────────────────────
    return NextResponse.json(
      { accessUrl },
      { status: 200, headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : "";
    console.error(`[v0] [connect-url] CATCH error (${requestId}): ${errMsg}`);
    console.error(`[v0] [connect-url] Stack: ${errStack}`);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: `Unexpected error: ${errMsg}`, requestId } },
      { status: 500, headers: { "X-Request-Id": requestId } }
    );
  }
}
