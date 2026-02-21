import { z } from "zod";
import {
  GOAL_OPTIONS,
  ARTICLE_STYLE_OPTIONS,
  PLAN_OPTIONS,
  APPROVAL_OPTIONS,
} from "./onboarding";

// ──────────────────────────────────────────────
// Wizard Auto-Fill Schema
// Used by OpenRouter AI to extract brand information
// from website scraping or file analysis
// ──────────────────────────────────────────────

/**
 * Brand section schema - extracted from website/file
 */
export const wizardAutoFillBrandSchema = z.object({
  business_name: z.string().min(1).max(200).optional(),
  short_description: z.string().min(10).max(280).optional(), // Tweet-length summary
  long_description: z.string().min(20).max(2000).optional(), // Full description
  industry: z.string().min(2).max(100).optional(), // e.g. "Technology", "Healthcare"
  tone_voice: z
    .enum([
      "professional",
      "casual",
      "friendly",
      "authoritative",
      "playful",
      "inspirational",
      "educational",
      "conversational",
    ])
    .optional(),
  target_audience: z.string().min(5).max(500).optional(), // e.g. "Small business owners aged 30-50"
  location: z.string().max(200).optional(), // e.g. "London, UK" or "United States"
  website: z.string().url().optional(),
  brand_colours: z
    .array(
      z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, "Must be valid hex color like #FF5500")
    )
    .max(5)
    .optional(), // Primary brand colors
  social_links: z
    .object({
      facebook: z.string().url().optional(),
      twitter: z.string().url().optional(),
      linkedin: z.string().url().optional(),
      instagram: z.string().url().optional(),
      youtube: z.string().url().optional(),
      tiktok: z.string().url().optional(),
    })
    .optional(),
  content_language: z.string().min(2).max(10).optional(), // e.g. "en", "es", "fr"
  article_styles: z.array(z.enum(ARTICLE_STYLE_OPTIONS)).max(5).optional(),
  style_reference_links: z.array(z.string().url()).max(3).optional(),
  logo_guidance: z.string().max(500).optional(), // Description of logo if found
});

/**
 * Goals section schema - inferred from business description
 */
export const wizardAutoFillGoalsSchema = z.object({
  primary_goals: z.array(z.enum(GOAL_OPTIONS)).max(3).optional(),
  secondary_goals: z.array(z.enum(GOAL_OPTIONS)).max(3).optional(),
  target_platforms: z
    .array(
      z.enum([
        "facebook",
        "twitter",
        "linkedin",
        "instagram",
        "youtube",
        "tiktok",
        "blog",
      ])
    )
    .max(5)
    .optional(),
  posting_frequency: z
    .enum(["daily", "3_per_week", "weekly", "bi_weekly", "monthly"])
    .optional(),
  kpis: z
    .array(
      z.enum([
        "traffic",
        "conversions",
        "engagement",
        "followers",
        "revenue",
        "brand_awareness",
      ])
    )
    .max(4)
    .optional(),
});

/**
 * Plan section schema - AI recommendation based on size/goals
 */
export const wizardAutoFillPlanSchema = z.object({
  suggested_tier: z.enum(PLAN_OPTIONS).optional(),
  cadence_recommendation: z
    .enum(["daily", "3_per_week", "weekly", "bi_weekly", "monthly"])
    .optional(),
  approvals_workflow: z.enum(APPROVAL_OPTIONS).optional(),
  collaboration_notes: z.string().max(500).optional(), // e.g. "Seems like a team of 3-5"
});

/**
 * Connect section schema - inferred social accounts
 */
export const wizardAutoFillConnectSchema = z.object({
  required_social_accounts: z
    .array(
      z.enum([
        "facebook",
        "twitter",
        "linkedin",
        "instagram",
        "youtube",
        "tiktok",
      ])
    )
    .optional(),
  onboarding_notes: z.string().max(500).optional(), // Additional guidance
});

/**
 * Metadata schema - extraction confidence and notes
 */
export const wizardAutoFillMetadataSchema = z.object({
  confidence_by_section: z
    .object({
      brand: z.enum(["high", "medium", "low"]).optional(),
      goals: z.enum(["high", "medium", "low"]).optional(),
      plan: z.enum(["high", "medium", "low"]).optional(),
      connect: z.enum(["high", "medium", "low"]).optional(),
    })
    .optional(),
  missing_fields: z.array(z.string()).optional(), // e.g. ["logo_guidance", "brand_colours"]
  extraction_notes: z.string().max(1000).optional(), // Internal notes about extraction
  source_type: z.enum(["website", "file"]).optional(),
  extracted_at: z.string().datetime().optional(),
});

/**
 * Complete wizard auto-fill payload schema
 */
