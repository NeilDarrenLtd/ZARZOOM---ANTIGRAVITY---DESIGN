-- ============================================================================
-- Onboarding per workspace: add tenant_id to onboarding_profiles
-- One onboarding profile per (tenant, user). New workspaces get a blank wizard.
--
-- Run this migration BEFORE deploying app code that uses (tenant_id, user_id)
-- for onboarding_profiles. Requires: tenants, tenant_memberships, and
-- is_tenant_member() from 015_workspace_* scripts.
-- ============================================================================

BEGIN;

-- 1. Add tenant_id (nullable first for backfill)
ALTER TABLE public.onboarding_profiles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 2. Backfill: set tenant_id from first tenant_membership per user
UPDATE public.onboarding_profiles op
SET tenant_id = (
  SELECT tm.tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = op.user_id
  ORDER BY tm.created_at ASC
  LIMIT 1
)
WHERE op.tenant_id IS NULL;

-- 3. Set NOT NULL (only after backfill so no nulls remain)
ALTER TABLE public.onboarding_profiles
  ALTER COLUMN tenant_id SET NOT NULL;

-- 4. Drop existing primary key (user_id)
ALTER TABLE public.onboarding_profiles
  DROP CONSTRAINT IF EXISTS onboarding_profiles_pkey;

-- 5. Add composite primary key (tenant_id, user_id)
ALTER TABLE public.onboarding_profiles
  ADD PRIMARY KEY (tenant_id, user_id);

-- 6. Index for lookups by tenant
CREATE INDEX IF NOT EXISTS onboarding_profiles_tenant_id_idx
  ON public.onboarding_profiles (tenant_id);

-- 7. RLS: restrict to rows where user is a member of the tenant
DROP POLICY IF EXISTS "onboarding_select_own" ON public.onboarding_profiles;
CREATE POLICY "onboarding_select_own" ON public.onboarding_profiles
  FOR SELECT
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS "onboarding_insert_own" ON public.onboarding_profiles;
CREATE POLICY "onboarding_insert_own" ON public.onboarding_profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_tenant_member(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS "onboarding_update_own" ON public.onboarding_profiles;
CREATE POLICY "onboarding_update_own" ON public.onboarding_profiles
  FOR UPDATE
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
  )
  WITH CHECK (
    public.is_tenant_member(auth.uid(), tenant_id)
  );

COMMIT;
