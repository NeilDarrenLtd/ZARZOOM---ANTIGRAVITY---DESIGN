-- ============================================================================
-- Migration 005: Refactor pricing schema to canonical structure
--
-- This migration refactors subscription_plans → plans and standardizes
-- the pricing tables to match the canonical API specification.
--
-- APPROACH: Create new tables, migrate data, then drop old tables.
-- This allows for a clean break and ensures the new structure is followed.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE NEW PLANS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key      TEXT NOT NULL UNIQUE,  -- lowercase slug (e.g. 'basic', 'pro', 'advanced')
  name          TEXT NOT NULL,          -- display name
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  entitlements  JSONB NOT NULL DEFAULT '{}'::jsonb,  -- feature flags
  quota_policy  JSONB NOT NULL DEFAULT '{}'::jsonb,  -- usage limits
  features      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- feature list for UI
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS plans_is_active_idx ON public.plans (is_active);
CREATE INDEX IF NOT EXISTS plans_sort_order_idx ON public.plans (sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS plans_plan_key_lower_idx ON public.plans (LOWER(plan_key));

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read active plans"
  ON public.plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role full access on plans"
  ON public.plans FOR ALL
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 2. CREATE NEW PLAN_PRICES TABLE (if not exists, or recreate with FK to plans)
-- ============================================================================

-- Drop the old FK constraint to subscription_plans if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'plan_prices_plan_id_fkey' 
    AND conrelid = 'public.plan_prices'::regclass
  ) THEN
    ALTER TABLE public.plan_prices DROP CONSTRAINT plan_prices_plan_id_fkey;
  END IF;
END $$;

-- If plan_prices doesn't exist, create it; otherwise we'll just update constraints
CREATE TABLE IF NOT EXISTS public.plan_prices (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id                     UUID NOT NULL,  -- FK to plans.id (will add after migration)
  currency                    TEXT NOT NULL,  -- 'GBP', 'USD', 'EUR'
  interval                    TEXT NOT NULL,  -- 'monthly', 'annual'
  amount_minor                INTEGER NOT NULL,  -- price in minor units (pence/cents)
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  billing_provider_price_id   TEXT,  -- Stripe price ID
  effective_from              TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  UUID REFERENCES auth.users(id)
);

-- Rename unit_amount to amount_minor if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'plan_prices' 
    AND column_name = 'unit_amount'
  ) THEN
    ALTER TABLE public.plan_prices RENAME COLUMN unit_amount TO amount_minor;
  END IF;
END $$;

-- Ensure all required columns exist
ALTER TABLE public.plan_prices
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'GBP',
  ADD COLUMN IF NOT EXISTS interval TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS amount_minor INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS billing_provider_price_id TEXT,
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS plan_prices_plan_id_idx ON public.plan_prices (plan_id);
CREATE INDEX IF NOT EXISTS plan_prices_currency_idx ON public.plan_prices (currency);
CREATE INDEX IF NOT EXISTS plan_prices_is_active_idx ON public.plan_prices (is_active);
CREATE INDEX IF NOT EXISTS plan_prices_active_lookup_idx 
  ON public.plan_prices (plan_id, currency, interval, effective_from)
  WHERE is_active = true;

-- Unique constraint: one active price per plan/currency/interval
CREATE UNIQUE INDEX IF NOT EXISTS plan_prices_plan_currency_interval_active_idx
  ON public.plan_prices (plan_id, currency, interval)
  WHERE is_active = true;

-- Validate currency values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plan_prices_currency_check'
  ) THEN
    ALTER TABLE public.plan_prices
      ADD CONSTRAINT plan_prices_currency_check
      CHECK (currency IN ('GBP', 'USD', 'EUR'));
  END IF;
END $$;

-- Validate interval values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plan_prices_interval_check'
  ) THEN
    ALTER TABLE public.plan_prices
      ADD CONSTRAINT plan_prices_interval_check
      CHECK (interval IN ('monthly', 'annual'));
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read active prices"
  ON public.plan_prices FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role full access on plan_prices"
  ON public.plan_prices FOR ALL
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 3. MIGRATE DATA from subscription_plans → plans
-- ============================================================================

-- Insert from subscription_plans into plans (skip if already migrated)
INSERT INTO public.plans (
  id,
  plan_key,
  name,
  description,
  is_active,
  sort_order,
  entitlements,
  quota_policy,
  features,
  created_at,
  updated_at
)
SELECT 
  id,
  LOWER(slug) as plan_key,  -- ensure lowercase
  name,
  description,
  is_active,
  COALESCE(display_order, 0) as sort_order,
  COALESCE(entitlements, '{}'::jsonb),
  COALESCE(quota_policy, '{}'::jsonb),
  COALESCE(features, '[]'::jsonb),
  COALESCE(created_at, now()),
  COALESCE(updated_at, now())
