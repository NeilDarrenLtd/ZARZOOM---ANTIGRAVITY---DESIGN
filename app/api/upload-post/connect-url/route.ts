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
import { getEffectivePlanForTenant } from "@/lib/billing/entitlements";
import { deriveWorkspaceUploadPostUsername } from "@/lib/upload-post/identity";
import { getServerTranslations } from "@/lib/i18n/server";

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
 * Returns an Upload-Post accessUrl scoped to the selected workspace.
 * The profile is created once per workspace and reused on subsequent calls.
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

    // ── 2. Resolve workspace + API key (DB → env fallback) ──────────────
    const admin = await createAdminClient();

    const tenantId = req.headers.get("x-tenant-id")?.trim();
    if (!tenantId) {
      upWarn("no X-Tenant-Id header — rejecting connect-url (workspace required)");
      return jsonError(
        400,
        "Workspace context required. Select a workspace before connecting accounts.",
        requestId
      );
    }

    const { data: membership } = await admin
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return jsonError(
        403,
        "You do not have access to this workspace.",
        requestId
      );
    }

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

    // ── 3. Enforce subscription gating per workspace ─────────────────────
    const plan = await getEffectivePlanForTenant(tenantId);
    if (plan.subscriptionStatus !== "active" && plan.subscriptionStatus !== "trialing") {
      return NextResponse.json(
        {
          error: {
            code: "SUBSCRIPTION_REQUIRED",
            message:
              "An active subscription is required to connect social accounts for this workspace.",
            requestId,
          },
        },
        { status: 402, headers: { "X-Request-Id": requestId } }
      );
    }

    // ── 4. Resolve workspace Upload-Post identity ────────────────────────
    const uploadPostUsername = deriveWorkspaceUploadPostUsername(tenantId);

    // Check if ANY user in this workspace already provisioned the profile
    const { data: existingMapping } = await admin
      .from("upload_post_mapping")
      .select("upload_post_username")
      .eq("tenant_id", tenantId)
      .eq("upload_post_username", uploadPostUsername)
      .limit(1)
      .maybeSingle();

    const alreadyProvisioned = !!existingMapping;

    if (!alreadyProvisioned) {
      upLog(`no provisioned profile for workspace ${tenantId}, attempting creation`);
      const ensureRes = await createUploadPostUser(apiKey, {
        username: uploadPostUsername,
      });

      // 201 = created, 409 = already exists — both are fine
      // 403 = plan limit — the profile may already exist under this or an
      //        older username format; we'll proceed to JWT generation and
      //        let that step decide if there's a real problem.
      if (!ensureRes.ok && ensureRes.status !== 409 && ensureRes.status !== 403) {
        upError(`create-user failed status=${ensureRes.status} body=${ensureRes.errorSnippet}`);
        return providerError(
          ensureRes.status,
          "create-user",
          ensureRes.errorSnippet ?? "",
          requestId
        );
      }

      if (ensureRes.status === 403) {
        upWarn("create-user returned 403 (limit) — profile may already exist, proceeding to JWT");
      }

      // Record the provisioned profile in the audit table (non-fatal)
      admin
        .from("upload_post_mapping")
        .upsert(
          {
            tenant_id: tenantId,
            user_id: user.id,
            upload_post_username: uploadPostUsername,
            last_connect_url_generated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,user_id" }
        )
        .then(({ error: e }) => {
          if (e) upWarn("mapping upsert failed:", e.message);
        });
    } else {
      upLog(`profile already provisioned for workspace ${tenantId}, skipping creation`);
      // Update last-connect timestamp (non-fatal)
      admin
        .from("upload_post_mapping")
        .update({ last_connect_url_generated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .then(({ error: e }) => {
          if (e) upWarn("mapping timestamp update failed:", e.message);
        });
    }

    // ── 5. Build signed state token ──────────────────────────────────────
    const rawReturnTo = req.nextUrl.searchParams.get("returnTo") ?? "/dashboard";
    const returnTo = sanitizeReturnTo(rawReturnTo);

    let state: string;
    try {
      state = await createState({ returnTo, userId: user.id, tenantId });
    } catch (stateErr) {
      const msg = stateErr instanceof Error ? stateErr.message : String(stateErr);
      upError("createState failed:", msg);
      return jsonError(500, `State token error: ${msg}`, requestId);
    }

    // ── 6. Build redirect URL ────────────────────────────────────────────
    const baseUrl = getBaseUrl();
    const redirectUrl = `${baseUrl}/integrations/upload-post/return?state=${encodeURIComponent(state)}`;

    upLog(`redirect_url built: baseUrl=${baseUrl} redirectUrl=${redirectUrl.substring(0, 100)}...`);

    // ── 7. Load locale-specific text for Upload-Post JWT fields ──────────
    const locale = req.nextUrl.searchParams.get("locale") ?? "en";
    const t = await getServerTranslations(locale);

    const localizedTitle = t("connect.uploadPost.connectTitle");
    const localizedDescription = t("connect.uploadPost.connectDescription");
    const localizedButtonText = t("connect.uploadPost.redirectButtonText");

    // ── 8. Fetch Upload-Post JWT / accessUrl ─────────────────────────────
    const uiConfig = getUploadPostUiConfig();

    const jwtBody: Parameters<typeof generateUploadPostJwt>[1] = {
      username: uploadPostUsername,
      redirect_url: redirectUrl,
      show_calendar: false,
      logo_image: uiConfig.logoUrl,
      connect_title: localizedTitle,
      connect_description: localizedDescription,
      redirect_button_text: localizedButtonText,
      ...(uiConfig.defaultPlatforms?.length && { platforms: uiConfig.defaultPlatforms }),
    };

    upLog(`generate-jwt request body keys: ${Object.keys(jwtBody).join(", ")} locale=${locale}`);

    let jwtRes = await generateUploadPostJwt(apiKey, jwtBody);

    // If the workspace-scoped profile doesn't exist yet (404), fall back to
    // the legacy user-based profile that may have been created before the
    // workspace-scoped refactor.
    if (!jwtRes.ok && jwtRes.status === 404) {
      upWarn(`generate-jwt 404 for ${uploadPostUsername}, trying legacy user.id fallback`);
      const legacyJwtBody = { ...jwtBody, username: user.id };
      const legacyRes = await generateUploadPostJwt(apiKey, legacyJwtBody);
      if (legacyRes.ok && legacyRes.data) {
        upLog("legacy user.id profile found — using it");
        jwtRes = legacyRes;
      }
    }

    if (!jwtRes.ok || !jwtRes.data) {
      return providerError(jwtRes.status, "generate-jwt", jwtRes.errorSnippet ?? "", requestId);
    }

    const accessUrl = jwtRes.data.accessUrl ?? jwtRes.data.access_url;

    if (!accessUrl) {
      upError("generate-jwt response missing accessUrl field. Keys:", Object.keys(jwtRes.data).join(","));
      return jsonError(502, "No accessUrl in provider response", requestId);
    }

    // ── 9. Return ────────────────────────────────────────────────────────
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
