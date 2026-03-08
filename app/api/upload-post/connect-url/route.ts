import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getBaseUrl, getUploadPostUiConfig } from "@/lib/upload-post/config";
import { createState } from "@/lib/upload-post/state";
import { sanitizeReturnTo } from "@/lib/upload-post/returnTo";
import {
  createUploadPostUser,
  generateUploadPostJwt,
  UPLOAD_POST_BASE,
} from "@/lib/upload-post/http";

const upDebug = process.env.UPLOAD_POST_DEBUG === "true";
function upLog(...args: unknown[]) { if (upDebug) console.log("[upload-post]", ...args); }
function upWarn(...args: unknown[]) { if (upDebug) console.warn("[upload-post]", ...args); }
function upError(...args: unknown[]) { console.error("[upload-post]", ...args); }

function jsonError(status: number, message: string, requestId: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: { code: "ERROR", message, requestId, ...extra } },
    { status, headers: { "X-Request-Id": requestId } }
  );
}

function notConfigured(requestId: string) {
  return NextResponse.json(
    {
      error: {
        code: "NOT_CONFIGURED",
        message: "Social connector is not set up. Ask an admin to add the API key under Admin > Social Connector.",
        requestId,
      },
    },
    { status: 500, headers: { "X-Request-Id": requestId } }
  );
}

function providerError(status: number, hint: string, snippet: string, requestId: string) {
  return NextResponse.json(
    {
      error: {
        code: "PROVIDER_ERROR",
        message: `Upload-Post request failed (${status}).`,
        hint,
        detail: snippet,
        requestId,
      },
    },
    { status: 502, headers: { "X-Request-Id": requestId } }
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

  upLog(`base_url=${UPLOAD_POST_BASE} requestId=${requestId}`);

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
      return notConfigured(requestId);
    }

    // ── 3. Ensure Upload-Post user exists ────────────────────────────────
    const ensureRes = await createUploadPostUser(apiKey, { username: user.id });

    // 409 = already exists → success
    if (!ensureRes.ok && ensureRes.status !== 409) {
      upError(`non-2xx op=create-user status=${ensureRes.status} body=${ensureRes.errorSnippet}`);
      return providerError(ensureRes.status, "create-user", ensureRes.errorSnippet ?? "", requestId);
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
    
    upLog(`redirect_url built: baseUrl=${baseUrl} redirectUrl=${redirectUrl.substring(0, 100)}...`);

    // ── 6. Fetch Upload-Post JWT / accessUrl ─────────────────────────────
    const uiConfig = getUploadPostUiConfig();

    const jwtBody: Parameters<typeof generateUploadPostJwt>[1] = {
      username: user.id,
      redirect_url: redirectUrl,
      show_calendar: false,
      ...(uiConfig.logoUrl            && { logo_image:            uiConfig.logoUrl }),
      ...(uiConfig.connectTitle        && { connect_title:         uiConfig.connectTitle }),
      ...(uiConfig.connectDescription  && { connect_description:   uiConfig.connectDescription }),
      ...(uiConfig.redirectButtonText  && { redirect_button_text:  uiConfig.redirectButtonText }),
      ...(uiConfig.defaultPlatforms?.length && { platforms: uiConfig.defaultPlatforms }),
    };

    upLog(`generate-jwt request body keys: ${Object.keys(jwtBody).join(", ")} (show_calendar=false)`);

    const jwtRes = await generateUploadPostJwt(apiKey, jwtBody);

    if (!jwtRes.ok || !jwtRes.data) {
      return providerError(jwtRes.status, "generate-jwt", jwtRes.errorSnippet ?? "", requestId);
    }

    const accessUrl = jwtRes.data.accessUrl ?? jwtRes.data.access_url;

    if (!accessUrl) {
      upError("generate-jwt response missing accessUrl field. Keys:", Object.keys(jwtRes.data).join(","));
      return jsonError(502, "No accessUrl in provider response", requestId);
    }

    // ── 7. Upsert audit trail per workspace (non-fatal) ─────────────────────
    const tenantId = req.headers.get("x-tenant-id")?.trim();
    if (tenantId) {
      const { data: mem } = await admin
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (mem) {
        admin
          .from("upload_post_mapping")
          .upsert(
            {
              tenant_id: tenantId,
              user_id: user.id,
              upload_post_username: user.id,
              last_connect_url_generated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,user_id" }
          )
          .then(({ error: e }) => {
            if (e) upWarn("mapping upsert failed:", e.message);
          });
      }
    } else {
      upWarn("no X-Tenant-Id header — upload_post_mapping not updated (workspace-scoped)");
    }

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
