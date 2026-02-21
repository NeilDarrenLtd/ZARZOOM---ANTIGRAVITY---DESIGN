import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  wizardAutoFillResponseSchema,
  validateAndNormalizeAutoFill,
  getPromptSchemaGuidance,
} from "@/lib/validation/wizardAutofillSchema";
import { mapAutoFillToOnboarding } from "@/lib/validation/wizardAutofillMapper";
import { openRouterClient } from "@/lib/openrouter";
import type { OnboardingUpdate } from "@/lib/validation/onboarding";

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
  updated_at: string | null;
  updated_by_user_id: string | null;
}

const DEFAULT_WEBSITE_PROMPT = `You are a brand analysis AI. Analyze the provided website content and extract structured brand information.

IMPORTANT: You MUST respond with ONLY valid JSON matching the schema provided. Do not include any explanatory text before or after the JSON.

Website Content:
{CONTENT}

Extract and return a JSON object following this structure:
{SCHEMA_GUIDANCE}

Focus on:
- Business name and description (short and long versions)
- Industry and target audience
- Tone of voice from the writing style
- Brand colors if visible in design
- Social media links found on the site
- Content style preferences based on existing content
- Any goals or value propositions mentioned

Be conservative - only include fields you're confident about. Mark your confidence level in the metadata section.`;

const DEFAULT_FILE_PROMPT = `You are a brand analysis AI. Analyze the provided document content and extract structured brand information.

IMPORTANT: You MUST respond with ONLY valid JSON matching the schema provided. Do not include any explanatory text before or after the JSON.

Document Content:
{CONTENT}

Extract and return a JSON object following this structure:
{SCHEMA_GUIDANCE}

Look for:
- Company/brand name and descriptions
- Mission, vision, values statements
- Target audience and market positioning
- Product/service descriptions
- Brand guidelines (colors, tone, style)
- Business goals and objectives
- Contact information and social links

Be conservative - only include fields you're confident about. Mark your confidence level in the metadata section.`;

export async function getPromptSettings(
  supabase: SupabaseClient
): Promise<PromptSettings> {
  const { data, error } = await supabase
    .from("wizard_autofill_settings")
    .select("website_prompt_text, file_prompt_text, updated_at, updated_by_user_id")
    .single();

  if (error || !data) {
    console.warn(
      "[autofillServer] Failed to load prompt settings, using defaults:",
      error?.message
    );
    return {
      website_prompt_text: DEFAULT_WEBSITE_PROMPT,
      file_prompt_text: DEFAULT_FILE_PROMPT,
      updated_at: null,
      updated_by_user_id: null,
    };
  }

  return {
    website_prompt_text: data.website_prompt_text || DEFAULT_WEBSITE_PROMPT,
    file_prompt_text: data.file_prompt_text || DEFAULT_FILE_PROMPT,
    updated_at: data.updated_at,
    updated_by_user_id: data.updated_by_user_id,
  };
}

// ──────────────────────────────────────────────
// OpenRouter Analysis
// ──────────────────────────────────────────────

export interface AnalysisResult {
  status: "success" | "partial" | "fail";
  data?: OnboardingUpdate;
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

    // Prepare the prompt
    const schemaGuidance = getPromptSchemaGuidance();
    const prompt = promptTemplate
      .replace("{CONTENT}", content.slice(0, 30000)) // Limit content to 30k chars
      .replace("{SCHEMA_GUIDANCE}", schemaGuidance);

    console.log(`[v0] Prompt length: ${prompt.length} characters`);

