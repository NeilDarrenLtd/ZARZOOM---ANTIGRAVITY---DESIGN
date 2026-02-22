import { createClient } from "@/lib/supabase/server";
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

const DEFAULT_WEBSITE_PROMPT = `Analyze the website content and extract brand information as JSON.`;
const DEFAULT_FILE_PROMPT = `Analyze the document content and extract brand information as JSON.`;

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
  message: string;
  error?: string;
}

export async function analyzeContentWithOpenRouter(
  promptTemplate: string,
  content: string,
  sourceType: "website" | "file"
): Promise<AnalysisResult> {
  try {
    console.log(`[v0] Starting ${sourceType} analysis with OpenRouter...`);

    // Get OpenRouter credentials from settings
    const supabase = await createClient();
    const settings = await getPromptSettings(supabase);

    if (!settings.openrouter_api_key) {
      console.warn("[v0] No OpenRouter API key configured");
      return {
        status: "fail",
        message: "OpenRouter API key not configured. Please add it in Admin > OpenRouter Prompts.",
        error: "missing_api_key",
      };
    }

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
            content: "You are a brand analysis AI. Extract structured information and respond with ONLY valid JSON.",
          },
          {
            role: "user",
            content: `${promptTemplate}\n\n${content.slice(0, 30000)}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[v0] OpenRouter API error:", response.status, errorText);
      return {
        status: "fail",
        message: `OpenRouter API error: ${response.status}`,
        error: errorText,
      };
    }

    const result = await response.json();
    const aiText = result.choices?.[0]?.message?.content;

    if (!aiText) {
      return {
        status: "fail",
        message: "OpenRouter returned empty response",
        error: "empty_response",
      };
    }

    // Parse JSON response
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(aiText);
    } catch (err) {
      console.error("[v0] Failed to parse OpenRouter JSON:", err);
      return {
        status: "fail",
        message: "Failed to parse AI response as JSON",
        error: "invalid_json",
      };
    }

    console.log(`[v0] OpenRouter analysis complete, extracted ${Object.keys(parsed).length} fields`);

    return {
      status: "success",
      data: parsed,
      missingFields: [],
      message: `Successfully analyzed ${sourceType}`,
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
  supabase: SupabaseClient,
  userId: string,
  data: Record<string, unknown>,
  source: "website" | "file",
  sourceUrl?: string
): Promise<void> {
  // Update onboarding_profiles with extracted data
  const { error } = await supabase
    .from("onboarding_profiles")
    .upsert(
      {
        user_id: userId,
        ...data,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

  if (error) {
    console.error("[v0] Failed to persist autofill results:", error);
    throw new Error(`Failed to save results: ${error.message}`);
  }

  console.log(`[v0] Persisted autofill results for user ${userId}`);
}

// ──────────────────────────────────────────────
// Audit Logging
// ──────────────────────────────────────────────

export async function logAutofillAudit(
  supabase: SupabaseClient,
  userId: string,
  source: "website" | "file",
  sourceIdentifier: string,
  status: string,
  errorMessage?: string,
  fieldsPopulated?: number,
  confidence?: Record<string, number>
): Promise<void> {
  const { error } = await supabase.from("wizard_autofill_audit").insert({
    user_id: userId,
    source_type: source,
    source_identifier: sourceIdentifier,
    status,
    error_message: errorMessage || null,
    fields_populated: fieldsPopulated || 0,
    confidence_scores: confidence || null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[v0] Failed to log autofill audit:", error);
  }
}