FROM public.subscription_plans
WHERE NOT EXISTS (
  SELECT 1 FROM public.plans WHERE plans.plan_key = LOWER(subscription_plans.slug)
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 4. UPDATE plan_prices to reference new plans table
-- ============================================================================

-- Add FK constraint from plan_prices to plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'plan_prices_plan_id_fkey_new'
  ) THEN
    ALTER TABLE public.plan_prices
      ADD CONSTRAINT plan_prices_plan_id_fkey_new
      FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;
  END IF;
END $$;


-- ============================================================================
-- 5. UPDATE tenant_subscriptions to reference new plans table
-- ============================================================================

-- Add FK constraint from tenant_subscriptions to plans (if it doesn't already point there)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenant_subscriptions_plan_id_fkey'
    AND conrelid = 'public.tenant_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.tenant_subscriptions DROP CONSTRAINT tenant_subscriptions_plan_id_fkey;
  END IF;
  
  ALTER TABLE public.tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_plan_id_fkey
    FOREIGN KEY (plan_id) REFERENCES public.plans(id);
END $$;


-- ============================================================================
-- 6. CREATE/UPDATE active_plan_prices VIEW
-- ============================================================================

DROP VIEW IF EXISTS public.active_plan_prices;

CREATE VIEW public.active_plan_prices AS
SELECT DISTINCT ON (pp.plan_id, pp.currency, pp.interval)
  pp.id             AS price_id,
  pp.plan_id,
  p.name            AS plan_name,
  p.plan_key        AS plan_slug,
  pp.currency,
  pp.interval,
  pp.amount_minor   AS unit_amount,
  pp.effective_from,
  pp.effective_to,
  pp.billing_provider_price_id,
  pp.is_active
FROM public.plan_prices pp
JOIN public.plans p ON p.id = pp.plan_id
WHERE pp.is_active = true
  AND pp.effective_from <= now()
  AND (pp.effective_to IS NULL OR pp.effective_to > now())
  AND p.is_active = true
ORDER BY pp.plan_id, pp.currency, pp.interval, pp.effective_from DESC;


-- ============================================================================
-- 7. COMMENT ON DEPRECATION (don't drop yet for safety)
-- ============================================================================

COMMENT ON TABLE public.subscription_plans IS 
  'DEPRECATED: Migrated to public.plans. Will be dropped in future migration after verification.';


-- ============================================================================
-- 8. SEED DEFAULT PLANS (upsert to ensure they exist)
-- ============================================================================

-- Basic Plan
INSERT INTO public.plans (plan_key, name, description, is_active, sort_order, entitlements, quota_policy, features)
VALUES (
  'basic',
  'Basic',
  'Get started with social media scheduling and publishing.',
  true,
  1,
  '{"social_publish": true, "research_social": false, "generate_article": false, "generate_script": false, "video_from_research": false, "video_generate": false}'::jsonb,
  '{"posts_published_count": 30, "images_generated_count": 10, "articles_generated_count": 0, "scripts_generated_count": 0, "videos_generated_count": 0, "max_jobs_in_flight": 2, "max_api_keys": 2}'::jsonb,
  '["Schedule & publish to social media", "Up to 30 posts per month", "Up to 10 generated images", "Basic analytics", "Email support"]'::jsonb
)
ON CONFLICT (plan_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  entitlements = EXCLUDED.entitlements,
  quota_policy = EXCLUDED.quota_policy,
  features = EXCLUDED.features,
  updated_at = now();

-- Pro Plan
INSERT INTO public.plans (plan_key, name, description, is_active, sort_order, entitlements, quota_policy, features)
VALUES (
  'pro',
  'Pro',
  'Unlock AI-powered research, article generation, and advanced scheduling.',
  true,
  2,
  '{"social_publish": true, "research_social": true, "generate_article": true, "generate_script": false, "video_from_research": false, "video_generate": false}'::jsonb,
  '{"posts_published_count": 150, "images_generated_count": 50, "articles_generated_count": 30, "scripts_generated_count": 0, "videos_generated_count": 0, "max_jobs_in_flight": 5, "max_api_keys": 5, "max_research_runs_per_day": 10}'::jsonb,
  '["Everything in Basic", "AI social media research", "AI article generation", "Up to 150 posts per month", "Up to 50 generated images", "Up to 30 generated articles", "Priority support"]'::jsonb
)
ON CONFLICT (plan_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  entitlements = EXCLUDED.entitlements,
  quota_policy = EXCLUDED.quota_policy,
  features = EXCLUDED.features,
  updated_at = now();

-- Advanced Plan
INSERT INTO public.plans (plan_key, name, description, is_active, sort_order, entitlements, quota_policy, features)
VALUES (
  'advanced',
  'Advanced',
  'Full creative suite with video generation, scripting, and all AI capabilities.',
  true,
  3,
  '{"social_publish": true, "research_social": true, "generate_article": true, "generate_script": true, "video_from_research": true, "video_generate": true}'::jsonb,
  '{"posts_published_count": 500, "images_generated_count": 200, "articles_generated_count": 100, "scripts_generated_count": 50, "videos_generated_count": 20, "max_jobs_in_flight": 10, "max_api_keys": 20, "max_research_runs_per_day": 50, "max_video_seconds_per_month": 600}'::jsonb,
  '["Everything in Pro", "AI script generation", "AI video from research", "AI video generation", "Up to 500 posts per month", "Up to 200 generated images", "Up to 100 articles & 50 scripts", "Up to 20 generated videos", "Dedicated support"]'::jsonb
)
ON CONFLICT (plan_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  entitlements = EXCLUDED.entitlements,
  quota_policy = EXCLUDED.quota_policy,
  features = EXCLUDED.features,
  updated_at = now();


-- ============================================================================
-- 9. SEED PLAN PRICES (multi-currency for each plan)
-- ============================================================================

-- Basic prices
INSERT INTO public.plan_prices (plan_id, currency, interval, amount_minor, is_active, billing_provider_price_id)
SELECT p.id, v.currency, v.interval, v.amount_minor, true, v.provider_id
FROM public.plans p
CROSS JOIN (VALUES
  ('GBP', 'monthly', 999,   'pending_basic_gbp_monthly'),
  ('USD', 'monthly', 1299,  'pending_basic_usd_monthly'),
  ('EUR', 'monthly', 1199,  'pending_basic_eur_monthly'),
  ('GBP', 'annual',  9990,  'pending_basic_gbp_annual'),
  ('USD', 'annual',  12990, 'pending_basic_usd_annual'),
  ('EUR', 'annual',  11990, 'pending_basic_eur_annual')
) AS v(currency, interval, amount_minor, provider_id)
WHERE p.plan_key = 'basic'
ON CONFLICT (plan_id, currency, interval) 
WHERE is_active = true
DO UPDATE SET
  amount_minor = EXCLUDED.amount_minor,
  billing_provider_price_id = EXCLUDED.billing_provider_price_id,
  updated_at = now();

-- Pro prices
INSERT INTO public.plan_prices (plan_id, currency, interval, amount_minor, is_active, billing_provider_price_id)
SELECT p.id, v.currency, v.interval, v.amount_minor, true, v.provider_id
FROM public.plans p
CROSS JOIN (VALUES
  ('GBP', 'monthly', 2999,  'pending_pro_gbp_monthly'),
  ('USD', 'monthly', 3999,  'pending_pro_usd_monthly'),
  ('EUR', 'monthly', 3499,  'pending_pro_eur_monthly'),
  ('GBP', 'annual',  29990, 'pending_pro_gbp_annual'),
  ('USD', 'annual',  39990, 'pending_pro_usd_annual'),
  ('EUR', 'annual',  34990, 'pending_pro_eur_annual')
) AS v(currency, interval, amount_minor, provider_id)
WHERE p.plan_key = 'pro'
ON CONFLICT (plan_id, currency, interval) 
WHERE is_active = true
DO UPDATE SET
  amount_minor = EXCLUDED.amount_minor,
  billing_provider_price_id = EXCLUDED.billing_provider_price_id,
  updated_at = now();

-- Advanced prices
INSERT INTO public.plan_prices (plan_id, currency, interval, amount_minor, is_active, billing_provider_id)
SELECT p.id, v.currency, v.interval, v.amount_minor, true, v.provider_id
FROM public.plans p
CROSS JOIN (VALUES
  ('GBP', 'monthly', 5999,  'pending_advanced_gbp_monthly'),
  ('USD', 'monthly', 7999,  'pending_advanced_usd_monthly'),
  ('EUR', 'monthly', 6999,  'pending_advanced_eur_monthly'),
  ('GBP', 'annual',  59990, 'pending_advanced_gbp_annual'),
  ('USD', 'annual',  79990, 'pending_advanced_usd_annual'),
  ('EUR', 'annual',  69990, 'pending_advanced_eur_annual')
) AS v(currency, interval, amount_minor, provider_id)
WHERE p.plan_key = 'advanced'
ON CONFLICT (plan_id, currency, interval) 
WHERE is_active = true
DO UPDATE SET
  amount_minor = EXCLUDED.amount_minor,
  billing_provider_price_id = EXCLUDED.billing_provider_price_id,
  updated_at = now();


COMMIT;
