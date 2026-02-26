import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";

/* ------------------------------------------------------------------ */
/*  GET  – Return current settings (never expose raw API key)          */
/* ------------------------------------------------------------------ */

export async function GET() {
  try {
    const { admin } = await requireAdminApi();

    const { data, error } = await admin
      .from("app_settings")
      .select(
        "upload_post_api_key, upload_post_logo_url, upload_post_connect_title, upload_post_connect_description, upload_post_redirect_button_text, upload_post_default_platforms, updated_at"
      )
      .eq("id", 1)
      .single();

    if (error) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        hasApiKey: !!data?.upload_post_api_key,
        logoUrl: data?.upload_post_logo_url ?? "",
        connectTitle: data?.upload_post_connect_title ?? "",
        connectDescription: data?.upload_post_connect_description ?? "",
        redirectButtonText: data?.upload_post_redirect_button_text ?? "",
        defaultPlatforms: data?.upload_post_default_platforms ?? "",
        updatedAt: data?.updated_at ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Forbidden";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: { message } }, { status });
  }
}

/* ------------------------------------------------------------------ */
/*  POST  – Upsert settings (empty API key = keep existing)            */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  try {
    const { admin } = await requireAdminApi();
    const body = await req.json();

    // Build update payload — only include API key if non-empty
    const update: Record<string, unknown> = {
      upload_post_logo_url: body.logoUrl ?? null,
      upload_post_connect_title: body.connectTitle ?? null,
      upload_post_connect_description: body.connectDescription ?? null,
      upload_post_redirect_button_text: body.redirectButtonText ?? null,
      upload_post_default_platforms: body.defaultPlatforms ?? null,
      updated_at: new Date().toISOString(),
    };

    if (typeof body.apiKey === "string" && body.apiKey.trim() !== "") {
      update.upload_post_api_key = body.apiKey.trim();
    }

    const { error } = await admin
      .from("app_settings")
      .update(update)
      .eq("id", 1);

    if (error) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Forbidden";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: { message } }, { status });
  }
}

/* ------------------------------------------------------------------ */
/*  POST /test  – Lightweight check against Upload-Post API            */
/*  (handled via query param ?action=test)                             */
/* ------------------------------------------------------------------ */
