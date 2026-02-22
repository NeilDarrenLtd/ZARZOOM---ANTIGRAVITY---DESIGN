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

const DEFAULT_WEBSITE_PROMPT = `You are analysing the website at [WEBSITE-URL]. The full page content is provided below.

Your task is to extract as much onboarding information as possible for a content-marketing platform called Zarzoom. Return a single JSON object using ONLY the exact keys and allowed values listed below. Omit any key where you cannot determine a confident answer.

{
  "business_name": "string — the company, brand, or trading name found on the site",
  "business_description": "string — a concise 1-2 sentence summary of what the business does, its products/services, and target audience",
  "brand_color_hex": "string — the dominant brand colour in #RRGGBB hex format (look at logo, header, buttons, accent colours)",
  "content_language": "string — 2-letter ISO 639-1 code for the primary language used on the site (e.g. en, es, fr, de, pt, zh, ja)",
  "article_styles": ["array — choose 2-4 that best fit the brand's voice and industry. ONLY use these exact values: how_to_guides, listicles, tutorials, opinion_pieces, case_studies, news_commentary, interviews, product_reviews, explainer_articles, comparisons_vs_articles, ultimate_guides_pillar, checklists_cheat_sheets, best_top_forecasts, problem_solution_posts, myth_busting, resource_roundups, faqs_qa_content, personal_stories, research_summaries, historical_timeline, satire_humor, explained_in_minutes"],
  "goals": ["array — choose 2-4 marketing goals that align with the business. ONLY use these exact values: increase_website_traffic, get_more_subscribers_leads, promote_product_or_service, increase_sales, build_brand_authority, improve_seo, educate_audience, generate_social_content"],
  "website_or_landing_url": "string — the main website URL or landing page (use [WEBSITE-URL] if nothing more specific is found)",
  "product_or_sales_url": "string — a dedicated product, shop, or sales page URL if one exists on the site (omit if none found)",
  "approval_preference": "string — ONLY 'auto' or 'manual'. Choose 'auto' if the site looks like a large publisher or e-commerce brand that would want content published immediately. Choose 'manual' for smaller businesses, professional services, or regulated industries that would want to review content first. When in doubt, choose 'manual'.",
  "additional_notes": "string — any useful context about the brand that doesn't fit the above fields (e.g. 'B2B SaaS company targeting enterprise', 'Local bakery with strong community focus', 'Luxury fashion brand with minimalist aesthetic'). Keep to 1-2 sentences."
}

IMPORTANT RULES:
- For article_styles: NEVER include "let_zarzoom_decide". Only use the 22 specific style values listed above.
- For goals: Only use the 8 specific goal values listed above. Infer goals from the site's content, calls-to-action, and business model.
- For brand_color_hex: Extract the actual brand colour from the site design, not a generic colour. Prefer the colour used in the logo, navigation, or primary buttons.
- Return ONLY valid JSON. No markdown, no explanation, no code fences.`;

