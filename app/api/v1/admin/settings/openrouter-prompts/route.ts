import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUserAdmin } from "@/lib/auth/rbac";
import { z } from "zod";

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

    // Check admin status
    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) {
      return NextResponse.json(
        { error: { message: "Forbidden: Admin access required" } },
        { status: 403 }
      );
    }

    // Fetch settings
    const { data: settings, error } = await supabase
      .from("wizard_autofill_settings")
      .select("*")
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found, which is ok
      console.error("[openrouter-prompts] Failed to fetch settings:", error);
      return NextResponse.json(
        { error: { message: "Failed to fetch settings" } },
        { status: 500 }
      );
    }

    // If no settings exist, return defaults
    if (!settings) {
      return NextResponse.json({
        data: {
          website_prompt: null,
          file_prompt: null,
          feature_enabled: true,
          openrouter_api_key: null,
          openrouter_model: "openai/gpt-4o-mini",
          updated_at: null,
          updated_by: null,
        },
      });
    }

    // Mask the API key for display (only show last 4 chars)
    const maskedKey = settings.openrouter_api_key
      ? "sk-or-......" + settings.openrouter_api_key.slice(-4)
      : null;

    return NextResponse.json({
      data: {
        website_prompt: settings.website_prompt,
        file_prompt: settings.file_prompt,
        feature_enabled: settings.feature_enabled,
        openrouter_api_key: maskedKey,
        openrouter_api_key_set: !!settings.openrouter_api_key,
        openrouter_model: settings.openrouter_model,
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

    // Check admin status
    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) {
      return NextResponse.json(
        { error: { message: "Forbidden: Admin access required" } },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await req.json();
    const schema = z.object({
      website_prompt: z.string().min(1).max(10000).nullable().optional(),
      file_prompt: z.string().min(1).max(10000).nullable().optional(),
      feature_enabled: z.boolean().optional(),
      openrouter_api_key: z.string().max(200).nullable().optional(),
      openrouter_model: z.string().max(200).nullable().optional(),
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

    const { website_prompt, file_prompt, feature_enabled, openrouter_api_key, openrouter_model } = parsed.data;

    // Build update payload -- only include API key if the user actually sent a new one
    // (a masked value like "sk-or-......xxxx" should not overwrite the real key)
    const upsertPayload: Record<string, unknown> = {
      id: 1,
      website_prompt,
      file_prompt,
      feature_enabled,
      openrouter_model,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    // Only update the API key if it looks like a real key (not a masked one)
    if (openrouter_api_key && !openrouter_api_key.startsWith("sk-or-......")) {
      upsertPayload.openrouter_api_key = openrouter_api_key;
    } else if (openrouter_api_key === null) {
      // Explicitly clearing the key
      upsertPayload.openrouter_api_key = null;
    }

    // Update or insert settings (upsert)
    const { data: updated, error: updateError } = await supabase
      .from("wizard_autofill_settings")
      .upsert(
        upsertPayload,
        {
          onConflict: "id",
        }
      )
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
        feature_enabled: updated.feature_enabled,
        openrouter_api_key: maskedUpdatedKey,
        openrouter_api_key_set: !!updated.openrouter_api_key,
        openrouter_model: updated.openrouter_model,
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

    // Check admin status
    const admin = await isUserAdmin(supabase, user.id);
    if (!admin) {
      return NextResponse.json(
        { error: { message: "Forbidden: Admin access required" } },
        { status: 403 }
      );
    }

    // Default templates - use [WEBSITE-URL] and [FILE-NAME] placeholders
    const defaultWebsitePrompt = `Analyze the website at [WEBSITE-URL] using the content provided below. Extract brand information and return a JSON object with these exact keys:

{
  "business_name": "The company or brand name",
  "business_description": "A concise 1-2 sentence description of what the business does",
  "brand_color_hex": "#RRGGBB format hex color that best represents the brand",
  "article_styles": ["Choose 2-3 from: professional, casual, technical, storytelling, educational, promotional, conversational, authoritative, humorous"],
  "goals": ["Choose 2-3 from: brand_awareness, lead_gen, seo, thought_leadership, drive_sales, community_building, educate_audience, social_growth"],
  "content_language": "2-letter ISO language code (e.g. en, es, fr)"
}

Only include fields you are confident about. Omit any field where you cannot determine the value.`;

    const defaultFilePrompt = `Analyze the document named [FILE-NAME] using the content provided below. Extract brand information and return a JSON object with these exact keys:

{
  "business_name": "The company or brand name",
  "business_description": "A concise 1-2 sentence description of what the business does",
  "brand_color_hex": "#RRGGBB format hex color if mentioned, otherwise omit",
  "article_styles": ["Choose 2-3 from: professional, casual, technical, storytelling, educational, promotional, conversational, authoritative, humorous"],
  "goals": ["Choose 2-3 from: brand_awareness, lead_gen, seo, thought_leadership, drive_sales, community_building, educate_audience, social_growth"],
  "content_language": "2-letter ISO language code (e.g. en, es, fr)"
}

Only include fields you are confident about. Omit any field where you cannot determine the value.`;

    // Reset to defaults
    const { data: updated, error: updateError } = await supabase
      .from("wizard_autofill_settings")
      .upsert(
        {
          id: 1,
          website_prompt: defaultWebsitePrompt,
          file_prompt: defaultFilePrompt,
          feature_enabled: true,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        {
          onConflict: "id",
        }
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
