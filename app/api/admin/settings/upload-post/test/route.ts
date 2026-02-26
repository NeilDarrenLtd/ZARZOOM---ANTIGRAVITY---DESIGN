import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";

/**
 * POST /api/admin/settings/upload-post/test
 *
 * Attempts a lightweight health-check call against the Upload-Post API
 * using the stored API key from app_settings.
 */
export async function POST() {
  try {
    const { admin } = await requireAdminApi();

    // 1. Ensure row exists and read the stored API key
    await admin
      .from("app_settings")
      .upsert({ id: 1 }, { onConflict: "id", ignoreDuplicates: true });

    const { data, error } = await admin
      .from("app_settings")
      .select("upload_post_api_key")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, message: `DB error: ${error.message}` },
        { status: 500 }
      );
    }

    const apiKey = data?.upload_post_api_key;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "No API key stored. Save one first." },
        { status: 400 }
      );
    }

    // 2. Call Upload-Post health endpoint
    const baseUrl =
      process.env.UPLOAD_POST_BASE_URL || "https://app.upload-post.com";

    const res = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      return NextResponse.json({
        success: true,
        message: "Connection successful.",
      });
    }

    const body = await res.text().catch(() => "");
    return NextResponse.json(
      {
        success: false,
        message: `Upload-Post returned ${res.status}: ${body.slice(0, 200)}`,
      },
      { status: 502 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "Not authenticated") {
      return NextResponse.json(
        { success: false, message },
        { status: 401 }
      );
    }
    if (message === "Not authorised") {
      return NextResponse.json(
        { success: false, message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, message: `Connection failed: ${message}` },
      { status: 502 }
    );
  }
}
