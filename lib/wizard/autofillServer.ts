import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// ──────────────────────────────────────────────
// Authentication & Authorization
// ──────────────────────────────────────────────

export async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  return { supabase, user };
}

// ──────────────────────────────────────────────
// Prompt Settings
// ──────────────────────────────────────────────

export interface PromptSettings {
  website_prompt_text: string;
  file_prompt_text: string;
  openrouter_api_key: string | null;
  openrouter_model: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

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

export async function getPromptSettings(
  supabase: SupabaseClient
): Promise<PromptSettings> {
  const { data, error } = await supabase
    .from("wizard_autofill_settings")
    .select("website_prompt, file_prompt, openrouter_api_key, openrouter_model, updated_at, updated_by")
    .eq("id", 1)
    .single();

  if (error || !data) {
    console.warn(
      "[autofillServer] Failed to load prompt settings, using defaults:",
      error?.message
    );
    return {
      website_prompt_text: DEFAULT_WEBSITE_PROMPT,
      file_prompt_text: DEFAULT_FILE_PROMPT,
      openrouter_api_key: null,
      openrouter_model: null,
      updated_at: null,
      updated_by: null,
    };
  }

  return {
    website_prompt_text: data.website_prompt || DEFAULT_WEBSITE_PROMPT,
    file_prompt_text: data.file_prompt || DEFAULT_FILE_PROMPT,
    openrouter_api_key: data.openrouter_api_key,
    openrouter_model: data.openrouter_model || "openai/gpt-4o-mini",
    updated_at: data.updated_at,
    updated_by: data.updated_by,
  };
}

// ──────────────────────────────────────────────
// OpenRouter Analysis
// ──────────────────────────────────────────────

export interface AnalysisResult {
  status: "success" | "partial" | "fail";
  data?: Record<string, unknown>;
  missingFields?: string[];
  confidence?: Record<string, number>;
  message?: string;
  error?: string;
  debug?: {
    promptSent?: string;
    responseReceived?: string;
    fieldsExtracted?: Record<string, unknown>;
  };
}

export async function analyzeContentWithOpenRouter(
  promptTemplate: string,
  content: string,
  sourceType: "website" | "file",
  sourceIdentifier?: string
): Promise<AnalysisResult> {
  try {
    console.log(`[v0] Starting ${sourceType} analysis with OpenRouter...`);

    // Get OpenRouter credentials from settings -- must use admin client
    // because wizard_autofill_settings has RLS that only allows admin reads
    const adminSupabase = await createAdminClient();
    const settings = await getPromptSettings(adminSupabase);

    if (!settings.openrouter_api_key) {
      console.warn("[v0] No OpenRouter API key configured");
      return {
        status: "fail",
        message: "OpenRouter API key not configured. Please add it in Admin > OpenRouter Prompts.",
        error: "missing_api_key",
      };
    }

    // Substitute placeholders in the prompt template
    let finalPrompt = promptTemplate;
    if (sourceType === "website" && sourceIdentifier) {
      finalPrompt = finalPrompt.replace(/\[WEBSITE-URL\]/gi, sourceIdentifier);
      finalPrompt = finalPrompt.replace(/\[URL\]/gi, sourceIdentifier);
    }
    if (sourceType === "file" && sourceIdentifier) {
      finalPrompt = finalPrompt.replace(/\[FILE-NAME\]/gi, sourceIdentifier);
      finalPrompt = finalPrompt.replace(/\[FILENAME\]/gi, sourceIdentifier);
    }

    console.log(`[v0] Prompt template length: ${finalPrompt.length}, content length: ${content.length}`);

    // Call OpenRouter API
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.openrouter_api_key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://zarzoom.com",
        "X-Title": "Zarzoom Wizard",
      },
      body: JSON.stringify({
        model: settings.openrouter_model || "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a brand analysis AI. Extract structured information and respond with ONLY valid JSON. Map your findings to these exact field names for the database: business_name, business_description, brand_color_hex, article_styles (array of strings like professional/casual/technical/storytelling/educational/promotional/conversational/authoritative/humorous), goals (array of strings like brand_awareness/lead_gen/seo/thought_leadership/drive_sales/community_building/educate_audience/social_growth), content_language (2-letter ISO code like en/es/fr).",
          },
          {
            role: "user",
            content: `${finalPrompt}\n\n--- BEGIN CONTENT ---\n${content.slice(0, 30000)}\n--- END CONTENT ---`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    // Capture the user message for debug logging (truncated)
    const userMessage = `${finalPrompt}\n\n--- BEGIN CONTENT ---\n${content.slice(0, 1000)}...[truncated]\n--- END CONTENT ---`;

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[v0] OpenRouter API error:", response.status, errorText);
      return {
        status: "fail",
        message: `OpenRouter API error: ${response.status}`,
        error: errorText,
        debug: {
          promptSent: userMessage.slice(0, 2000),
          responseReceived: errorText.slice(0, 2000),
        },
      };
    }

    const result = await response.json();
    const aiText = result.choices?.[0]?.message?.content;

    if (!aiText) {
      return {
        status: "fail",
        message: "OpenRouter returned empty response",
        error: "empty_response",
        debug: {
          promptSent: userMessage.slice(0, 2000),
          responseReceived: JSON.stringify(result).slice(0, 2000),
        },
      };
    }

    // Parse JSON response
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(aiText);
    } catch {
      console.error("[v0] Failed to parse OpenRouter JSON, raw response:", aiText.slice(0, 500));
      return {
        status: "fail",
        message: "Failed to parse AI response as JSON",
        error: "invalid_json",
        debug: {
          promptSent: userMessage.slice(0, 2000),
          responseReceived: aiText.slice(0, 2000),
        },
      };
    }

    // Normalize field names: strip any nested objects, only keep known DB columns
    const allowedFields = [
      "business_name", "business_description", "brand_color_hex",
      "article_styles", "goals", "content_language",
      "website_url", "logo_url", "additional_notes",
    ];
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const normalizedKey = key.toLowerCase().replace(/\s+/g, "_");
      if (allowedFields.includes(normalizedKey) && value != null && value !== "") {
        normalized[normalizedKey] = value;
      }
    }

