import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { createUploadPostUser, UPLOAD_POST_BASE } from "@/lib/upload-post/http";

/**
 * POST /api/admin/upload-post/smoke
 *
 * Smoke-tests the stored Upload-Post API key by attempting to create a
 * temporary probe user (POST /api/uploadposts/users).
 * 201 Created or 409 Conflict (already exists) both count as success —
 * they prove the key is valid, the host is reachable, and POST is accepted.
 */
export async function POST() {
  try {
    const { admin } = await requireAdminApi();

    // ── 1. Resolve API key ───────────────────────────────────────────────
    await admin
      .from("app_settings")
      .upsert({ id: 1 }, { onConflict: "id", ignoreDuplicates: true });

    const { data, error: dbErr } = await admin
      .from("app_settings")
      .select("upload_post_api_key")
      .eq("id", 1)
      .maybeSingle();

    if (dbErr) {
      return NextResponse.json(
        { ok: false, message: `Database error: ${dbErr.message}` },
        { status: 500 }
      );
    }

    const apiKey =
      data?.upload_post_api_key?.trim() ||
      process.env.UPLOAD_POST_API_KEY?.trim() ||
      null;

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "No API key configured. Save one in the API Connection section above.",
        },
        { status: 400 }
      );
    }

    // ── 2. POST a probe user to confirm key + host + method ──────────────
    const username = `zarzoom_smoke_test_${Date.now()}`;
    const res = await createUploadPostUser(apiKey, { username });

    // 201 = created, 409 = already exists — both confirm the key is valid
    if (res.ok || res.status === 409) {
      return NextResponse.json({
        ok: true,
        message: `Connection successful (host: ${UPLOAD_POST_BASE}, status: ${res.status}).`,
      });
    }

    // Any other non-2xx is a real failure
    return NextResponse.json(
      {
        ok: false,
        status: res.status,
        message: `Upload-Post returned ${res.status}: ${res.errorSnippet ?? "unknown error"}`,
        hint: "create-user",
      },
      { status: 502 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "Not authenticated") {
      return NextResponse.json({ ok: false, message }, { status: 401 });
    }
    if (message === "Not authorised") {
      return NextResponse.json({ ok: false, message }, { status: 403 });
    }

    return NextResponse.json(
      { ok: false, message: `Smoke test failed: ${message}` },
      { status: 500 }
    );
  }
}