const DEFAULT_FILE_PROMPT = `You are analysing a document named [FILE-NAME]. The full document content is provided below.

Your task is to extract as much onboarding information as possible for a content-marketing platform called Zarzoom. Return a single JSON object using ONLY the exact keys and allowed values listed below. Omit any key where you cannot determine a confident answer.

{
  "business_name": "string — the company, brand, or trading name found in the document",
  "business_description": "string — a concise 1-2 sentence summary of what the business does",
  "brand_color_hex": "string — brand colour in #RRGGBB hex format if explicitly mentioned",
  "content_language": "string — 2-letter ISO 639-1 code for the language used in the document",
  "article_styles": ["array — choose 2-4 from: how_to_guides, listicles, tutorials, opinion_pieces, case_studies, news_commentary, interviews, product_reviews, explainer_articles, comparisons_vs_articles, ultimate_guides_pillar, checklists_cheat_sheets, best_top_forecasts, problem_solution_posts, myth_busting, resource_roundups, faqs_qa_content, personal_stories, research_summaries, historical_timeline, satire_humor, explained_in_minutes"],
  "goals": ["array — choose 2-4 from: increase_website_traffic, get_more_subscribers_leads, promote_product_or_service, increase_sales, build_brand_authority, improve_seo, educate_audience, generate_social_content"],
  "website_or_landing_url": "string — any website URL mentioned in the document",
  "product_or_sales_url": "string — any product or sales page URL mentioned",
  "approval_preference": "string — 'auto' or 'manual'. Default to 'manual' unless context strongly suggests otherwise.",
  "additional_notes": "string — any useful brand context not captured above (1-2 sentences)"
}

IMPORTANT RULES:
- For article_styles: NEVER include "let_zarzoom_decide". Only use the 22 specific style values listed.
- For goals: Only use the 8 specific goal values listed.
- Return ONLY valid JSON. No markdown, no explanation, no code fences.`;

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

    const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
            content: "You are a brand analysis AI for Zarzoom, a content-marketing platform. Extract structured information from websites and documents. Respond with ONLY valid JSON, no markdown fences. Use these exact field names: business_name (string), business_description (string), brand_color_hex (#RRGGBB string), content_language (2-letter ISO code), article_styles (array from: how_to_guides, listicles, tutorials, opinion_pieces, case_studies, news_commentary, interviews, product_reviews, explainer_articles, comparisons_vs_articles, ultimate_guides_pillar, checklists_cheat_sheets, best_top_forecasts, problem_solution_posts, myth_busting, resource_roundups, faqs_qa_content, personal_stories, research_summaries, historical_timeline, satire_humor, explained_in_minutes), goals (array from: increase_website_traffic, get_more_subscribers_leads, promote_product_or_service, increase_sales, build_brand_authority, improve_seo, educate_audience, generate_social_content), website_or_landing_url (string), product_or_sales_url (string), approval_preference ('auto' or 'manual'), additional_notes (string).",
          },
          {
            role: "user",
            content: `${finalPrompt}\n\n--- BEGIN CONTENT ---\n${content.slice(0, 30000)}\n--- END CONTENT ---`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const userMessage = `${finalPrompt}\n\n--- BEGIN CONTENT ---\n${content.slice(0, 1000)}...[truncated]\n--- END CONTENT ---`;

    if (!orResponse.ok) {
      const errorText = await orResponse.text();
      console.error("[v0] OpenRouter API error:", orResponse.status, errorText);
      return {
        status: "fail",
        message: `OpenRouter API error: ${orResponse.status}`,
        error: errorText,
        debug: {
          promptSent: userMessage.slice(0, 2000),
          responseReceived: errorText.slice(0, 2000),
        },
      };
    }

    const result = await orResponse.json();
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

    const allowedFields = [
      "business_name", "business_description", "brand_color_hex",
      "article_styles", "goals", "content_language",
      "website_or_landing_url", "product_or_sales_url",
      "approval_preference", "additional_notes",
    ];

    // Valid enum values for validation
    const validArticleStyles = [
      "how_to_guides", "listicles", "tutorials", "opinion_pieces", "case_studies",
      "news_commentary", "interviews", "product_reviews", "explainer_articles",
      "comparisons_vs_articles", "ultimate_guides_pillar", "checklists_cheat_sheets",
      "best_top_forecasts", "problem_solution_posts", "myth_busting",
      "resource_roundups", "faqs_qa_content", "personal_stories",
      "research_summaries", "historical_timeline", "satire_humor", "explained_in_minutes",
    ];
    const validGoals = [
      "increase_website_traffic", "get_more_subscribers_leads",
      "promote_product_or_service", "increase_sales",
      "build_brand_authority", "improve_seo",
      "educate_audience", "generate_social_content",
    ];
    const validApproval = ["auto", "manual"];

    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const normalizedKey = key.toLowerCase().replace(/\s+/g, "_");
      if (!allowedFields.includes(normalizedKey) || value == null || value === "") continue;

      // Validate array fields against allowed enums
      if (normalizedKey === "article_styles" && Array.isArray(value)) {
        const filtered = value.map(String).filter(v => validArticleStyles.includes(v));
        if (filtered.length > 0) normalized[normalizedKey] = filtered;
      } else if (normalizedKey === "goals" && Array.isArray(value)) {
        const filtered = value.map(String).filter(v => validGoals.includes(v));
        if (filtered.length > 0) normalized[normalizedKey] = filtered;
      } else if (normalizedKey === "approval_preference") {
        const val = String(value).toLowerCase();
        if (validApproval.includes(val)) normalized[normalizedKey] = val;
      } else if (normalizedKey === "brand_color_hex") {
        // Ensure it's a valid hex colour
        const hex = String(value);
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) normalized[normalizedKey] = hex;
      } else {
        normalized[normalizedKey] = value;
      }
    }

    const fieldsPopulated = Object.keys(normalized).length;
    const coreFields = ["business_name", "business_description", "brand_color_hex", "article_styles", "goals"];
    const missingFields = coreFields.filter(f => !normalized[f]);

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[v0] ${sourceType} analysis error:`, err);
    return {
      status: "fail",
      message: `Analysis failed: ${message}`,
      error: message,
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
  _source: "website" | "file",
  _sourceUrl?: string
): Promise<void> {
  // Use admin client to bypass RLS
  const adminSb = await createAdminClient();

  // Extract and validate each field
  const getString = (key: string): string | null => {
    const v = data[key];
    if (v == null || v === "") return null;
    return typeof v === "string" ? v : String(v);
  };

  const getArray = (key: string): string[] | null => {
    const v = data[key];
    if (v == null) return null;
    if (Array.isArray(v)) {
      const arr = v.map(String).filter(Boolean);
      return arr.length > 0 ? arr : null;
    }
    if (typeof v === "string" && v.length > 0) {
      const arr = v.split(",").map((s: string) => s.trim()).filter(Boolean);
      return arr.length > 0 ? arr : null;
    }
    return null;
  };

  const rpcParams = {
    p_user_id: userId,
    p_business_name: getString("business_name"),
    p_business_description: getString("business_description"),
    p_brand_color_hex: getString("brand_color_hex"),
    p_article_styles: getArray("article_styles"),
    p_goals: getArray("goals"),
    p_content_language: getString("content_language"),
    p_website_or_landing_url: getString("website_or_landing_url"),
    p_product_or_sales_url: getString("product_or_sales_url"),
    p_approval_preference: getString("approval_preference"),
    p_additional_notes: getString("additional_notes"),
  };

  // Count non-null fields (excluding user_id)
  const fieldCount = Object.entries(rpcParams)
    .filter(([k, v]) => k !== "p_user_id" && v != null).length;

  if (fieldCount === 0) {
    console.warn("[v0] No valid fields to persist from autofill results");
    return;
  }

  console.log(`[v0] Persisting ${fieldCount} autofill fields via RPC for user ${userId}`);

  // Use the dedicated RPC function which handles text[] arrays natively
  const { error } = await adminSb.rpc("update_onboarding_autofill", rpcParams);

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
  debugData?: {
    promptSent?: string;
    responseReceived?: string;
    fieldsExtracted?: Record<string, unknown>;
  }
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
    debug_data: debugData || null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[v0] Failed to log autofill audit:", error);
  }
}
