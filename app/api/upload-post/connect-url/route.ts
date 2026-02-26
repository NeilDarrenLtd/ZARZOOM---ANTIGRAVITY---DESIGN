import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getBaseUrl, getUploadPostUiConfig } from "@/lib/upload-post/config";
import { createState } from "@/lib/upload-post/state";
import { sanitizeReturnTo } from "@/lib/upload-post/returnTo";

const UPLOAD_POST_API_BASE =
  (process.env.UPLOAD_POST_BASE_URL || "https://app.upload-post.com") +
  "/api/uploadposts";

function jsonError(status: number, message: string, requestId: string) {
  return NextResponse.json(
    { error: { code: "ERROR", message, requestId } },
    { status, headers: { "X-Request-Id": requestId } }
  );
}

/**
 * GET /api/upload-post/connect-url
 *
 * Returns an Upload-Post accessUrl for the authenticated user.
 * SECURITY: Never exposes the API key to the browser.
 */
export async function GET(req: NextRequest) {
  const requestId =
    req.headers.get("x-request-id") ?? crypto.randomUUID();

  console.log("[v0] [connect-url] ROUTE HIT", requestId);

  try {
    // ── 1. Authenticate ──────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    console.log("[v0] [connect-url] auth result:", user?.id ?? "NO USER", userError?.message ?? "ok");

    if (userError || !user) {
      return jsonError(401, "Authentication required", requestId);
    }

    // ── 2. Resolve API key (DB → env fallback) ──────────────────────────
    const admin = await createAdminClient();

    // Ensure singleton row
    await admin
      .from("app_settings")
      .upsert({ id: 1 }, { onConflict: "id", ignoreDuplicates: true });

    const { data: settings, error: settingsErr } = await admin
      .from("app_settings")
      .select("upload_post_api_key")
      .eq("id", 1)
      .maybeSingle();

    console.log("[v0] [connect-url] settings:", settings ? "found" : "null", "err:", settingsErr?.message ?? "none");

    const apiKey =
      settings?.upload_post_api_key?.trim() ||
      process.env.UPLOAD_POST_API_KEY?.trim() ||
      null;

    console.log("[v0] [connect-url] apiKey:", apiKey ? `yes (${apiKey.length} chars)` : "MISSING");

    if (!apiKey) {
      return jsonError(
        500,
        "Social connector is not configured. Ask an admin to add the API key in Admin > Social Connector.",
        requestId
      );
    }

    // ── 3. Ensure Upload-Post user exists ────────────────────────────────
    const ensureUrl = `${UPLOAD_POST_API_BASE}/users`;
    console.log("[v0] [connect-url] POST", ensureUrl, "username:", user.id);

    const ensureRes = await fetch(ensureUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${apiKey}`,
      },
      body: JSON.stringify({ username: user.id }),
    });

    const ensureText = await ensureRes.text().catch(() => "");
    console.log("[v0] [connect-url] ensure-user:", ensureRes.status, ensureText.slice(0, 300));

    // 409 = already exists → success
    if (!ensureRes.ok && ensureRes.status !== 409) {
      return jsonError(
        502,
        `Social provider returned ${ensureRes.status}: ${ensureText.slice(0, 200)}`,
        requestId
      );
    }

    // ── 4. Build signed state token ──────────────────────────────────────
    const rawReturnTo = req.nextUrl.searchParams.get("returnTo") ?? "/dashboard";
    const returnTo = sanitizeReturnTo(rawReturnTo);

    let state: string;
    try {
      state = await createState({ returnTo, userId: user.id });
    } catch (stateErr) {
      const msg = stateErr instanceof Error ? stateErr.message : String(stateErr);
      console.error("[v0] [connect-url] createState failed:", msg);
      return jsonError(500, `State token error: ${msg}`, requestId);
    }

    // ── 5. Build redirect URL ────────────────────────────────────────────
    const baseUrl = getBaseUrl();
    const redirectUrl = `${baseUrl}/integrations/upload-post/return?state=${encodeURIComponent(state)}`;

    // ── 6. Fetch Upload-Post JWT / accessUrl ─────────────────────────────
    const uiConfig = getUploadPostUiConfig();

    const jwtPayload: Record<string, unknown> = {
      username: user.id,
      redirect_url: redirectUrl,
      show_calendar: true,
    };

    if (uiConfig.logoUrl) jwtPayload.logo_image = uiConfig.logoUrl;
    if (uiConfig.connectTitle) jwtPayload.connect_title = uiConfig.connectTitle;
    if (uiConfig.connectDescription)
      jwtPayload.connect_description = uiConfig.connectDescription;
    if (uiConfig.redirectButtonText)
      jwtPayload.redirect_button_text = uiConfig.redirectButtonText;
    if (uiConfig.defaultPlatforms?.length)
      jwtPayload.platforms = uiConfig.defaultPlatforms;

    console.log("[v0] [connect-url] POST generate-jwt, payload keys:", Object.keys(jwtPayload));

    const jwtRes = await fetch(`${UPLOAD_POST_API_BASE}/users/generate-jwt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${apiKey}`,
      },
      body: JSON.stringify(jwtPayload),
    });

    const jwtText = await jwtRes.text().catch(() => "");
    console.log("[v0] [connect-url] generate-jwt:", jwtRes.status, jwtText.slice(0, 300));

    if (!jwtRes.ok) {
      return jsonError(502, `JWT generation failed (${jwtRes.status}): ${jwtText.slice(0, 200)}`, requestId);
    }

    let jwtData: Record<string, unknown>;
    try {
      jwtData = JSON.parse(jwtText);
    } catch {
      return jsonError(502, "Invalid JSON from social provider", requestId);
    }

    const accessUrl =
      (jwtData.accessUrl as string) ?? (jwtData.access_url as string);

    if (!accessUrl) {
      return jsonError(502, "No accessUrl in provider response", requestId);
    }

    // ── 7. Upsert audit trail (non-fatal) ────────────────────────────────
    admin
      .from("upload_post_mapping")
      .upsert(
        {
          user_id: user.id,
          upload_post_username: user.id,
          last_connect_url_generated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .then(({ error: e }) => {
        if (e) console.warn("[v0] [connect-url] mapping upsert failed:", e.message);
      });

    // ── 8. Return ────────────────────────────────────────────────────────
    console.log("[v0] [connect-url] SUCCESS — returning accessUrl");
    return NextResponse.json(
      { accessUrl },
      { status: 200, headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    console.error("[v0] [connect-url] UNCAUGHT:", msg, stack);
    return jsonError(500, `Unexpected: ${msg}`, requestId);
  }
}
