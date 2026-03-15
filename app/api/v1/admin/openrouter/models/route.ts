/**
 * GET /api/v1/admin/openrouter/models
 *
 * Fetches the live list of available models from the OpenRouter API.
 * Admin-only. Uses the saved API key from wizard_autofill_settings or
 * the OPENROUTER_API_KEY environment variable.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUserAdmin } from "@/lib/auth/rbac";

interface OpenRouterModel {
  id: string;
  name: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  context_length?: number;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) {
      return NextResponse.json(
        { error: { message: "Forbidden: Admin access required" } },
        { status: 403 }
      );
    }

    // Resolve API key
    const { data: settings } = await supabase
      .from("wizard_autofill_settings")
      .select("openrouter_api_key")
      .eq("id", 1)
      .maybeSingle();

    const apiKey =
      process.env.OPENROUTER_API_KEY ?? settings?.openrouter_api_key ?? null;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: {
            message:
              "No OpenRouter API key configured. Set OPENROUTER_API_KEY or save one in Admin settings.",
          },
        },
        { status: 422 }
      );
    }

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "ZARZOOM Admin",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        "[admin/openrouter/models] OpenRouter API error:",
        response.status,
        errorText
      );
      return NextResponse.json(
        {
          error: {
            message: `OpenRouter API returned ${response.status}`,
          },
        },
        { status: 502 }
      );
    }

    const json = await response.json();
    const rawModels: OpenRouterModel[] = json.data ?? [];

    const models = rawModels
      .map((m) => ({
        id: m.id,
        name: m.name || m.id,
        context_length: m.context_length ?? null,
        pricing: m.pricing ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({ data: models });
  } catch (err) {
    console.error("[admin/openrouter/models] Unexpected error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error" } },
      { status: 500 }
    );
  }
}
