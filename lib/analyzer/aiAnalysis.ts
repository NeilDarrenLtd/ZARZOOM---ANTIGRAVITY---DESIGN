/**
 * ZARZOOM Social Profile Analyzer
 * OpenRouter AI Prompt + UI Contract Normalizer
 *
 * Reuses the existing callOpenRouterTyped infrastructure.
 * Retries once on JSON parse failure (MAX_RETRIES=1 is already in the client).
 *
 * SERVER-ONLY — never import in client components.
 */

import { callOpenRouterTyped } from "@/lib/openrouter/client";
import { OPENROUTER_MODELS } from "@/lib/openrouter/types";
import type { Instant, RawAiOutput, AnalysisResult } from "./types";
import { RawAiOutputSchema } from "./types";

// ============================================================================
// System prompt
// ============================================================================

const SYSTEM_PROMPT = `You are an elite social media growth strategist and content architect.

You will receive:
1. A social media profile URL
2. Platform detected
3. Keywords detected from the handle
4. A deterministic creator score (0-100)
5. Platform strengths and opportunities already identified

Your task: generate a deep AI analysis that builds on this foundation.

Return ONLY valid JSON with this exact structure — no markdown, no prose outside JSON:

{
  "teaser": {
    "growth_insights": ["string (2-3 specific insights)"],
    "ai_post_preview": {
      "title": "string (post title)",
      "caption": "string (1-3 sentence post caption tailored to platform and niche)",
      "hashtags": ["string (5-8 relevant hashtags without #)"]
    },
    "benchmark_text": "string (one sentence comparing this profile to platform benchmarks)"
  },
  "full_report": {
    "creator_score_explanation": "string (2-3 sentences explaining the score)",
    "content_pillars": ["string (3-5 content categories this creator should own)"],
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
    "growth_insights": ["string (3-5 specific, actionable growth tactics)"]
  },
  "creator_score_override": null,
  "creator_score_explanation": null
}

Rules:
- Be platform-specific. Instagram advice != TikTok advice.
- Be niche-specific based on keywords. Fitness advice != Finance advice.
- viral_post_ideas must have exactly 3 items.
- growth_insights in teaser: exactly 2 items.
- growth_insights in full_report: exactly 4 items.
- content_pillars: exactly 4 items.
- All text must feel premium, strategic, and data-driven.
- Do NOT make up follower counts or engagement rates you cannot know.`;

// ============================================================================
// JSON schema hint for the prompt
// ============================================================================

const JSON_SCHEMA_HINT = `{
  "teaser": {
    "growth_insights": ["string"],
    "ai_post_preview": { "title": "string", "caption": "string", "hashtags": ["string"] },
    "benchmark_text": "string"
  },
  "full_report": {
    "creator_score_explanation": "string",
    "content_pillars": ["string"],
    "viral_post_ideas": [{ "title": "string", "hook": "string", "description": "string" }],
    "posting_schedule": { "posts_per_week": "string", "best_days": ["string"], "best_times": ["string"] },
    "growth_insights": ["string"]
  }
}`;

// ============================================================================
// Call AI
// ============================================================================

export interface AiAnalysisResult {
  raw: RawAiOutput;
  tokensUsed: number;
  model: string;
}

export async function runAiAnalysis(
  instant: Instant,
  profileUrl: string
): Promise<AiAnalysisResult> {
  const userInput = `Profile URL: ${profileUrl}
Platform: ${instant.platform_detected}
Handle keywords: ${instant.keywords_detected.join(", ") || "none detected"}
Creator score (deterministic): ${instant.creator_score}/100
Strengths identified: ${instant.strengths.join("; ")}
Opportunities identified: ${instant.opportunities.join("; ")}

Generate the full AI analysis now.`;

  const response = await callOpenRouterTyped(RawAiOutputSchema, {
    model: OPENROUTER_MODELS.DEFAULT,
    prompt: SYSTEM_PROMPT,
    input: userInput,
    jsonSchemaHint: JSON_SCHEMA_HINT,
    temperature: 0.5,
  });

  return {
    raw: response.data,
    tokensUsed: response.tokensUsed,
    model: response.model,
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
  // Allow AI to override the creator score if it provides a valid value
  const finalScore =
    raw.creator_score_override != null &&
    raw.creator_score_override > 0
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
      // Prefer AI explanation if provided, otherwise use raw field
      creator_score_explanation:
        raw.creator_score_explanation ||
        raw.full_report.creator_score_explanation,
    },
  };
}
