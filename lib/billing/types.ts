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

export const createPlanSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  description: z.string().max(500).optional().default(""),
  status: z.enum(PLAN_STATUSES).default("draft"),
  displayOrder: z.coerce.number().int().min(0).default(0),
  trialDays: z.coerce.number().int().min(0).max(365).default(0),
  quotaPolicy: z.record(z.unknown()).optional().default({}),
  featureFlags: z.record(z.boolean()).optional().default({}),
  prices: z.array(planPriceSchema).min(1, "At least one price is required"),
});

export const updatePlanSchema = createPlanSchema.partial().extend({
  id: z.string().uuid(),
});

/* ------------------------------------------------------------------ */
/*  Row Types (matching Supabase table shapes)                         */
/* ------------------------------------------------------------------ */

export interface PlanRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  scope: string | null;
  tenant_id: string | null;
  display_order: number;
  highlight: boolean;
  quota_policy: Record<string, unknown>;
  features: unknown[] | null;
  entitlements: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  /** Legacy alias -- some query helpers pass `status` */
  status?: PlanStatus;
  /** Legacy alias -- kept for backward compatibility */
  trial_days?: number;
  /** Legacy alias */
  feature_flags?: Record<string, boolean>;
}

export interface PlanPriceRow {
  id: string;
  plan_id: string;
  currency: Currency;
  interval: BillingInterval;
  unit_amount: number;
  billing_provider_price_id: string | null;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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

export interface PlanWithPrices extends PlanRow {
  plan_prices: PlanPriceRow[];
}

export interface SubscriptionWithPlan extends TenantSubscriptionRow {
  plan: PlanRow;
}