export const wizardAutoFillSchema = z.object({
  brand: wizardAutoFillBrandSchema.optional(),
  goals: wizardAutoFillGoalsSchema.optional(),
  plan: wizardAutoFillPlanSchema.optional(),
  connect: wizardAutoFillConnectSchema.optional(),
  metadata: wizardAutoFillMetadataSchema.optional(),
});

/**
 * Validation result type
 */
export type WizardAutoFillValidationResult = {
  success: boolean;
  data?: WizardAutoFillPayload;
  isPartial: boolean;
  missingFields: string[];
  errors?: z.ZodError;
};

/**
 * Type exports
 */
export type WizardAutoFillPayload = z.infer<typeof wizardAutoFillSchema>;
export type WizardAutoFillBrand = z.infer<typeof wizardAutoFillBrandSchema>;
export type WizardAutoFillGoals = z.infer<typeof wizardAutoFillGoalsSchema>;
export type WizardAutoFillPlan = z.infer<typeof wizardAutoFillPlanSchema>;
export type WizardAutoFillConnect = z.infer<typeof wizardAutoFillConnectSchema>;
export type WizardAutoFillMetadata = z.infer<
  typeof wizardAutoFillMetadataSchema
>;

// ──────────────────────────────────────────────
// Validation & Normalization Function
// ──────────────────────────────────────────────

/**
 * Validates and normalizes AI-extracted wizard data
 *
 * @param payload - Raw payload from OpenRouter LLM
 * @returns Validation result with success status, normalized data, and metadata
 *
 * @example
 * const result = validateAndNormaliseAutoFill(aiResponse);
 * if (result.success) {
 *   console.log('Extracted data:', result.data);
 *   if (result.isPartial) {
 *     console.log('Missing:', result.missingFields);
 *   }
 * }
 */
export function validateAndNormaliseAutoFill(
  payload: unknown
): WizardAutoFillValidationResult {
  // Validate against schema
  const parseResult = wizardAutoFillSchema.safeParse(payload);

  if (!parseResult.success) {
    return {
      success: false,
      isPartial: true,
      missingFields: [],
      errors: parseResult.error,
    };
  }

  const data = parseResult.data;

  // Determine if this is a partial extraction
  const allPossibleFields: string[] = [];
  const extractedFields: string[] = [];

  // Check brand section
  const brandFields = [
    "business_name",
    "short_description",
    "long_description",
    "industry",
    "tone_voice",
    "target_audience",
    "website",
    "brand_colours",
    "content_language",
    "article_styles",
  ];

  brandFields.forEach((field) => {
    allPossibleFields.push(`brand.${field}`);
    if (data.brand && (data.brand as any)[field]) {
      extractedFields.push(`brand.${field}`);
    }
  });

  // Check goals section
  const goalsFields = [
    "primary_goals",
    "target_platforms",
    "posting_frequency",
    "kpis",
  ];

  goalsFields.forEach((field) => {
    allPossibleFields.push(`goals.${field}`);
    if (data.goals && (data.goals as any)[field]) {
      extractedFields.push(`goals.${field}`);
    }
  });

  // Check plan section
  const planFields = [
    "suggested_tier",
    "cadence_recommendation",
    "approvals_workflow",
  ];

  planFields.forEach((field) => {
    allPossibleFields.push(`plan.${field}`);
    if (data.plan && (data.plan as any)[field]) {
      extractedFields.push(`plan.${field}`);
    }
  });

  // Check connect section
  const connectFields = ["required_social_accounts"];

  connectFields.forEach((field) => {
    allPossibleFields.push(`connect.${field}`);
    if (data.connect && (data.connect as any)[field]) {
      extractedFields.push(`connect.${field}`);
    }
  });

  // Calculate missing fields
  const missingFields = allPossibleFields.filter(
    (field) => !extractedFields.includes(field)
  );

  // Use metadata if provided, otherwise calculate
  const providedMissingFields = data.metadata?.missing_fields || [];
  const finalMissingFields =
    providedMissingFields.length > 0 ? providedMissingFields : missingFields;

  // Consider extraction partial if more than 30% of fields are missing
  // OR if metadata explicitly indicates low confidence
  const extractionRate = extractedFields.length / allPossibleFields.length;
  const hasLowConfidence =
    data.metadata?.confidence_by_section?.brand === "low" ||
    data.metadata?.confidence_by_section?.goals === "low";

  const isPartial = extractionRate < 0.7 || hasLowConfidence;

  return {
    success: true,
    data,
    isPartial,
    missingFields: finalMissingFields,
  };
}

// ──────────────────────────────────────────────
// JSON Schema Guidance for LLM Prompts
// ──────────────────────────────────────────────

/**
 * JSON schema guidance string to inject into OpenRouter prompts
 * This helps the LLM understand the expected output format
 */
