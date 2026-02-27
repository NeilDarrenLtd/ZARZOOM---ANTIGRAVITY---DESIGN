-- Migration: Add stripe_price_id to subscription_plans
-- This column stores the Stripe Price ID (e.g. price_xxx) used by the
-- Stripe checkout flow to identify the exact price for a given plan.

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

COMMENT ON COLUMN subscription_plans.stripe_price_id IS
  'Stripe Price ID (price_xxx) linked to this plan for checkout';
