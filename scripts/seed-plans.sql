-- Seed default subscription plans with multi-currency pricing
-- Uses ON CONFLICT to be idempotent (safe to run multiple times)

-- =============================================
-- 1. Upsert subscription_plans
-- =============================================

-- Ensure slug has a unique constraint for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'subscription_plans_slug_key'
  ) THEN
    ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_slug_key UNIQUE (slug);
  END IF;
END $$;

INSERT INTO subscription_plans (id, name, slug, description, display_order, highlight, is_active, entitlements, quota_policy, features, created_at, updated_at)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'Basic',
    'basic',
    'Get started with social media scheduling and publishing.',
    1,
    false,
    true,
    '{"social_publish": true, "research_social": false, "generate_article": false, "generate_script": false, "video_from_research": false, "video_generate": false}'::jsonb,
    '{"posts_published_count": 30, "images_generated_count": 10, "articles_generated_count": 0, "scripts_generated_count": 0, "videos_generated_count": 0}'::jsonb,
    '["Schedule & publish to social media", "Up to 30 posts per month", "Up to 10 generated images", "Basic analytics", "Email support"]'::jsonb,
    now(),
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'Pro',
    'pro',
    'Unlock AI-powered research, article generation, and advanced scheduling.',
    2,
    true,
    true,
    '{"social_publish": true, "research_social": true, "generate_article": true, "generate_script": false, "video_from_research": false, "video_generate": false}'::jsonb,
    '{"posts_published_count": 150, "images_generated_count": 50, "articles_generated_count": 30, "scripts_generated_count": 0, "videos_generated_count": 0}'::jsonb,
    '["Everything in Basic", "AI social media research", "AI article generation", "Up to 150 posts per month", "Up to 50 generated images", "Up to 30 generated articles", "Priority support"]'::jsonb,
    now(),
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'Advanced',
    'advanced',
    'Full creative suite with video generation, scripting, and all AI capabilities.',
    3,
    false,
    true,
    '{"social_publish": true, "research_social": true, "generate_article": true, "generate_script": true, "video_from_research": true, "video_generate": true}'::jsonb,
    '{"posts_published_count": 500, "images_generated_count": 200, "articles_generated_count": 100, "scripts_generated_count": 50, "videos_generated_count": 20}'::jsonb,
    '["Everything in Pro", "AI script generation", "AI video from research", "AI video generation", "Up to 500 posts per month", "Up to 200 generated images", "Up to 100 articles & 50 scripts", "Up to 20 generated videos", "Dedicated support"]'::jsonb,
    now(),
    now()
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  highlight = EXCLUDED.highlight,
  is_active = EXCLUDED.is_active,
  entitlements = EXCLUDED.entitlements,
  quota_policy = EXCLUDED.quota_policy,
  features = EXCLUDED.features,
  updated_at = now();

-- =============================================
-- 2. Upsert plan_prices (monthly + annual, GBP/USD/EUR)
-- =============================================

-- Ensure unique constraint for upsert on prices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'plan_prices_plan_currency_interval_key'
  ) THEN
    ALTER TABLE plan_prices ADD CONSTRAINT plan_prices_plan_currency_interval_key UNIQUE (plan_id, currency, interval);
  END IF;
END $$;

-- Basic plan prices
INSERT INTO plan_prices (plan_id, currency, interval, unit_amount, is_active, billing_provider_price_id, created_at, updated_at)
VALUES
  -- Basic Monthly
  ('a0000000-0000-0000-0000-000000000001', 'GBP', 'monthly', 999, true, 'pending_basic_gbp_month', now(), now()),
  ('a0000000-0000-0000-0000-000000000001', 'USD', 'monthly', 1299, true, 'pending_basic_usd_month', now(), now()),
  ('a0000000-0000-0000-0000-000000000001', 'EUR', 'monthly', 1199, true, 'pending_basic_eur_month', now(), now()),
  -- Basic Annual
  ('a0000000-0000-0000-0000-000000000001', 'GBP', 'annual', 9990, true, 'pending_basic_gbp_year', now(), now()),
  ('a0000000-0000-0000-0000-000000000001', 'USD', 'annual', 12990, true, 'pending_basic_usd_year', now(), now()),
  ('a0000000-0000-0000-0000-000000000001', 'EUR', 'annual', 11990, true, 'pending_basic_eur_year', now(), now()),

  -- Pro Monthly
  ('a0000000-0000-0000-0000-000000000002', 'GBP', 'monthly', 2999, true, 'pending_pro_gbp_month', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'USD', 'monthly', 3999, true, 'pending_pro_usd_month', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'EUR', 'monthly', 3499, true, 'pending_pro_eur_month', now(), now()),
  -- Pro Annual
  ('a0000000-0000-0000-0000-000000000002', 'GBP', 'annual', 29990, true, 'pending_pro_gbp_year', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'USD', 'annual', 39990, true, 'pending_pro_usd_year', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'EUR', 'annual', 34990, true, 'pending_pro_eur_year', now(), now()),

  -- Advanced Monthly
  ('a0000000-0000-0000-0000-000000000003', 'GBP', 'monthly', 5999, true, 'pending_advanced_gbp_month', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'USD', 'monthly', 7999, true, 'pending_advanced_usd_month', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'EUR', 'monthly', 6999, true, 'pending_advanced_eur_month', now(), now()),
  -- Advanced Annual
  ('a0000000-0000-0000-0000-000000000003', 'GBP', 'annual', 59990, true, 'pending_advanced_gbp_year', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'USD', 'annual', 79990, true, 'pending_advanced_usd_year', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'EUR', 'annual', 69990, true, 'pending_advanced_eur_year', now(), now())
ON CONFLICT (plan_id, currency, interval) DO UPDATE SET
  unit_amount = EXCLUDED.unit_amount,
  is_active = EXCLUDED.is_active,
  billing_provider_price_id = EXCLUDED.billing_provider_price_id,
  updated_at = now();
