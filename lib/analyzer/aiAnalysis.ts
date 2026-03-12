/**
 * ZARZOOM Social Profile Analyzer
 * OpenRouter AI Prompt + UI Contract Normalizer
 *
 * Loads the "SOCIAL_PROFILE_ANALYZER" prompt from the admin prompt settings
 * table (wizard_autofill_settings.social_profile_prompt) rather than
 * hard-coding the prompt here.  Falls back to DEFAULT_SOCIAL_PROFILE_PROMPT
 * if the DB row is absent or the column is null.
 *
 * Variable substitution uses {{double_braces}} to match the admin UI convention
 * and avoids conflicts with JavaScript template literals.
 *
 * Retry strategy:
 *   - callOpenRouterTyped already retries once on NETWORK_ERROR / TIMEOUT.
 *   - On a Zod schema validation failure (bad JSON shape) we manually retry
 *     once with a stricter "JSON only" reminder injected into the user message.
 *   - If the second attempt also fails we throw and the worker marks the
 *     analysis as `failed`.
 *
 * SERVER-ONLY — never import in client components.
 */

import { createClient } from "@supabase/supabase-js";
import { callOpenRouterTyped } from "@/lib/openrouter/client";
import { OpenRouterError } from "@/lib/openrouter/client";
import type { Instant, RawAiOutput, AnalysisResult } from "./types";
import { RawAiOutputSchema } from "./types";

// ============================================================================
// Default prompt — used when the DB row is missing or the column is null.
// Variables use {{double_braces}} to match the admin UI.
// ============================================================================

const DEFAULT_SOCIAL_PROFILE_PROMPT = `You are an elite social media growth strategist and content architect.

Analyse the social profile below and generate a deep strategic report.

Profile URL: {{profile_url}}
Platform: {{platform}}
Detected keywords / niche signals: {{keywords}}
Deterministic creator score (0-100): {{creator_score}}
Posting frequency estimate: {{posting_frequency_estimate}}
Strengths already identified: {{strengths}}
Opportunities already identified: {{opportunities}}

Return ONLY valid JSON — no markdown, no prose outside the JSON object — with this exact structure:

{
  "teaser": {
    "growth_insights": ["string (exactly 2 specific, actionable insights)"],
    "ai_post_preview": {
      "title": "string",
      "caption": "string (1-3 sentence caption tailored to platform and niche)",
      "hashtags": ["string (5-8 hashtags without the # symbol)"]
    },
    "benchmark_text": "string (one sentence comparing this profile to platform benchmarks)"
  },
  "full_report": {
    "creator_score_explanation": "string (2-3 sentences explaining the score)",
    "content_pillars": ["string (exactly 4 content categories this creator should own)"],
    "viral_post_ideas": [
      {
        "title": "string",
        "hook": "string (opening line that stops the scroll)",
        "description": "string (brief execution guide)"
      }
    ],
    "posting_schedule": {
      "posts_per_week": "string (e.g. '4-5')",
      "best_days": ["string (day names)"],
      "best_times": ["string (e.g. '7pm-9pm local time')"]
    },
    "growth_insights": ["string (exactly 4 specific, actionable growth tactics)"]
  },
  "creator_score_override": null,
  "creator_score_explanation": null
}

Rules:
- Be platform-specific (Instagram != TikTok != LinkedIn).
- Be niche-specific based on the detected keywords.
- viral_post_ideas: exactly 3 items.
- growth_insights in teaser: exactly 2 items.
- growth_insights in full_report: exactly 4 items.
- content_pillars: exactly 4 items.
- Do NOT fabricate follower counts or engagement rates.`;

// ============================================================================
// Prompt variable substitution
// ============================================================================

/**
 * Replaces all {{variable}} occurrences in a prompt template.
 * Unknown variables are left as-is so admins can audit substitution easily.
 */
function substituteVariables(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match;
  });
}

/**
 * Build the variable map from Instant engine output + raw profile URL.
 */
function buildPromptVariables(
  instant: Instant,
  profileUrl: string
): Record<string, string> {
  return {
    profile_url: profileUrl,
    platform: instant.platform_detected,
    keywords: instant.keywords_detected.length
      ? instant.keywords_detected.join(", ")
      : "none detected",
    creator_score: String(instant.creator_score),
    posting_frequency_estimate: instant.posting_frequency_estimate,
    strengths: instant.strengths.length
      ? instant.strengths.join("; ")
      : "none identified",
    opportunities: instant.opportunities.length
      ? instant.opportunities.join("; ")
      : "none identified",
  };
}

// ============================================================================
// Admin Supabase client
// ============================================================================

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// ============================================================================
// Prompt loader
// ============================================================================

interface PromptConfig {
  promptText: string;
  model: string;
  apiKey: string | null;
}

/**
 * Loads the SOCIAL_PROFILE_ANALYZER prompt from wizard_autofill_settings.
 * Falls back to DEFAULT_SOCIAL_PROFILE_PROMPT if missing.
 *
 * @throws if the OpenRouter API key is not configured (neither in DB nor env)
 */
async function loadPromptConfig(): Promise<PromptConfig> {
  const admin = getAdmin();

  const { data } = await admin
    .from("wizard_autofill_settings")
    .select("social_profile_prompt, openrouter_model, openrouter_api_key")
    .eq("id", 1)
    .maybeSingle();

  return {
    promptText: data?.social_profile_prompt ?? DEFAULT_SOCIAL_PROFILE_PROMPT,
    model: data?.openrouter_model ?? "openai/gpt-4o-mini",
    // env var takes precedence; DB key is the fallback
    apiKey: process.env.OPENROUTER_API_KEY ?? data?.openrouter_api_key ?? null,
  };
}

