import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUserAdmin } from "@/lib/auth/rbac";
import { z } from "zod";

const DEFAULT_SOCIAL_PROFILE_PROMPT = `You are an AI analyst specialising in social media profile investigation.

Given the social profile URL [PROFILE-URL] and the scraped content below, extract brand and author information and return a JSON object with these exact keys:

{
  "business_name": "The brand, creator, or account name",
  "business_description": "A concise 1-2 sentence description of what this account does or represents",
  "brand_color_hex": "#RRGGBB primary brand colour if detectable from imagery or copy, otherwise omit",
  "article_styles": ["Choose 2-3 from: professional, casual, technical, storytelling, educational, promotional, conversational, authoritative, humorous"],
  "goals": ["Choose 2-3 from: brand_awareness, lead_gen, seo, thought_leadership, drive_sales, community_building, educate_audience, social_growth"],
  "content_language": "2-letter ISO language code (e.g. en, es, fr)",
  "platform": "The social platform (e.g. instagram, twitter, linkedin, tiktok, youtube)"
}

Only include fields you are confident about. Omit any field where you cannot determine the value.`;

/**
 * GET /api/v1/admin/settings/openrouter-prompts
 * Fetch the current OpenRouter prompt settings (admin only)
 */
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

    const { data: settings, error } = await supabase
      .from("wizard_autofill_settings")
      .select("*")
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[openrouter-prompts] Failed to fetch settings:", error);
      return NextResponse.json(
        { error: { message: "Failed to fetch settings" } },
        { status: 500 }
      );
    }

    if (!settings) {
      return NextResponse.json({
        data: {
          website_prompt: null,
          file_prompt: null,
          social_profile_prompt: null,
          feature_enabled: true,
          openrouter_api_key: null,
          openrouter_api_key_set: false,
          openrouter_model: "openai/gpt-4.1-mini",
          website_model: null,
          file_model: null,
          social_profile_model: null,
          updated_at: null,
          updated_by: null,
        },
      });
    }

    const maskedKey = settings.openrouter_api_key
      ? "sk-or-......" + settings.openrouter_api_key.slice(-4)
      : null;

    return NextResponse.json({
      data: {
        website_prompt: settings.website_prompt,
        file_prompt: settings.file_prompt,
        social_profile_prompt: settings.social_profile_prompt ?? null,
        feature_enabled: settings.feature_enabled,
        openrouter_api_key: maskedKey,
        openrouter_api_key_set: !!settings.openrouter_api_key,
        openrouter_model: settings.openrouter_model,
        website_model: settings.website_model ?? null,
        file_model: settings.file_model ?? null,
        social_profile_model: settings.social_profile_model ?? null,
        updated_at: settings.updated_at,
        updated_by: settings.updated_by,
      },
    });
  } catch (err) {
    console.error("[openrouter-prompts] GET error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error" } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/admin/settings/openrouter-prompts
 * Update OpenRouter prompt settings (admin only)
 */
export async function PUT(req: NextRequest) {
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

    const body = await req.json();
    const schema = z.object({
      website_prompt: z.string().min(1).max(10000).nullable().optional(),
      file_prompt: z.string().min(1).max(10000).nullable().optional(),
      social_profile_prompt: z.string().min(1).max(10000).nullable().optional(),
      feature_enabled: z.boolean().optional(),
      openrouter_api_key: z.string().max(200).nullable().optional(),
      openrouter_model: z.string().max(200).nullable().optional(),
      website_model: z.string().max(200).nullable().optional(),
      file_model: z.string().max(200).nullable().optional(),
      social_profile_model: z.string().max(200).nullable().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const {
      website_prompt,
      file_prompt,
      social_profile_prompt,
      feature_enabled,
      openrouter_api_key,
      openrouter_model,
      website_model,
      file_model,
      social_profile_model,
    } = parsed.data;

    const upsertPayload: Record<string, unknown> = {
      id: 1,
      website_prompt,
      file_prompt,
      social_profile_prompt,
      feature_enabled,
      openrouter_model,
      website_model,
      file_model,
      social_profile_model,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    // Only overwrite the stored API key if the user typed a real new one
    if (openrouter_api_key && !openrouter_api_key.startsWith("sk-or-......")) {
      upsertPayload.openrouter_api_key = openrouter_api_key;
    } else if (openrouter_api_key === null) {
      upsertPayload.openrouter_api_key = null;
    }

    const { data: updated, error: updateError } = await supabase
      .from("wizard_autofill_settings")
      .upsert(upsertPayload, { onConflict: "id" })
      .select()
      .single();

    if (updateError) {
      console.error("[openrouter-prompts] Failed to update settings:", updateError);
      return NextResponse.json(
        { error: { message: "Failed to update settings" } },
        { status: 500 }
      );
    }

    const maskedUpdatedKey = updated.openrouter_api_key
      ? "sk-or-......" + updated.openrouter_api_key.slice(-4)
      : null;

    return NextResponse.json({
      data: {
        website_prompt: updated.website_prompt,
        file_prompt: updated.file_prompt,
        social_profile_prompt: updated.social_profile_prompt ?? null,
        feature_enabled: updated.feature_enabled,
        openrouter_api_key: maskedUpdatedKey,
        openrouter_api_key_set: !!updated.openrouter_api_key,
        openrouter_model: updated.openrouter_model,
        website_model: updated.website_model ?? null,
        file_model: updated.file_model ?? null,
        social_profile_model: updated.social_profile_model ?? null,
        updated_at: updated.updated_at,
        updated_by: updated.updated_by,
      },
    });
  } catch (err) {
    console.error("[openrouter-prompts] PUT error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error" } },
      { status: 500 }
    );
  }
}


