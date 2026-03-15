/**
 * GET /api/v1/admin/openrouter/models
 *
 * Fetches the live list of available models from the OpenRouter API with full
 * metadata: pricing (input/output per 1M tokens), provider, context_length,
 * capabilities. Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUserAdmin } from "@/lib/auth/rbac";

interface OpenRouterPricing {
  prompt?: string | number;
  completion?: string | number;
}

interface OpenRouterArchitecture {
  input_modalities?: string[];
  output_modalities?: string[];
  modality?: string | null;
}

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string | null;
  pricing?: OpenRouterPricing | OpenRouterPricing[] | null;
  context_length?: number | null;
  architecture?: OpenRouterArchitecture | null;
  supported_parameters?: string[] | null;
}

/** Parse price (per-token USD) to per-1M-tokens USD for display. */
function perMillion(perToken: string | number | undefined): number | null {
  if (perToken === undefined || perToken === null) return null;
  const n = typeof perToken === "string" ? parseFloat(perToken) : perToken;
  if (Number.isNaN(n)) return null;
  return n * 1_000_000;
}

/** Derive provider display name from model id (e.g. "openai/gpt-4" -> "OpenAI"). */
function providerFromId(id: string): string {
  const prefix = id.split("/")[0];
  if (!prefix) return "Unknown";
  const name = prefix
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return name;
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

    const models = rawModels.map((m) => {
      const pricing = Array.isArray(m.pricing) ? m.pricing[0] : m.pricing;
      const inputPerM = perMillion(pricing?.prompt);
      const outputPerM = perMillion(pricing?.completion);
      const capabilities: string[] = [];
      const arch = m.architecture;
      if (arch?.input_modalities?.includes("image")) capabilities.push("Vision");
      if (arch?.output_modalities?.includes("image")) capabilities.push("Image Out");
      const ctx = m.context_length ?? 0;
      if (ctx >= 100_000) capabilities.push("Long Context");
      if (m.supported_parameters?.includes("web_search_options")) capabilities.push("Search");
      const provider = providerFromId(m.id);

      return {
        id: m.id,
        name: m.name || m.id,
        provider,
        context_length: m.context_length ?? null,
        input_cost_per_million: inputPerM,
        output_cost_per_million: outputPerM,
        capabilities: capabilities.length ? capabilities : null,
        description: m.description ?? null,
      };
    }).sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({ data: models });
  } catch (err) {
    console.error("[admin/openrouter/models] Unexpected error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error" } },
      { status: 500 }
    );
  }
}