    // Call OpenRouter with JSON mode
    const response = await openRouterClient.chatCompletion(
      [
        {
          role: "system",
          content:
            "You are a precise brand analysis AI. Extract brand information and respond with ONLY valid JSON matching the provided schema. Do not include markdown formatting or explanatory text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      {
        temperature: 0.3, // Lower temperature for more consistent extraction
        maxTokens: 3000,
      }
    );

    console.log("[v0] OpenRouter response received");

    if (!response.content) {
      throw new Error("Empty response from OpenRouter");
    }

    // Parse and validate the JSON response
    const parsed = wizardAutoFillResponseSchema.safeParse(response.content);

    if (!parsed.success) {
      console.error("[v0] Validation failed:", parsed.error.issues);
      return {
        status: "fail",
        message: "Failed to parse AI response into valid schema",
        error: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    // Normalize and check completeness
    const validation = validateAndNormalizeAutoFill(parsed.data);

    // Map to onboarding schema
    const onboardingData = mapAutoFillToOnboarding(validation.data);

    console.log(
      `[v0] Analysis complete. Fields populated: ${Object.keys(onboardingData).length}, Missing: ${validation.missingFields.length}`
    );

    return {
      status: validation.isPartial ? "partial" : "success",
      data: onboardingData,
      missingFields: validation.missingFields,
      confidence: validation.data.metadata?.confidence_by_section,
      message: validation.isPartial
        ? `Successfully extracted ${Object.keys(onboardingData).length} fields. Some fields could not be determined from the ${sourceType}.`
        : `Successfully extracted all available information from the ${sourceType}.`,
    };
  } catch (error) {
    console.error(`[v0] ${sourceType} analysis error:`, error);
    return {
      status: "fail",
      message: `Failed to analyze ${sourceType} content`,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ──────────────────────────────────────────────
// Persistence & Audit
// ──────────────────────────────────────────────

export async function persistAutofillResults(
  supabase: SupabaseClient,
  userId: string,
  onboardingData: OnboardingUpdate,
  sourceType: "website" | "file",
  sourceValue: string
): Promise<void> {
  console.log(`[v0] Persisting ${Object.keys(onboardingData).length} fields to onboarding_profiles...`);

  // Update the onboarding profile with AI-filled data
  const { error: updateError } = await supabase
    .from("onboarding_profiles")
    .update({
      ...onboardingData,
      ai_filled: true,
      ai_filled_source: sourceType,
      ai_filled_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateError) {
    // If no profile exists, create one
    if (updateError.code === "PGRST116") {
      const { error: insertError } = await supabase
        .from("onboarding_profiles")
        .insert({
          user_id: userId,
          ...onboardingData,
          ai_filled: true,
          ai_filled_source: sourceType,
          ai_filled_at: new Date().toISOString(),
          onboarding_status: "in_progress",
        });

      if (insertError) {
        throw new Error(
          `Failed to create onboarding profile: ${insertError.message}`
        );
      }
    } else {
      throw new Error(
        `Failed to update onboarding profile: ${updateError.message}`
      );
    }
  }

  console.log("[v0] Persisted successfully");
}

export async function logAutofillAudit(
  supabase: SupabaseClient,
  userId: string,
  sourceType: "website" | "file",
  sourceValue: string,
  status: "success" | "partial" | "fail",
  errorMessage?: string,
  fieldsPopulated?: number,
  confidenceScores?: Record<string, number>
): Promise<void> {
  console.log(`[v0] Logging audit: ${status} for ${sourceType}`);

  // Sanitize error message to avoid logging secrets
  let sanitizedError = errorMessage || null;
  if (sanitizedError) {
    // Remove potential API keys, tokens, passwords
    sanitizedError = sanitizedError
      .replace(/api[_-]?key[:\s=]+[a-zA-Z0-9_-]+/gi, "api_key=[REDACTED]")
      .replace(/bearer\s+[a-zA-Z0-9_-]+/gi, "bearer [REDACTED]")
      .replace(/token[:\s=]+[a-zA-Z0-9_-]+/gi, "token=[REDACTED]")
      .replace(/password[:\s=]+[^\s]+/gi, "password=[REDACTED]")
      .replace(/secret[:\s=]+[a-zA-Z0-9_-]+/gi, "secret=[REDACTED]");
    
    // Truncate very long error messages
    if (sanitizedError.length > 500) {
      sanitizedError = sanitizedError.slice(0, 497) + "...";
    }
  }

  // Sanitize source value (URL or filename) to prevent storing PII
  let sanitizedSource = sourceValue;
  if (sourceType === "website") {
    try {
      const url = new URL(sourceValue);
      // Remove query parameters that might contain tokens
      sanitizedSource = `${url.protocol}//${url.hostname}${url.pathname}`;
    } catch {
      // Keep as-is if not a valid URL
    }
  }

  const { error } = await supabase.from("wizard_autofill_audit").insert({
    user_id: userId,
    source_type: sourceType,
    source_value: sanitizedSource,
    status,
    error_message: sanitizedError,
    fields_populated: fieldsPopulated || 0,
    confidence_scores: confidenceScores || null,
  });

  if (error) {
    console.error("[v0] Failed to log audit:", error.message);
    // Don't throw - audit logging failure shouldn't break the main flow
  }
}
