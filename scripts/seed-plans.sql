-- Seed default subscription plans with multi-currency pricing
-- Idempotent: uses ON CONFLICT for both plans and prices

-- =============================================
-- 1. Ensure unique constraints exist
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'subscription_plans_slug_key'
  ) THEN
    ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_slug_key UNIQUE (slug);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'plan_prices_plan_currency_interval_key'
  ) THEN
    ALTER TABLE plan_prices ADD CONSTRAINT plan_prices_plan_currency_interval_key UNIQUE (plan_id, currency, interval);
  END IF;
END $$;

-- =============================================
-- 2. Upsert subscription_plans (let DB generate IDs)
-- =============================================
INSERT INTO subscription_plans (name, slug, description, display_order, highlight, is_active, entitlements, quota_policy, features)
VALUES
  (
    'Basic',
    'basic',
    'Get started with social media scheduling and publishing.',
    1,
    false,
    true,
    '{"social_publish": true, "research_social": false, "generate_article": false, "generate_script": false, "video_from_research": false, "video_generate": false}'::jsonb,
    '{"posts_published_count": 30, "images_generated_count": 10, "articles_generated_count": 0, "scripts_generated_count": 0, "videos_generated_count": 0}'::jsonb,
    '["Schedule & publish to social media", "Up to 30 posts per month", "Up to 10 generated images", "Basic analytics", "Email support"]'::jsonb
  ),
  (
    'Pro',
    'pro',
    'Unlock AI-powered research, article generation, and advanced scheduling.',
    2,
    true,
    true,
    '{"social_publish": true, "research_social": true, "generate_article": true, "generate_script": false, "video_from_research": false, "video_generate": false}'::jsonb,
    '{"posts_published_count": 150, "images_generated_count": 50, "articles_generated_count": 30, "scripts_generated_count": 0, "videos_generated_count": 0}'::jsonb,
    '["Everything in Basic", "AI social media research", "AI article generation", "Up to 150 posts per month", "Up to 50 generated images", "Up to 30 generated articles", "Priority support"]'::jsonb
  ),
  (
    'Advanced',
    'advanced',
    'Full creative suite with video generation, scripting, and all AI capabilities.',
    3,
    false,
    true,
    '{"social_publish": true, "research_social": true, "generate_article": true, "generate_script": true, "video_from_research": true, "video_generate": true}'::jsonb,
    '{"posts_published_count": 500, "images_generated_count": 200, "articles_generated_count": 100, "scripts_generated_count": 50, "videos_generated_count": 20}'::jsonb,
    '["Everything in Pro", "AI script generation", "AI video from research", "AI video generation", "Up to 500 posts per month", "Up to 200 generated images", "Up to 100 articles & 50 scripts", "Up to 20 generated videos", "Dedicated support"]'::jsonb
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
-- 3. Upsert plan_prices referencing plans by slug
-- =============================================

-- Basic prices
INSERT INTO plan_prices (plan_id, currency, interval, unit_amount, is_active, billing_provider_price_id)
SELECT sp.id, v.currency, v.interval, v.unit_amount, true, v.provider_id
FROM subscription_plans sp
CROSS JOIN (VALUES
  ('GBP', 'monthly', 999,   'pending_basic_gbp_monthly'),
  ('USD', 'monthly', 1299,  'pending_basic_usd_monthly'),
  ('EUR', 'monthly', 1199,  'pending_basic_eur_monthly'),
  ('GBP', 'annual',  9990,  'pending_basic_gbp_annual'),
  ('USD', 'annual',  12990, 'pending_basic_usd_annual'),
  ('EUR', 'annual',  11990, 'pending_basic_eur_annual')
) AS v(currency, interval, unit_amount, provider_id)
WHERE sp.slug = 'basic'
ON CONFLICT (plan_id, currency, interval) DO UPDATE SET
  unit_amount = EXCLUDED.unit_amount,
  is_active = EXCLUDED.is_active,
  billing_provider_price_id = EXCLUDED.billing_provider_price_id,
  updated_at = now();

-- Pro prices
INSERT INTO plan_prices (plan_id, currency, interval, unit_amount, is_active, billing_provider_price_id)
SELECT sp.id, v.currency, v.interval, v.unit_amount, true, v.provider_id
FROM subscription_plans sp
CROSS JOIN (VALUES
  ('GBP', 'monthly', 2999,  'pending_pro_gbp_monthly'),
  ('USD', 'monthly', 3999,  'pending_pro_usd_monthly'),
  ('EUR', 'monthly', 3499,  'pending_pro_eur_monthly'),
  ('GBP', 'annual',  29990, 'pending_pro_gbp_annual'),
  ('USD', 'annual',  39990, 'pending_pro_usd_annual'),
  ('EUR', 'annual',  34990, 'pending_pro_eur_annual')
) AS v(currency, interval, unit_amount, provider_id)
WHERE sp.slug = 'pro'
ON CONFLICT (plan_id, currency, interval) DO UPDATE SET
  unit_amount = EXCLUDED.unit_amount,
  is_active = EXCLUDED.is_active,
  billing_provider_price_id = EXCLUDED.billing_provider_price_id,
  updated_at = now();

-- Advanced prices
INSERT INTO plan_prices (plan_id, currency, interval, unit_amount, is_active, billing_provider_price_id)
SELECT sp.id, v.currency, v.interval, v.unit_amount, true, v.provider_id
FROM subscription_plans sp
CROSS JOIN (VALUES
  ('GBP', 'monthly', 5999,  'pending_advanced_gbp_monthly'),
  ('USD', 'monthly', 7999,  'pending_advanced_usd_monthly'),
  ('EUR', 'monthly', 6999,  'pending_advanced_eur_monthly'),
  ('GBP', 'annual',  59990, 'pending_advanced_gbp_annual'),
  ('USD', 'annual',  79990, 'pending_advanced_usd_annual'),
  ('EUR', 'annual',  69990, 'pending_advanced_eur_annual')
) AS v(currency, interval, unit_amount, provider_id)
WHERE sp.slug = 'advanced'
ON CONFLICT (plan_id, currency, interval) DO UPDATE SET
  unit_amount = EXCLUDED.unit_amount,
  is_active = EXCLUDED.is_active,
  billing_provider_price_id = EXCLUDED.billing_provider_price_id,
  updated_at = now();
