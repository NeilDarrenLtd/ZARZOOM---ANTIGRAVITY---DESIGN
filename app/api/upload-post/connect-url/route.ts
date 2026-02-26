import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getBaseUrl, getUploadPostUiConfig } from "@/lib/upload-post/config";
import { createState } from "@/lib/upload-post/state";
import { sanitizeReturnTo } from "@/lib/upload-post/returnTo";

const UPLOAD_POST_API_BASE =
  (process.env.UPLOAD_POST_BASE_URL || "https://api.upload-post.com") +
  "/api/uploadposts";

const upDebug = process.env.UPLOAD_POST_DEBUG === "true";

function upLog(...args: unknown[]) {
  if (upDebug) console.log("[upload-post]", ...args);
}
function upWarn(...args: unknown[]) {
  if (upDebug) console.warn("[upload-post]", ...args);
}
function upError(...args: unknown[]) {
  // errors always surface regardless of flag
  console.error("[upload-post]", ...args);
}

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

  upLog(`base_url=${UPLOAD_POST_API_BASE} requestId=${requestId}`);

  try {
    // ── 1. Authenticate ──────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

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

    if (settingsErr) upWarn("settings query error:", settingsErr.message);

    const apiKey =
      settings?.upload_post_api_key?.trim() ||
      process.env.UPLOAD_POST_API_KEY?.trim() ||
      null;

    upLog(`api_key_source=${settings?.upload_post_api_key?.trim() ? "db" : "env"} present=${!!apiKey}`);

    if (!apiKey) {
      return jsonError(
        500,
        "Social connector is not configured. Ask an admin to add the API key in Admin > Social Connector.",
        requestId
      );
    }

    // ── 3. Ensure Upload-Post user exists ────────────────────────────────
    const ensureUrl = `${UPLOAD_POST_API_BASE}/users`;
    upLog(`request op=create-user method=POST url=${ensureUrl}`);

    const ensureRes = await fetch(ensureUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${apiKey}`,
      },
      body: JSON.stringify({ username: user.id }),
    });

    upLog(
      `response op=create-user status=${ensureRes.status} content-type=${ensureRes.headers.get("content-type") ?? "unknown"}`
    );

    if (!ensureRes.ok && ensureRes.status !== 409) {
      const body = await ensureRes.text().catch(() => "");
      upError(
        `non-2xx op=create-user status=${ensureRes.status} body=${body.slice(0, 200)}`
      );
      return jsonError(
        502,
        `Social provider returned ${ensureRes.status}: ${body.slice(0, 200)}`,
        requestId
      );
    } else {
      // consume body to free connection
      await ensureRes.text().catch(() => "");
    }

    // ── 4. Build signed state token ──────────────────────────────────────
    const rawReturnTo = req.nextUrl.searchParams.get("returnTo") ?? "/dashboard";
    const returnTo = sanitizeReturnTo(rawReturnTo);

    let state: string;
    try {
      state = await createState({ returnTo, userId: user.id });
    } catch (stateErr) {
      const msg = stateErr instanceof Error ? stateErr.message : String(stateErr);
      upError("createState failed:", msg);
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

    const jwtUrl = `${UPLOAD_POST_API_BASE}/users/generate-jwt`;
    upLog(`request op=generate-jwt method=POST url=${jwtUrl} payload_keys=${Object.keys(jwtPayload).join(",")}`);

    const jwtRes = await fetch(jwtUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${apiKey}`,
      },
      body: JSON.stringify(jwtPayload),
    });

    upLog(
      `response op=generate-jwt status=${jwtRes.status} content-type=${jwtRes.headers.get("content-type") ?? "unknown"}`
    );

    const jwtText = await jwtRes.text().catch(() => "");

    if (!jwtRes.ok) {
      upError(
        `non-2xx op=generate-jwt status=${jwtRes.status} body=${jwtText.slice(0, 200)}`
      );
      return jsonError(502, `JWT generation failed (${jwtRes.status}): ${jwtText.slice(0, 200)}`, requestId);
    }

    let jwtData: Record<string, unknown>;
    try {
      jwtData = JSON.parse(jwtText);
    } catch {
      upError("generate-jwt response is not valid JSON");
      return jsonError(502, "Invalid JSON from social provider", requestId);
    }

    const accessUrl =
      (jwtData.accessUrl as string) ?? (jwtData.access_url as string);

    if (!accessUrl) {
      upError("generate-jwt response missing accessUrl field. Keys:", Object.keys(jwtData).join(","));
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
        if (e) upWarn("mapping upsert failed:", e.message);
      });

    // ── 8. Return ────────────────────────────────────────────────────────
    upLog("success — accessUrl obtained");
    return NextResponse.json(
      { accessUrl },
      { status: 200, headers: { "X-Request-Id": requestId } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    upError("UNCAUGHT:", msg, stack);
    return jsonError(500, `Unexpected: ${msg}`, requestId);
  }
}
