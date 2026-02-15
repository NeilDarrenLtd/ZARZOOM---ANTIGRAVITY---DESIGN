-- ============================================================================
-- Migration 004: Extend schema for multi-tenant provider secrets, user-managed
-- API keys, plan scoping, enriched audit logging, and usage counters.
--
-- This migration is ADDITIVE -- it never drops existing columns, only adds
-- new ones with safe defaults so existing rows remain valid.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. SECURITY-DEFINER HELPERS (re-usable across RLS policies)
-- ============================================================================

-- is_admin already exists from 003_fix_rls_recursion; ensure it's present.
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = check_user_id AND is_admin = true
  );
END;
$$;

-- Check whether a user belongs to a given tenant (any role).
CREATE OR REPLACE FUNCTION public.is_tenant_member(
  check_user_id UUID,
  check_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = check_user_id AND tenant_id = check_tenant_id
  );
END;
$$;

-- Check whether a user is an admin/owner within a given tenant.
CREATE OR REPLACE FUNCTION public.is_tenant_admin(
  check_user_id UUID,
  check_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = check_user_id
      AND tenant_id = check_tenant_id
      AND role IN ('super_admin', 'admin', 'owner')
  );
END;
$$;


-- ============================================================================
-- 1. PROVIDER_SECRETS -- extend with secret_type, created_by, updated_by
-- ============================================================================

ALTER TABLE public.provider_secrets
  ADD COLUMN IF NOT EXISTS secret_type TEXT NOT NULL DEFAULT 'api_key',
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES auth.users(id);

-- Add a constraint to validate secret_type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'provider_secrets_secret_type_check'
  ) THEN
    ALTER TABLE public.provider_secrets
      ADD CONSTRAINT provider_secrets_secret_type_check
      CHECK (secret_type IN ('api_key', 'json_config', 'service_account_ref'));
  END IF;
END $$;

-- Add a unique constraint on (tenant_id, provider, secret_type) if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'provider_secrets_tenant_provider_type_key'
  ) THEN
    -- We skip this if there are duplicates; the app uses (tenant_id, provider, key_name)
    -- but the spec asks for (tenant_id, provider, secret_type). Add as a partial unique
    -- only for active secrets to avoid conflicts with rotated (inactive) rows.
    CREATE UNIQUE INDEX IF NOT EXISTS provider_secrets_tenant_provider_type_active_idx
      ON public.provider_secrets (tenant_id, provider, secret_type)
      WHERE active = true;
  END IF;
END $$;


-- ============================================================================
-- 2. API_KEYS -- entirely new table for user-managed ZARZOOM API keys
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  key_hash    TEXT NOT NULL,
  key_prefix  TEXT NOT NULL,            -- e.g. "zarz_live_"
  scopes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  CONSTRAINT api_keys_tenant_hash_unique UNIQUE (tenant_id, key_hash)
);

-- Indexes
CREATE INDEX IF NOT EXISTS api_keys_tenant_user_idx ON public.api_keys (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx    ON public.api_keys (key_hash);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Service role: full access
CREATE POLICY "Service role full access on api_keys"
  ON public.api_keys FOR ALL
  USING (true)
  WITH CHECK (true);

-- Users can read ONLY their own keys within their tenant
CREATE POLICY "Users can read own api_keys"
  ON public.api_keys FOR SELECT
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND user_id = auth.uid()
  );

-- Users can insert keys for themselves
CREATE POLICY "Users can create own api_keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND user_id = auth.uid()
  );

-- Users can revoke (update) only their own keys
CREATE POLICY "Users can update own api_keys"
  ON public.api_keys FOR UPDATE
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND user_id = auth.uid()
  );

-- Tenant admins can read all keys in their tenant (for management)
CREATE POLICY "Tenant admins can read all api_keys"
  ON public.api_keys FOR SELECT
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

-- Tenant admins can revoke any key in their tenant
CREATE POLICY "Tenant admins can update all api_keys"
  ON public.api_keys FOR UPDATE
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );


-- ============================================================================
-- 3. SUBSCRIPTION_PLANS -- add scope & tenant_id for tenant-specific plans
-- ============================================================================

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS scope     TEXT NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Validate scope
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_scope_check'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD CONSTRAINT subscription_plans_scope_check
      CHECK (scope IN ('global', 'tenant'));
  END IF;
END $$;

-- Ensure tenant_id is set when scope = 'tenant'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_tenant_scope_check'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD CONSTRAINT subscription_plans_tenant_scope_check
      CHECK (
        (scope = 'global' AND tenant_id IS NULL)
        OR
        (scope = 'tenant' AND tenant_id IS NOT NULL)
      );
  END IF;
END $$;


-- ============================================================================
-- 4. PLAN_PRICES -- add effective window & created_by
-- ============================================================================

ALTER TABLE public.plan_prices
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS effective_to   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by     UUID REFERENCES auth.users(id);

-- Composite index for the active-prices view
CREATE INDEX IF NOT EXISTS plan_prices_active_lookup_idx
  ON public.plan_prices (plan_id, currency, interval, is_active)
  WHERE is_active = true AND (effective_to IS NULL OR effective_to > now());


-- ============================================================================
-- 5. TENANT_SUBSCRIPTIONS -- add user_id who initiated subscription
-- ============================================================================

ALTER TABLE public.tenant_subscriptions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);


