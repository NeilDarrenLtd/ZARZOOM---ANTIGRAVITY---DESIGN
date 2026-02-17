import { z } from "zod";

// ──────────────────────────────────────────────
// Shared enums & primitives
// ──────────────────────────────────────────────

export const ONBOARDING_STATUSES = [
  "not_started",
  "in_progress",
  "skipped",
  "completed",
] as const;

export const PLAN_OPTIONS = ["basic", "pro", "scale"] as const;

export const APPROVAL_OPTIONS = ["auto", "manual"] as const;

export const GOAL_OPTIONS = [
  "increase_website_traffic",
  "get_more_subscribers_leads",
  "promote_product_or_service",
  "increase_sales",
  "build_brand_authority",
  "improve_seo",
  "educate_audience",
  "generate_social_content",
] as const;

export const ARTICLE_STYLE_OPTIONS = [
  "let_zarzoom_decide",
  "how_to_guides",
  "listicles",
  "opinion_pieces",
  "case_studies",
  "news_commentary",
  "tutorials",
  "interviews",
  "product_reviews",
] as const;

const urlField = z.string().url("Must be a valid URL");

const hexColorField = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g. #FF5500)")
  .nullable()
  .optional();

// ──────────────────────────────────────────────
// Partial update schema (PUT /api/v1/onboarding)
// All fields optional for incremental saves
// ──────────────────────────────────────────────

export const onboardingUpdateSchema = z
  .object({
    // wizard progress
    onboarding_step: z.number().int().min(1).max(5).nullable().optional(),

    // step 1: business info
    business_name: z.string().min(2, "Business name must be at least 2 characters").optional(),
    website_url: urlField.nullable().optional(),
    business_description: z
      .string()
      .min(10, "Business description must be at least 10 characters")
      .optional(),

    // step 2: content preferences
    content_language: z.string().min(1).optional(),
    auto_publish: z.boolean().optional(),
    article_styles: z.array(z.string()).nullable().optional(),
    article_style_links: z
      .array(urlField)
      .max(3, "Maximum 3 style links allowed")
      .nullable()
      .optional(),

    // step 3: brand
    brand_color_hex: hexColorField,
    logo_url: urlField.nullable().optional(),

    // step 4: goals
    goals: z.array(z.enum(GOAL_OPTIONS)).optional(),
    website_or_landing_url: urlField.nullable().optional(),
    product_or_sales_url: urlField.nullable().optional(),

    // step 5: plan & settings
    selected_plan: z.enum(PLAN_OPTIONS).nullable().optional(),
    discount_opt_in: z.boolean().optional(),
    approval_preference: z.enum(APPROVAL_OPTIONS).optional(),

    // social
    uploadpost_profile_username: z.string().nullable().optional(),
    socials_connected: z.boolean().optional(),

    // misc
    additional_notes: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // Conditional: if goals require a website/landing URL
    const needsWebsite =
      data.goals?.includes("increase_website_traffic") ||
      data.goals?.includes("get_more_subscribers_leads");

    if (needsWebsite && !data.website_or_landing_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Website or landing URL is required when goals include website traffic or subscriber/lead generation",
        path: ["website_or_landing_url"],
      });
    }

    // Conditional: if goals require a product/sales URL
    const needsProduct =
      data.goals?.includes("promote_product_or_service") ||
      data.goals?.includes("increase_sales");

    if (needsProduct && !data.product_or_sales_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Product or sales URL is required when goals include product promotion or increasing sales",
        path: ["product_or_sales_url"],
      });
    }
  });

// ──────────────────────────────────────────────
// Completion validation schema
// Ensures all required fields are present
// ──────────────────────────────────────────────

export const onboardingCompleteSchema = z
  .object({
    business_name: z.string().min(2, "Business name is required (min 2 characters)"),
    business_description: z
      .string()
      .min(10, "Business description is required (min 10 characters)"),
    content_language: z.string().min(1, "Content language is required"),
    goals: z.array(z.enum(GOAL_OPTIONS)).min(1, "At least one goal is required"),
    website_or_landing_url: urlField.nullable().optional(),
    product_or_sales_url: urlField.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const needsWebsite =
      data.goals.includes("increase_website_traffic") ||
      data.goals.includes("get_more_subscribers_leads");

    if (needsWebsite && !data.website_or_landing_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Website or landing URL is required when goals include website traffic or subscriber/lead generation",
        path: ["website_or_landing_url"],
      });
    }

    const needsProduct =
      data.goals.includes("promote_product_or_service") ||
      data.goals.includes("increase_sales");

    if (needsProduct && !data.product_or_sales_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Product or sales URL is required when goals include product promotion or increasing sales",
        path: ["product_or_sales_url"],
      });
    }
  });

// ──────────────────────────────────────────────
// TypeScript types derived from schemas
// ──────────────────────────────────────────────

export type OnboardingUpdate = z.infer<typeof onboardingUpdateSchema>;
export type OnboardingComplete = z.infer<typeof onboardingCompleteSchema>;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];
export type Goal = (typeof GOAL_OPTIONS)[number];
export type ArticleStyle = (typeof ARTICLE_STYLE_OPTIONS)[number];
export type Plan = (typeof PLAN_OPTIONS)[number];