    const fieldsPopulated = Object.keys(normalized).length;
    const missingFields = allowedFields
      .filter(f => !normalized[f])
      .filter(f => ["business_name", "business_description", "brand_color_hex", "article_styles", "goals"].includes(f));

    console.log(`[v0] OpenRouter analysis complete, extracted ${fieldsPopulated} fields, missing: ${missingFields.join(", ")}`);

    const status = fieldsPopulated >= 3 ? "success" : fieldsPopulated > 0 ? "partial" : "fail";

    return {
      status,
      data: normalized,
      missingFields,
      message: status === "success"
        ? `Successfully analyzed ${sourceType} and extracted ${fieldsPopulated} fields`
        : `Partial analysis: extracted ${fieldsPopulated} fields but some are missing`,
      debug: {
        promptSent: userMessage.slice(0, 2000),
        responseReceived: aiText.slice(0, 2000),
        fieldsExtracted: normalized,
      },
    };
  } catch (err: any) {
    console.error(`[v0] ${sourceType} analysis error:`, err);
    return {
      status: "fail",
      message: `Analysis failed: ${err.message}`,
      error: err.message,
    };
  }
}

// ──────────────────────────────────────────────
// Persistence
// ──────────────────────────────────────────────

export async function persistAutofillResults(
  _supabase: SupabaseClient,
  userId: string,
  data: Record<string, unknown>,
  source: "website" | "file",
  sourceUrl?: string
): Promise<void> {
  // Use admin client to bypass RLS
  const adminSb = await createAdminClient();

  // Extract and validate fields from AI response
  const getString = (key: string): string | undefined => {
    const v = data[key];
    if (v == null || v === "") return undefined;
    return typeof v === "string" ? v : String(v);
  };

  const getArray = (key: string): string[] | undefined => {
    const v = data[key];
    if (v == null) return undefined;
    if (Array.isArray(v)) {
      const arr = v.map(String).filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    }
    if (typeof v === "string" && v.length > 0) {
      const arr = v.split(",").map((s: string) => s.trim()).filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    }
    return undefined;
  };

  const businessName = getString("business_name");
  const businessDescription = getString("business_description");
  const brandColorHex = getString("brand_color_hex");
  const articleStyles = getArray("article_styles");
  const goals = getArray("goals");
  const contentLanguage = getString("content_language");

  // Count how many fields we actually extracted
  const fieldCount = [businessName, businessDescription, brandColorHex, articleStyles, goals, contentLanguage]
    .filter(v => v != null).length;

  if (fieldCount === 0) {
    console.warn("[v0] No valid fields to persist from autofill results");
    return;
  }

  console.log(`[v0] Persisting ${fieldCount} autofill fields via RPC: ` +
    `business_name=${!!businessName}, business_description=${!!businessDescription}, ` +
    `brand_color_hex=${!!brandColorHex}, article_styles=${articleStyles?.length ?? 0}, ` +
    `goals=${goals?.length ?? 0}, content_language=${!!contentLanguage}`);

  // Use the dedicated RPC function which handles text[] arrays natively
  const { error } = await adminSb.rpc("update_onboarding_autofill", {
    p_user_id: userId,
    p_business_name: businessName ?? null,
    p_business_description: businessDescription ?? null,
    p_brand_color_hex: brandColorHex ?? null,
    p_article_styles: articleStyles ?? null,
    p_goals: goals ?? null,
    p_content_language: contentLanguage ?? null,
  });

  if (error) {
    console.error("[v0] RPC update_onboarding_autofill failed:", error);
    throw new Error(`Failed to save results: ${error.message}`);
  }

  console.log(`[v0] Successfully persisted ${fieldCount} autofill fields for user ${userId}`);
}

// ──────────────────────────────────────────────
// Audit Logging
// ──────────────────────────────────────────────

export async function logAutofillAudit(
  _supabase: SupabaseClient,
  userId: string,
  source: "website" | "file",
  sourceIdentifier: string,
  status: string,
  errorMessage?: string,
  fieldsPopulated?: number,
  confidence?: Record<string, number>,
  debugData?: { promptSent?: string; responseReceived?: string; fieldsExtracted?: Record<string, unknown> }
): Promise<void> {
  // Use admin client to bypass RLS on wizard_autofill_audit
  const adminSb = await createAdminClient();
  const { error } = await adminSb.from("wizard_autofill_audit").insert({
    user_id: userId,
    source_type: source,
    source_identifier: sourceIdentifier,
    status,
    error_message: errorMessage || null,
    fields_populated: fieldsPopulated || 0,
    confidence_scores: confidence || null,
    debug_data: debugData ? JSON.stringify(debugData) : null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[v0] Failed to log autofill audit:", error);
  }
}