// ============================================================================
// Public API
// ============================================================================

export interface AiAnalysisResult {
  raw: RawAiOutput;
  tokensUsed: number;
  model: string;
  /** "first" | "retry" — which attempt succeeded */
  attempt: "first" | "retry";
}

/**
 * Run the AI analysis for a social profile.
 *
 * 1. Loads the admin-editable prompt from the DB (with {{variable}} substitution)
 * 2. Calls OpenRouter with model openai/gpt-4o-mini (or admin override)
 * 3. Validates the response against RawAiOutputSchema
 * 4. On Zod validation failure, retries ONCE with a stricter reminder
 * 5. Throws on second failure so the worker can mark the job as `failed`
 */
export async function runAiAnalysis(
  instant: Instant,
  profileUrl: string
): Promise<AiAnalysisResult> {
  const config = await loadPromptConfig();

  if (!config.apiKey) {
    throw new Error(
      "[aiAnalysis] OpenRouter API key is not configured. " +
        "Set OPENROUTER_API_KEY or configure it in Admin → OpenRouter Prompts."
    );
  }

  // Substitute {{variables}} in the admin-managed prompt
  const vars = buildPromptVariables(instant, profileUrl);
  const compiledPrompt = substituteVariables(config.promptText, vars);

  const systemPrompt = `You are an elite social media growth strategist.
Return ONLY valid JSON. No markdown, no code fences, no text outside the JSON object.`;

  const userMessage = compiledPrompt;

  // ── First attempt ────────────────────────────────────────────────────────
  try {
    const response = await callOpenRouterTyped(RawAiOutputSchema, {
      model: config.model,
      prompt: systemPrompt,
      input: userMessage,
      temperature: 0.5,
    });

    return {
      raw: response.data,
      tokensUsed: response.tokensUsed,
      model: response.model,
      attempt: "first",
    };
  } catch (firstErr) {
    const isSchemaError =
      firstErr instanceof OpenRouterError &&
      firstErr.code === "INVALID_RESPONSE";
    const isJsonError =
      firstErr instanceof OpenRouterError && firstErr.code === "INVALID_JSON";

    // Only retry on parse / schema validation failures
    if (!isSchemaError && !isJsonError) {
      throw firstErr;
    }

    console.warn(
      "[aiAnalysis] First attempt failed with parse/schema error, retrying once:",
      firstErr instanceof Error ? firstErr.message : firstErr
    );
  }

  // ── Retry with a stricter JSON-only reminder ──────────────────────────────
  const retryUserMessage = `${userMessage}

CRITICAL REMINDER: Your previous response could not be parsed as valid JSON.
You MUST return ONLY a raw JSON object. Do NOT wrap it in markdown. Do NOT add any text before or after the JSON.`;

  const response = await callOpenRouterTyped(RawAiOutputSchema, {
    model: config.model,
    prompt: systemPrompt,
    input: retryUserMessage,
    temperature: 0.2, // Lower temperature for more predictable JSON output
  });

  return {
    raw: response.data,
    tokensUsed: response.tokensUsed,
    model: response.model,
    attempt: "retry",
  };
}

// ============================================================================
// Normalizer — assembles the stable UI contract
// ============================================================================

/**
 * Merges instant engine output + raw AI output into the canonical
 * AnalysisResult that the UI renders. The UI must NEVER depend on raw AI output.
 */
export function normalizeToUiContract(
  analysisId: string,
  instant: Instant,
  raw: RawAiOutput
): AnalysisResult {
  // Allow AI to refine the creator score if it provides a valid non-zero override
  const finalScore =
    raw.creator_score_override != null && raw.creator_score_override > 0
      ? raw.creator_score_override
      : instant.creator_score;

  const finalInstant: Instant = {
    ...instant,
    creator_score: finalScore,
  };

  return {
    analysis_id: analysisId,
    status: "completed",
    instant: finalInstant,
    teaser: raw.teaser,
    full_report: {
      ...raw.full_report,
      // Prefer top-level AI explanation if present, fall back to nested field
      creator_score_explanation:
        raw.creator_score_explanation ||
        raw.full_report.creator_score_explanation,
    },
  };
}

// ============================================================================
// Prompt compilation example (exported for tests / admin preview)
// ============================================================================

/**
 * Returns a compiled prompt example for a given platform — useful for
 * the admin settings page to preview what will be sent to OpenRouter.
 *
 * @example
 * const preview = await buildPromptPreview("instagram", "https://instagram.com/example");
 */
export async function buildPromptPreview(
  platform: string,
  profileUrl: string
): Promise<{ compiled: string; model: string }> {
  const config = await loadPromptConfig();
  const exampleInstant: Instant = {
    platform_detected: platform,
    keywords_detected: ["fitness", "wellness", "nutrition"],
    posting_frequency_estimate: "high",
    creator_score: 72,
    strengths: ["Clear niche focus", "Consistent posting frequency"],
    opportunities: ["Add external link", "Extend bio with keywords"],
  };
  const vars = buildPromptVariables(exampleInstant, profileUrl);
  return {
    compiled: substituteVariables(config.promptText, vars),
    model: config.model,
  };
}
