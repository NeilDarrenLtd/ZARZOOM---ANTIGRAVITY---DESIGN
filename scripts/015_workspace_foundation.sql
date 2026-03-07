-- ============================================================================
-- Migration 015: Workspace (tenant) foundation
--
-- Adds workspace model supporting:
--   - workspace id (tenants.id)
--   - user ownership (tenant_memberships.role = 'owner')
--   - workspace name, status (draft | active | payment_required | inactive)
--   - created_at / updated_at
--
-- Prepares for per-workspace: onboarding, analytics, API keys, support tickets,
-- social integrations, billing (existing tenant_subscriptions already per tenant).
--
-- ADDITIVE ONLY: does not drop or rename. Backfills one workspace per user
-- who has no existing membership so current single-workspace behaviour is preserved.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TENANTS (workspace) table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Workspace',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'payment_required', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns if table already existed with fewer columns (additive only)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'My Workspace',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Enforce status constraint if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_status_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_status_check
      CHECK (status IN ('draft', 'active', 'payment_required', 'inactive'));
  END IF;
EXCEPTION
  WHEN others THEN
    -- Constraint may already exist under different name or as check on column; ignore
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS tenants_status_idx ON public.tenants (status);

-- ============================================================================
-- 2. TENANT_MEMBERSHIPS (user ↔ workspace ownership/membership)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.tenant_memberships
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Ensure NOT NULL and FK on tenant_id/user_id if added as nullable
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_memberships' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.tenant_memberships ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_memberships' AND column_name = 'user_id') THEN
    ALTER TABLE public.tenant_memberships ALTER COLUMN user_id SET NOT NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_memberships_tenant_user_key
  ON public.tenant_memberships (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS tenant_memberships_user_id_idx ON public.tenant_memberships (user_id);
CREATE INDEX IF NOT EXISTS tenant_memberships_tenant_id_idx ON public.tenant_memberships (tenant_id);

-- ============================================================================
-- 3. Ensure tenant helper functions exist (from migration 004)
-- ============================================================================

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

-- ============================================================================
-- 4. RLS on TENANTS
-- ============================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_select_if_member" ON public.tenants;
CREATE POLICY "tenants_select_if_member" ON public.tenants FOR SELECT
  USING (public.is_tenant_member(auth.uid(), id));

DROP POLICY IF EXISTS "tenants_update_if_admin" ON public.tenants;
CREATE POLICY "tenants_update_if_admin" ON public.tenants FOR UPDATE
  USING (public.is_tenant_admin(auth.uid(), id));

-- Service role / backend can insert (e.g. backfill, create workspace)
DROP POLICY IF EXISTS "tenants_service_role_all" ON public.tenants;
CREATE POLICY "tenants_service_role_all" ON public.tenants FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- Allow insert for authenticated users (create workspace flow; restrict in app as needed)
DROP POLICY IF EXISTS "tenants_insert_authenticated" ON public.tenants;
CREATE POLICY "tenants_insert_authenticated" ON public.tenants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- 5. RLS on TENANT_MEMBERSHIPS
-- ============================================================================

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_memberships_select_own" ON public.tenant_memberships;
CREATE POLICY "tenant_memberships_select_own" ON public.tenant_memberships FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated user can insert a membership for themselves (e.g. create workspace → add self as owner)
DROP POLICY IF EXISTS "tenant_memberships_insert_own" ON public.tenant_memberships;
CREATE POLICY "tenant_memberships_insert_own" ON public.tenant_memberships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tenant_memberships_service_role_all" ON public.tenant_memberships;
CREATE POLICY "tenant_memberships_service_role_all" ON public.tenant_memberships FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- ============================================================================
-- 6. UPDATED_AT trigger for tenants
-- ============================================================================

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

-- ============================================================================
-- 7. BACKFILL: one workspace per user who has no membership
--    Preserves single-workspace behaviour for existing users.
--    Uses SECURITY DEFINER so migration (auth.uid() = null) can insert.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.backfill_workspaces_for_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  new_tenant_id UUID;
BEGIN
  FOR r IN
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tenant_memberships tm WHERE tm.user_id = p.id
    )
  LOOP
    new_tenant_id := gen_random_uuid();
    INSERT INTO public.tenants (id, name, status, created_at, updated_at)
    VALUES (new_tenant_id, 'My Workspace', 'active', now(), now());
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, created_at)
    VALUES (new_tenant_id, r.user_id, 'owner', now());
  END LOOP;
END;
$$;

SELECT public.backfill_workspaces_for_users();

DROP FUNCTION IF EXISTS public.backfill_workspaces_for_users();

COMMIT;

-- ============================================================================
-- Notes for application
-- ============================================================================
-- - workspace_id  => tenants.id
-- - ownership     => tenant_memberships.role = 'owner' for that tenant
-- - name          => tenants.name
-- - status        => tenants.status (draft | active | payment_required | inactive)
-- - Existing tenant_subscriptions, api_keys, provider_secrets, etc. already
--   reference tenant_id; they now reference this tenants table (or did before
--   if tenants existed elsewhere). No change to those tables in this migration.
--
-- Backfill: Every profile with no tenant_memberships row gets one new tenant
-- (name 'My Workspace', status 'active') and one membership (role 'owner').
-- Run order: apply after 004 (is_tenant_member / is_tenant_admin) or this
-- migration recreates those functions.
