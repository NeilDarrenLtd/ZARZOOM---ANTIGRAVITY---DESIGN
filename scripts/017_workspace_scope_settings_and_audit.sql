-- ============================================================================
-- 017: Workspace-scope settings and audit tables
--
-- Ensures:
-- - tenant_settings exists (one row per tenant for default_language etc.)
-- - upload_post_mapping is per (tenant_id, user_id) not per user
-- - wizard_autofill_audit includes tenant_id for per-workspace audit trail
--
-- Run after 016_onboarding_per_workspace.sql. Requires tenants, tenant_memberships.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TENANT_SETTINGS (create if not exists)
-- One row per tenant for admin/default settings (e.g. default_language).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  tenant_id         uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  default_language  text NOT NULL DEFAULT 'en',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- RLS: tenant members can read; tenant admins can insert/update
DROP POLICY IF EXISTS "tenant_settings_select_member" ON public.tenant_settings;
CREATE POLICY "tenant_settings_select_member" ON public.tenant_settings
  FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "tenant_settings_insert_admin" ON public.tenant_settings;
CREATE POLICY "tenant_settings_insert_admin" ON public.tenant_settings
  FOR INSERT WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "tenant_settings_update_admin" ON public.tenant_settings;
CREATE POLICY "tenant_settings_update_admin" ON public.tenant_settings
  FOR UPDATE USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Service role full access
DROP POLICY IF EXISTS "tenant_settings_service_role" ON public.tenant_settings;
CREATE POLICY "tenant_settings_service_role" ON public.tenant_settings
  FOR ALL USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- ============================================================================
-- 2. UPLOAD_POST_MAPPING – add tenant_id, one row per (tenant_id, user_id)
-- ============================================================================

-- Add column (nullable first for backfill)
ALTER TABLE public.upload_post_mapping
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Backfill: set tenant_id from first tenant_membership per user (created_at asc)
UPDATE public.upload_post_mapping upm
SET tenant_id = (
  SELECT tm.tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = upm.user_id
  ORDER BY tm.created_at ASC
  LIMIT 1
)
WHERE upm.tenant_id IS NULL;

-- Delete rows that could not be backfilled (user has no membership)
DELETE FROM public.upload_post_mapping WHERE tenant_id IS NULL;

-- Now enforce NOT NULL
ALTER TABLE public.upload_post_mapping
  ALTER COLUMN tenant_id SET NOT NULL;

-- Drop old primary key and add composite
ALTER TABLE public.upload_post_mapping
  DROP CONSTRAINT IF EXISTS upload_post_mapping_pkey;

ALTER TABLE public.upload_post_mapping
  ADD PRIMARY KEY (tenant_id, user_id);

-- Index for lookups by user (e.g. admin list)
CREATE INDEX IF NOT EXISTS upload_post_mapping_user_id_idx
  ON public.upload_post_mapping (user_id);

-- RLS: users can read rows for tenants they belong to where they are the user
DROP POLICY IF EXISTS "Users can read own upload_post_mapping" ON public.upload_post_mapping;
CREATE POLICY "Users can read own upload_post_mapping" ON public.upload_post_mapping
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND public.is_tenant_member(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS "Admins can read all upload_post_mapping" ON public.upload_post_mapping;
CREATE POLICY "Admins can read all upload_post_mapping" ON public.upload_post_mapping
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Service role (for connect-url upsert) already has FOR ALL; ensure it exists
DROP POLICY IF EXISTS "Service role full access on upload_post_mapping" ON public.upload_post_mapping;
CREATE POLICY "Service role full access on upload_post_mapping" ON public.upload_post_mapping
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. WIZARD_AUTOFILL_AUDIT – add tenant_id for per-workspace audit
-- ============================================================================

-- Add column (nullable first for backfill)
ALTER TABLE public.wizard_autofill_audit
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Backfill: set tenant_id from first tenant_membership per user
UPDATE public.wizard_autofill_audit wa
SET tenant_id = (
  SELECT tm.tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = wa.user_id
  ORDER BY tm.created_at ASC
  LIMIT 1
)
WHERE wa.tenant_id IS NULL;

-- Keep tenant_id nullable so old rows without membership are valid; new inserts should set it
-- Index for per-tenant audit queries
CREATE INDEX IF NOT EXISTS idx_wizard_autofill_audit_tenant_id
  ON public.wizard_autofill_audit (tenant_id);

CREATE INDEX IF NOT EXISTS idx_wizard_autofill_audit_tenant_created
  ON public.wizard_autofill_audit (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- RLS: users can read own audit entries (same as before); optionally restrict to tenant membership when tenant_id is set
DROP POLICY IF EXISTS "Users can read own audit" ON public.wizard_autofill_audit;
CREATE POLICY "Users can read own audit" ON public.wizard_autofill_audit
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND (tenant_id IS NULL OR public.is_tenant_member(auth.uid(), tenant_id))
  );

-- ============================================================================
-- 4. BRAND-LOGOS STORAGE – allow workspace-scoped paths (tenant_id/user_id/file)
-- ============================================================================

-- Allow upload to path tenant_id/user_id/filename when user is member of tenant
DROP POLICY IF EXISTS "Users can upload brand logos to workspace folder" ON storage.objects;
CREATE POLICY "Users can upload brand logos to workspace folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'brand-logos'
    AND array_length(storage.foldername(name)) >= 2
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- Allow update in workspace folder (tenant_id/user_id/file)
DROP POLICY IF EXISTS "Users can update brand logos in workspace folder" ON storage.objects;
CREATE POLICY "Users can update brand logos in workspace folder"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'brand-logos'
    AND array_length(storage.foldername(name)) >= 2
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

COMMIT;
