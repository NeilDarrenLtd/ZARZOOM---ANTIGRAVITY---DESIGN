import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUserAdmin } from "@/lib/auth/rbac";

const DEFAULT_WEBSITE_PROMPT = `Analyze the website at [WEBSITE-URL] using the content provided below. Extract brand information and return a JSON object with these exact keys:

{
  "business_name": "The company or brand name",
  "business_description": "A concise 1-2 sentence description of what the business does",
  "brand_color_hex": "#RRGGBB format hex color that best represents the brand",
  "article_styles": ["Choose 2-3 from: professional, casual, technical, storytelling, educational, promotional, conversational, authoritative, humorous"],
  "goals": ["Choose 2-3 from: brand_awareness, lead_gen, seo, thought_leadership, drive_sales, community_building, educate_audience, social_growth"],
  "content_language": "2-letter ISO language code (e.g. en, es, fr)"
}

Only include fields you are confident about. Omit any field where you cannot determine the value.`;

const DEFAULT_FILE_PROMPT = `Analyze the document named [FILE-NAME] using the content provided below. Extract brand information and return a JSON object with these exact keys:

{
  "business_name": "The company or brand name",
  "business_description": "A concise 1-2 sentence description of what the business does",
  "brand_color_hex": "#RRGGBB format hex color if mentioned, otherwise omit",
  "article_styles": ["Choose 2-3 from: professional, casual, technical, storytelling, educational, promotional, conversational, authoritative, humorous"],
  "goals": ["Choose 2-3 from: brand_awareness, lead_gen, seo, thought_leadership, drive_sales, community_building, educate_audience, social_growth"],
  "content_language": "2-letter ISO language code (e.g. en, es, fr)"
}

Only include fields you are confident about. Omit any field where you cannot determine the value.`;

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
 * POST /api/v1/admin/settings/openrouter-prompts/reset
 * Reset prompts to default templates (admin only)
 */
export async function POST(req: NextRequest) {
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

    const { data: updated, error: updateError } = await supabase
      .from("wizard_autofill_settings")
      .upsert(
        {
          id: 1,
          website_prompt: DEFAULT_WEBSITE_PROMPT,
          file_prompt: DEFAULT_FILE_PROMPT,
          social_profile_prompt: DEFAULT_SOCIAL_PROFILE_PROMPT,
          feature_enabled: true,
          website_model: null,
          file_model: null,
          social_profile_model: null,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (updateError) {
      console.error("[openrouter-prompts] Failed to reset settings:", updateError);
      return NextResponse.json(
        { error: { message: "Failed to reset settings" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        website_prompt: updated.website_prompt,
        file_prompt: updated.file_prompt,
        social_profile_prompt: updated.social_profile_prompt ?? null,
        feature_enabled: updated.feature_enabled,
        updated_at: updated.updated_at,
        updated_by: updated.updated_by,
      },
    });
  } catch (err) {
    console.error("[openrouter-prompts] POST reset error:", err);
    return NextResponse.json(
      { error: { message: "Internal server error" } },
      { status: 500 }
    );
  }
}


