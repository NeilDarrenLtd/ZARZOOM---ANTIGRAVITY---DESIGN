-- ============================================================================
-- Workspace tables only (no backfill).
-- Run this if 015_workspace_foundation.sql fails (e.g. missing public.profiles).
-- Creates: public.tenants, public.tenant_memberships, RLS, trigger, helper functions.
-- ============================================================================

BEGIN;

-- 1. TENANTS
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Workspace',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'payment_required', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenants_status_idx ON public.tenants (status);

-- 2. TENANT_MEMBERSHIPS
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS tenant_memberships_user_id_idx ON public.tenant_memberships (user_id);
CREATE INDEX IF NOT EXISTS tenant_memberships_tenant_id_idx ON public.tenant_memberships (tenant_id);

-- 3. Helper functions
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

-- 4. RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_select_if_member" ON public.tenants;
CREATE POLICY "tenants_select_if_member" ON public.tenants FOR SELECT
  USING (public.is_tenant_member(auth.uid(), id));

DROP POLICY IF EXISTS "tenants_update_if_admin" ON public.tenants;
CREATE POLICY "tenants_update_if_admin" ON public.tenants FOR UPDATE
  USING (public.is_tenant_admin(auth.uid(), id));

DROP POLICY IF EXISTS "tenants_service_role_all" ON public.tenants;
CREATE POLICY "tenants_service_role_all" ON public.tenants FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

DROP POLICY IF EXISTS "tenants_insert_authenticated" ON public.tenants;
CREATE POLICY "tenants_insert_authenticated" ON public.tenants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. RLS on tenant_memberships
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_memberships_select_own" ON public.tenant_memberships;
CREATE POLICY "tenant_memberships_select_own" ON public.tenant_memberships FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tenant_memberships_insert_own" ON public.tenant_memberships;
CREATE POLICY "tenant_memberships_insert_own" ON public.tenant_memberships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tenant_memberships_service_role_all" ON public.tenant_memberships;
CREATE POLICY "tenant_memberships_service_role_all" ON public.tenant_memberships FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- 6. updated_at trigger
CREATE OR REPLACE FUNCTION public.set_tenants_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_updated_at ON public.tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenants_updated_at();

COMMIT;
