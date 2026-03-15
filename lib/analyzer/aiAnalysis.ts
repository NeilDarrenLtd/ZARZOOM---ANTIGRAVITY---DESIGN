/**
 * ZARZOOM Social Profile Analyzer
 * OpenRouter AI Prompt + UI Contract Normalizer
 *
 * Loads the admin prompt named "Social Profile Investigation prompt" from
 * Admin settings → OpenRouter prompts (stored in wizard_autofill_settings
 * .social_profile_prompt, singleton row id=1). Fetched dynamically on each
 * run. Falls back to DEFAULT_SOCIAL_PROFILE_PROMPT only when the column is null.
 */
export const ANALYZER_ADMIN_PROMPT_NAME = "Social Profile Investigation prompt" as const;

/**
 * Variable substitution uses [SQUARE-BRACKET] syntax to match the admin UI
 * convention (e.g. [PROFILE-URL], [PLATFORM]).
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
import { AnalyzerOpenRouterSchema } from "./types";
import { logActivity } from "@/lib/logging/activity";

// ============================================================================
// Default prompt — used when the DB row is missing or the column is null.
// Variables use [SQUARE-BRACKET] syntax to match the admin UI.
// ============================================================================

const DEFAULT_SOCIAL_PROFILE_PROMPT = `You are an elite social media growth strategist and content architect.

Analyse the social profile below and generate a deep strategic report.

Profile URL: [PROFILE-URL]
Platform: [PLATFORM]

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
- Be niche-specific based on the profile content.
- viral_post_ideas: exactly 3 items.
- growth_insights in teaser: exactly 2 items.
- growth_insights in full_report: exactly 4 items.
- content_pillars: exactly 4 items.
- Do NOT fabricate follower counts or engagement rates.`;

// ============================================================================
// Prompt variable substitution
// ============================================================================

/**
 * Replaces all [VARIABLE-NAME] occurrences in a prompt template.
 * Unknown variables are left as-is so admins can audit substitution easily.
 */
function substituteVariables(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\[([A-Z][A-Z0-9-]*)\]/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match;
  });
}

/**
 * Build the variable map substituted into the admin-managed prompt.
 * Keys must match the [SQUARE-BRACKET] placeholders exactly.
 */