-- ============================================================================
-- 6. USAGE_COUNTERS -- add date-typed period columns
--    Existing table has (metric TEXT, period TEXT, count INT).
--    We add period_start/period_end as DATE for the requested shape,
--    keeping the original 'period' column intact.
-- ============================================================================

ALTER TABLE public.usage_counters
  ADD COLUMN IF NOT EXISTS period_start DATE,
  ADD COLUMN IF NOT EXISTS period_end   DATE,
  ADD COLUMN IF NOT EXISTS counter_type TEXT;

-- Backfill counter_type from metric where NULL
UPDATE public.usage_counters
SET counter_type = metric
WHERE counter_type IS NULL;

-- Add a unique index for the new lookup pattern
CREATE UNIQUE INDEX IF NOT EXISTS usage_counters_tenant_type_period_idx
  ON public.usage_counters (tenant_id, counter_type, period_start, period_end)
  WHERE counter_type IS NOT NULL AND period_start IS NOT NULL;


-- ============================================================================
-- 7. ADMIN_AUDIT -- add entity_type, entity_id, before/after JSON, IP, UA
--    Existing columns: action, user_id, tenant_id, changes, record_id,
--    table_name, created_at.
-- ============================================================================

ALTER TABLE public.admin_audit
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id   TEXT,
  ADD COLUMN IF NOT EXISTS before_json JSONB,
  ADD COLUMN IF NOT EXISTS after_json  JSONB,
  ADD COLUMN IF NOT EXISTS ip          TEXT,
  ADD COLUMN IF NOT EXISTS user_agent  TEXT;

-- Backfill entity_type / entity_id from existing table_name / record_id
UPDATE public.admin_audit
SET entity_type = table_name,
    entity_id   = record_id::text
WHERE entity_type IS NULL AND table_name IS NOT NULL;


-- ============================================================================
-- 8. ACTIVE_PLAN_PRICES VIEW
--    Returns the latest active effective price per plan / currency / interval.
-- ============================================================================

CREATE OR REPLACE VIEW public.active_plan_prices AS
SELECT DISTINCT ON (pp.plan_id, pp.currency, pp.interval)
  pp.id             AS price_id,
  pp.plan_id,
  sp.name           AS plan_name,
  sp.slug           AS plan_slug,
  pp.currency,
  pp.interval,
  pp.unit_amount,
  pp.effective_from,
  pp.effective_to,
  pp.billing_provider_price_id,
  pp.is_active
FROM public.plan_prices pp
JOIN public.subscription_plans sp ON sp.id = pp.plan_id
WHERE pp.is_active = true
  AND pp.effective_from <= now()
  AND (pp.effective_to IS NULL OR pp.effective_to > now())
  AND sp.is_active = true
ORDER BY pp.plan_id, pp.currency, pp.interval, pp.effective_from DESC;


-- ============================================================================
-- 9. REFRESH RLS POLICIES for provider_secrets
--    Add policy for created_by / updated_by tracking.
-- ============================================================================

-- Drop and recreate the insert policy to also check created_by
DROP POLICY IF EXISTS "Tenant owner/admin can insert secrets" ON public.provider_secrets;
CREATE POLICY "Tenant owner/admin can insert secrets"
  ON public.provider_secrets FOR INSERT
  WITH CHECK (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

-- Drop and recreate the update policy
DROP POLICY IF EXISTS "Tenant owner/admin can update secrets" ON public.provider_secrets;
CREATE POLICY "Tenant owner/admin can update secrets"
  ON public.provider_secrets FOR UPDATE
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

-- Add a SELECT policy so tenant admins can read their own secrets metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_secrets'
      AND policyname = 'Tenant admins can read own secrets'
  ) THEN
    CREATE POLICY "Tenant admins can read own secrets"
      ON public.provider_secrets FOR SELECT
      USING (
        public.is_tenant_admin(auth.uid(), tenant_id)
      );
  END IF;
END $$;


-- ============================================================================
-- 10. SEED PLAN QUOTAS UPDATE
--     Update existing plans with the expanded quotas_json shape requested.
-- ============================================================================

UPDATE public.subscription_plans
SET quota_policy = jsonb_build_object(
      'posts_published_count', 30,
      'images_generated_count', 10,
      'articles_generated_count', 0,
      'scripts_generated_count', 0,
      'videos_generated_count', 0,
      'max_jobs_in_flight', 2,
      'max_video_seconds_per_month', 0,
      'max_research_runs_per_day', 0,
      'max_api_keys', 2
    ),
    updated_at = now()
WHERE slug = 'basic';

UPDATE public.subscription_plans
SET quota_policy = jsonb_build_object(
      'posts_published_count', 150,
      'images_generated_count', 50,
      'articles_generated_count', 30,
      'scripts_generated_count', 0,
      'videos_generated_count', 0,
      'max_jobs_in_flight', 5,
      'max_video_seconds_per_month', 0,
      'max_research_runs_per_day', 10,
      'max_api_keys', 5
    ),
    updated_at = now()
WHERE slug = 'pro';

UPDATE public.subscription_plans
SET quota_policy = jsonb_build_object(
      'posts_published_count', 500,
      'images_generated_count', 200,
      'articles_generated_count', 100,
      'scripts_generated_count', 50,
      'videos_generated_count', 20,
      'max_jobs_in_flight', 10,
      'max_video_seconds_per_month', 600,
      'max_research_runs_per_day', 50,
      'max_api_keys', 20
    ),
    updated_at = now()
WHERE slug = 'advanced';


COMMIT;