export const WIZARD_AUTOFILL_JSON_SCHEMA_GUIDANCE = `
You MUST respond with valid JSON matching this exact structure:

{
  "brand": {
    "business_name": "string (required)",
    "short_description": "string 10-280 chars (required)",
    "long_description": "string 20-2000 chars (optional)",
    "industry": "string (optional)",
    "tone_voice": "professional|casual|friendly|authoritative|playful|inspirational|educational|conversational (optional)",
    "target_audience": "string describing ideal customer (optional)",
    "location": "string like 'London, UK' (optional)",
    "website": "valid URL (optional)",
    "brand_colours": ["#FF5500", "#0066CC"] (array of hex colors, max 5, optional),
    "social_links": {
      "facebook": "url (optional)",
      "twitter": "url (optional)",
      "linkedin": "url (optional)",
      "instagram": "url (optional)",
      "youtube": "url (optional)",
      "tiktok": "url (optional)"
    },
    "content_language": "en|es|fr|de etc. (optional)",
    "article_styles": ["how_to_guides", "listicles", "case_studies"] (optional, choose from: let_zarzoom_decide, how_to_guides, listicles, opinion_pieces, case_studies, news_commentary, tutorials, interviews, product_reviews),
    "style_reference_links": ["url1", "url2"] (max 3 URLs, optional),
    "logo_guidance": "string describing logo if visible (optional)"
  },
  "goals": {
    "primary_goals": ["increase_website_traffic", "build_brand_authority"] (optional, choose from: increase_website_traffic, get_more_subscribers_leads, promote_product_or_service, increase_sales, build_brand_authority, improve_seo, educate_audience, generate_social_content),
    "secondary_goals": ["improve_seo"] (optional, same options),
    "target_platforms": ["linkedin", "twitter", "blog"] (optional),
    "posting_frequency": "daily|3_per_week|weekly|bi_weekly|monthly (optional)",
    "kpis": ["traffic", "engagement"] (optional, choose from: traffic, conversions, engagement, followers, revenue, brand_awareness)
  },
  "plan": {
    "suggested_tier": "basic|pro|scale (optional)",
    "cadence_recommendation": "daily|3_per_week|weekly|bi_weekly|monthly (optional)",
    "approvals_workflow": "auto|manual (optional)",
    "collaboration_notes": "string with notes about team size/structure (optional)"
  },
  "connect": {
    "required_social_accounts": ["facebook", "linkedin"] (optional),
    "onboarding_notes": "string with guidance (optional)"
  },
  "metadata": {
    "confidence_by_section": {
      "brand": "high|medium|low",
      "goals": "high|medium|low",
      "plan": "high|medium|low",
      "connect": "high|medium|low"
    },
    "missing_fields": ["field1", "field2"] (list fields you couldn't extract),
    "extraction_notes": "string with any important notes about extraction quality",
    "source_type": "website|file",
    "extracted_at": "ISO 8601 datetime string"
  }
}

IMPORTANT RULES:
1. Extract ONLY information you are confident about. Leave fields empty if uncertain.
2. For brand_colours, extract dominant brand colors from the design (2-5 colors max).
3. For tone_voice, analyze the writing style and choose the closest match.
4. For goals, infer from business description and website content.
5. For plan.suggested_tier, consider business size: small=basic, medium=pro, large=scale.
6. Set confidence levels honestly: high=90%+ sure, medium=60-89%, low=<60%.
7. List missing_fields that you couldn't extract with confidence.
8. Do NOT make up information. It's better to leave fields empty than to guess.
9. Ensure all URLs are valid and complete (include https://).
10. Ensure all hex colors are exactly 6 characters with # prefix.

Focus on quality over quantity. A partially filled response with high confidence is better than a complete response with low confidence.
`.trim();

/**
 * Helper to generate a user-friendly summary of what was extracted
 */
export function generateExtractionSummary(
  result: WizardAutoFillValidationResult
): string {
  if (!result.success || !result.data) {
    return "Failed to extract any information.";
  }

  const sections: string[] = [];

  if (result.data.brand) {
    const brandCount = Object.values(result.data.brand).filter(Boolean).length;
    sections.push(`Brand (${brandCount} fields)`);
  }

  if (result.data.goals) {
    const goalsCount = Object.values(result.data.goals).filter(Boolean).length;
    sections.push(`Goals (${goalsCount} fields)`);
  }

  if (result.data.plan) {
    const planCount = Object.values(result.data.plan).filter(Boolean).length;
    sections.push(`Plan (${planCount} fields)`);
  }

  if (result.data.connect) {
    const connectCount = Object.values(result.data.connect).filter(
      Boolean
    ).length;
    sections.push(`Connect (${connectCount} fields)`);
  }

  const status = result.isPartial ? "Partial extraction" : "Complete extraction";
  const sectionsText = sections.length > 0 ? sections.join(", ") : "No data";

  return `${status}: ${sectionsText}`;
}
