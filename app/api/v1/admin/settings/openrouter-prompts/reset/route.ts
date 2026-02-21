import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUserAdmin } from "@/lib/auth/rbac";

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

    // Default templates
    const defaultWebsitePrompt = `You are an AI assistant that extracts brand information from websites. 

Given a website URL and its content, extract the following information:
1. Business name
2. Business description (1-2 sentences)
3. Primary brand color (hex code)
4. Suggested article writing styles (choose from: professional, casual, technical, storytelling, educational, promotional, conversational, authoritative, humorous)

Return your response as a JSON object with these exact keys:
{
  "business_name": "string",
  "business_description": "string",
  "brand_color_hex": "#RRGGBB",
  "article_styles": ["style1", "style2"]
}`;

    const defaultFilePrompt = `You are an AI assistant that extracts brand information from documents.

Given a document (PDF or Word), extract the following information:
1. Business name
2. Business description (1-2 sentences)
3. Primary brand color (hex code) if mentioned
4. Suggested article writing styles (choose from: professional, casual, technical, storytelling, educational, promotional, conversational, authoritative, humorous)

Return your response as a JSON object with these exact keys:
{
  "business_name": "string",
  "business_description": "string",
  "brand_color_hex": "#RRGGBB or null",
  "article_styles": ["style1", "style2"]
}`;

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
