import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Enums & Constants                                                  */
/* ------------------------------------------------------------------ */

export const CURRENCIES = ["GBP", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const INTERVALS = ["monthly", "annual"] as const;
export type BillingInterval = (typeof INTERVALS)[number];

export const PLAN_STATUSES = ["active", "archived", "draft"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/* ------------------------------------------------------------------ */
/*  Zod Schemas (validation for admin forms & API)                     */
/* ------------------------------------------------------------------ */

export const planPriceSchema = z.object({
  currency: z.enum(CURRENCIES),
  interval: z.enum(INTERVALS),
  unitAmount: z.coerce
    .number()
    .int()
    .min(0, "Price must be 0 or greater"),
});

/**
 * CANONICAL: Schema for creating new plans
 * Uses plan_key instead of slug
 */
export const createPlanSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  plan_key: z
    .string()
    .min(1, "Plan key is required")
    .max(50)
    .regex(/^[a-z0-9_-]+$/, "Plan key must be lowercase alphanumeric with dashes or underscores")
    .transform(s => s.toLowerCase()),
  description: z.string().max(500).optional().default(""),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
  quota_policy: z.record(z.number()).optional().default({}),
  features: z.array(z.string()).optional().default([]),
  entitlements: z.record(z.boolean()).optional().default({}),
  prices: z.array(planPriceSchema).min(1, "At least one price is required"),
});

/**
 * CANONICAL: Schema for updating plans
 */
export const updatePlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
  quota_policy: z.record(z.number()).optional(),
  features: z.array(z.string()).optional(),
  entitlements: z.record(z.boolean()).optional(),
  stripe_price_id: z.string().max(255).nullable().optional(),
});

/** Well-known quota policy keys used in the structured editor. */
export const QUOTA_KEYS = [
  "images_per_month",
  "videos_per_month",
  "articles_per_month",
  "scripts_per_month",
  "social_posts_per_month",
  "social_profiles",
  "research_per_month",
  "max_api_keys",
] as const;
export type QuotaKey = (typeof QUOTA_KEYS)[number];

/* ------------------------------------------------------------------ */
/*  Row Types (matching Supabase table shapes)                         */
/* ------------------------------------------------------------------ */

/**
 * CANONICAL: New plans table structure (migration 005)
 * Use this for all new code. Supports unlimited plans with simplified schema.
 */
export interface Plan {
  id: string;
  plan_key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  entitlements: Record<string, boolean>;
  quota_policy: Record<string, number>;
  features: string[];
  stripe_price_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * CANONICAL: New plan_prices table structure (migration 005)
 * Supports unlimited currencies per plan with proper naming (amount_minor).
 */
export interface PlanPrice {
  id: string;
  plan_id: string;
  currency: Currency;
  interval: BillingInterval;
  amount_minor: number;  // price in minor units (pence/cents)
  is_active: boolean;
  billing_provider_price_id: string | null;
  effective_from: string;
  effective_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * CANONICAL: Plan with all associated prices
 */
export interface PlanWithPrices extends Plan {
  prices: PlanPrice[];
}

export interface TenantSubscriptionRow {
  id: string;
  tenant_id: string;
  plan_id: string;
  price_id: string | null;
  user_id: string | null;
  status: SubscriptionStatus;
  billing_provider: string | null;
  billing_provider_subscription_id: string | null;
  billing_provider_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Composite Types (for UI)                                           */
/* ------------------------------------------------------------------ */

export interface SubscriptionWithPlan extends TenantSubscriptionRow {
  plan: Plan;
}
