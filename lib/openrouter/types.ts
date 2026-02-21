import { z } from "zod";

/**
 * Common response schemas for wizard auto-fill feature.
 */

// ============================================================================
// Website Investigation Response
// ============================================================================

export const websiteInvestigationSchema = z.object({
  business_name: z.string().nullable(),
  business_description: z.string().nullable(),
  website_url: z.string().url(),
  brand_color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  suggested_styles: z.array(z.string()).default([]),
  content_language: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  extraction_notes: z.string().optional(),
});

export type WebsiteInvestigationResult = z.infer<typeof websiteInvestigationSchema>;

// ============================================================================
// File Investigation Response
// ============================================================================

export const fileInvestigationSchema = z.object({
  business_name: z.string().nullable(),
  business_description: z.string().nullable(),
  brand_color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  suggested_styles: z.array(z.string()).default([]),
  content_language: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  extraction_notes: z.string().optional(),
});

export type FileInvestigationResult = z.infer<typeof fileInvestigationSchema>;

// ============================================================================
// Default Models
// ============================================================================

export const OPENROUTER_MODELS = {
  /** Fast, cost-effective, good for most tasks */
  DEFAULT: "openai/gpt-4o-mini",
  /** Most capable, more expensive */
  PREMIUM: "openai/gpt-4o",
  /** Alternative: Anthropic Claude */
  CLAUDE: "anthropic/claude-3.5-sonnet",
} as const;

export type OpenRouterModel = (typeof OPENROUTER_MODELS)[keyof typeof OPENROUTER_MODELS];