function buildPromptVariables(
  instant: Instant,
  profileUrl: string
): Record<string, string> {
  return {
    "PROFILE-URL": profileUrl,
    "PLATFORM": instant.platform_detected,
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
  keySource: "env" | "db" | "none";
}

/**
 * Loads the "Social Profile Investigation prompt" from Admin → OpenRouter prompts
 * (wizard_autofill_settings.social_profile_prompt, row id=1). No hardcoded prompt
 * overrides the DB value when present; DEFAULT_SOCIAL_PROFILE_PROMPT is used only
 * when the column is null.
 *
 * @throws if the OpenRouter API key is not configured (neither in DB nor env)
 */
async function loadPromptConfig(): Promise<PromptConfig> {
  const admin = getAdmin();

  const FALLBACK_MODEL = "openai/gpt-4o-mini";

  const { data } = await admin
    .from("wizard_autofill_settings")
    .select("social_profile_prompt, openrouter_model, social_profile_model, openrouter_api_key")
    .eq("id", 1)
    .maybeSingle();

  const promptText = data?.social_profile_prompt ?? DEFAULT_SOCIAL_PROFILE_PROMPT;
  const perPromptModel = data?.social_profile_model ?? null;
  const defaultModel = data?.openrouter_model ?? FALLBACK_MODEL;
  const model = perPromptModel || defaultModel;
  const envKey = process.env.OPENROUTER_API_KEY;
  const dbKey = data?.openrouter_api_key ?? null;
  const apiKey = envKey ?? dbKey ?? null;
  const keySource: "env" | "db" | "none" = envKey ? "env" : dbKey ? "db" : "none";

  if (perPromptModel) {
    console.log("[aiAnalysis] Using per-prompt model for social profile:", perPromptModel);
  } else {
    console.log("[aiAnalysis] Using default model for social profile:", model);
  }

  console.log("[aiAnalysis] Loaded OpenRouter prompt config", {
    hasDbRow: !!data,
    model,
    keySource,
  });

  return { promptText, model, apiKey, keySource };
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
 * 1. Loads the admin-editable prompt from the DB (with [VARIABLE] substitution)
 * 2. Calls OpenRouter with model openai/gpt-4o-mini (or admin override)
 * 3. Validates the response against AnalyzerOpenRouterSchema (flat or nested → RawAiOutput)
 * 4. On Zod validation failure, retries ONCE with a stricter reminder
 * 5. Throws on second failure so the worker can mark the job as `failed`
 */
export async function runAiAnalysis(
  instant: Instant,
  profileUrl: string,
  analysisId?: string
): Promise<AiAnalysisResult> {
  let config: Awaited<ReturnType<typeof loadPromptConfig>>;
  try {
    config = await loadPromptConfig();
  } catch (configErr) {
    void logActivity({
      category: "analyzer",
      stage: "**FAILURE** analyzer_prompt_config_load_failed",
      level: "error",
      analysisId,
      profileUrl,
      platform: instant.platform_detected,
      details: {
        reason: "prompt_config_load_failed",
        profileUrl,
        platform: instant.platform_detected,
        analysisId: analysisId ?? null,
        error_message: configErr instanceof Error ? configErr.message : String(configErr),
      },
    });
    throw configErr;
  }

  // ──── TEMPORARY DEBUG CHECKPOINT ────
  console.log("🔴 [3] FLOATING_ANALYZER_PROMPT_LOADED", {
    analysisId,
    profileUrl,
    platform: instant.platform_detected,
    model: config.model,
    keySource: config.keySource,
    promptLength: config.promptText.length,
    promptFirst80: config.promptText.substring(0, 80),
    timestamp: new Date().toISOString(),
  });
  // ──── END TEMPORARY DEBUG CHECKPOINT ────

  if (!config.apiKey) {
    void logActivity({
      category: "analyzer",
      stage: "**FAILURE** analyzer_no_openrouter_api_key",
      level: "error",
      analysisId,
      profileUrl,
      platform: instant.platform_detected,
      details: {
        reason: "no_api_key",
        profileUrl,
        platform: instant.platform_detected,
        analysisId: analysisId ?? null,
      },
    });
    throw new Error(
      "[aiAnalysis] OpenRouter API key is not configured. " +
        "Set OPENROUTER_API_KEY or configure it in Admin → OpenRouter Prompts."
    );
  }

  // Substitute [VARIABLES] in the admin-managed prompt
  const vars = buildPromptVariables(instant, profileUrl);
  const compiledPrompt = substituteVariables(config.promptText, vars);

  const systemPrompt = `You are an elite social media growth strategist.
Return ONLY valid JSON. No markdown, no code fences, no text outside the JSON object.`;

  const userMessage = compiledPrompt;

  void logActivity({
    category: "analyzer",
    stage: "**OPENROUTER** analyzer_prompt_input",
    level: "info",
    analysisId,
    profileUrl,
    platform: instant.platform_detected,
    details: {
      profile_url: profileUrl,
      platform: instant.platform_detected,
      variables_substituted: vars,
      final_prompt_text: compiledPrompt,
    },
  });

  // ── First attempt ────────────────────────────────────────────────────────
  try {
    const response = await callOpenRouterTyped(AnalyzerOpenRouterSchema, {
      model: config.model,
      prompt: systemPrompt,
      input: userMessage,
      temperature: 0.5,
      apiKeyOverride: config.apiKey ?? undefined,
    });

    const result: AiAnalysisResult = {
      raw: response.data,
      tokensUsed: response.tokensUsed,
      model: response.model,
      attempt: "first",
    };
    void logActivity({
      category: "analyzer",
      stage: "analyzer.openrouter_success",
      level: "info",
      analysisId,
      profileUrl,
      platform: instant.platform_detected,
      details: {
        attempt: "first",
        tokensUsed: result.tokensUsed,
        model: result.model,
        raw_keys: Object.keys(result.raw),
        growth_insights_count: result.raw.growth_insights?.length ?? 0,
        /** Full response from OpenRouter (parsed, same as stored in analysis_cache.analysis_json) */
        openrouter_full_response: result.raw,
      },
    });
    return result;
  } catch (firstErr) {
    const isSchemaError =
      firstErr instanceof OpenRouterError &&
      firstErr.code === "INVALID_RESPONSE";
    const isJsonError =
      firstErr instanceof OpenRouterError && firstErr.code === "INVALID_JSON";

    // Only retry on parse / schema validation failures
    if (!isSchemaError && !isJsonError) {
      void logActivity({
        category: "analyzer",
        stage: "**FAILURE** analyzer_openrouter_call_failed",
        level: "error",
        analysisId,
        profileUrl,
        platform: instant.platform_detected,
        details: {
          reason: "openrouter_call_failed",
          attempt: "first",
          profileUrl,
          platform: instant.platform_detected,
          analysisId: analysisId ?? null,
          error_message: firstErr instanceof Error ? firstErr.message : String(firstErr),
        },
      });
      throw firstErr;
    }

  }

  // ── Retry with a stricter JSON-only reminder ──────────────────────────────
  const retryUserMessage = `${userMessage}

CRITICAL REMINDER: Your previous response could not be parsed as valid JSON.
You MUST return ONLY a raw JSON object. Do NOT wrap it in markdown. Do NOT add any text before or after the JSON.`;

  void logActivity({
    category: "analyzer",
    stage: "**OPENROUTER** analyzer_prompt_sent_to_openrouter",
    level: "info",
    analysisId,
    profileUrl,
    platform: instant.platform_detected,
    details: {
      attempt: "retry",
      model: config.model,
      final_prompt: retryUserMessage,
    },
  });

  try {
    const response = await callOpenRouterTyped(AnalyzerOpenRouterSchema, {
      model: config.model,
      prompt: systemPrompt,
      input: retryUserMessage,
      temperature: 0.2,
      apiKeyOverride: config.apiKey ?? undefined,
    });

    const result: AiAnalysisResult = {
      raw: response.data,
      tokensUsed: response.tokensUsed,
      model: response.model,
      attempt: "retry",
    };
    void logActivity({
      category: "analyzer",
      stage: "analyzer.openrouter_success",
      level: "info",
      analysisId,
      profileUrl,
      platform: instant.platform_detected,
      details: {
        attempt: "retry",
        tokensUsed: result.tokensUsed,
        model: result.model,
        raw_keys: Object.keys(result.raw),
        growth_insights_count: result.raw.growth_insights?.length ?? 0,
        /** Full response from OpenRouter (parsed, same as stored in analysis_cache.analysis_json) */
        openrouter_full_response: result.raw,
      },
    });
    return result;
  } catch (retryErr) {
    void logActivity({
      category: "analyzer",
      stage: "**FAILURE** analyzer_openrouter_call_failed",
      level: "error",
      analysisId,
      profileUrl,
      platform: instant.platform_detected,
      details: {
        reason: "openrouter_call_failed",
        attempt: "retry",
        profileUrl,
        platform: instant.platform_detected,
        analysisId: analysisId ?? null,
        error_message: retryErr instanceof Error ? retryErr.message : String(retryErr),
      },
    });
    throw retryErr;
  }
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

  const teaserGrowthInsights =
    raw.teaser_growth_insights && raw.teaser_growth_insights.length > 0
      ? raw.teaser_growth_insights
      : raw.growth_insights.slice(0, 2);
  const teaser = {
    growth_insights: teaserGrowthInsights,
    ai_post_preview: raw.ai_post_preview,
    benchmark_text: raw.benchmark_ranking.description,
  };

  const fullReport = {
    creator_score_explanation: raw.creator_score_explanation,
    content_pillars: raw.content_pillars,
    viral_post_ideas: raw.viral_post_ideas,
    posting_schedule: raw.posting_schedule,
    growth_insights: raw.growth_insights,
  };

  const normalized: AnalysisResult = {
    analysis_id: analysisId,
    status: "completed",
    instant: finalInstant,
    teaser,
    full_report: fullReport,
  };

  return normalized;
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
