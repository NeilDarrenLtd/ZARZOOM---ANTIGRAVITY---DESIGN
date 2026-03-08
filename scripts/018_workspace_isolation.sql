-- ============================================================================
-- Migration 018: Workspace data isolation (combined 016 + 018)
--
-- Applied via Supabase MCP as 'workspace_isolation'.
--
-- This migration was applied as a combined script because migration 016
-- (which adds tenant_id to onboarding_profiles) was never applied to the
-- production database. This script performs the full transformation:
--
-- 1. Adds tenant_id to onboarding_profiles (from migration 016)
-- 2. Backfills tenant_id from tenant_memberships
-- 3. Changes PK from user_id to tenant_id (sole PK)
-- 4. Creates blank profiles for workspaces missing one
-- 5. Adds tenant_id to support_tickets with backfill
-- 6. Updates all RLS policies to be tenant-aware
-- ============================================================================

-- ============================================================================
-- PART 1: onboarding_profiles - add tenant_id and change PK
-- ============================================================================

-- 1a. Add tenant_id column (nullable first for backfill)
ALTER TABLE public.onboarding_profiles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 1b. Backfill: assign existing row(s) to user's first workspace
UPDATE public.onboarding_profiles op
SET tenant_id = (
  SELECT tm.tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = op.user_id
  ORDER BY tm.created_at ASC
  LIMIT 1
)
WHERE op.tenant_id IS NULL;

-- 1c. Make tenant_id NOT NULL
ALTER TABLE public.onboarding_profiles
  ALTER COLUMN tenant_id SET NOT NULL;

-- 1d. Drop old PK (user_id) and set new PK (tenant_id only)
-- MUST happen before inserting additional rows for the same user
ALTER TABLE public.onboarding_profiles
  DROP CONSTRAINT IF EXISTS onboarding_profiles_pkey;

ALTER TABLE public.onboarding_profiles
  ADD PRIMARY KEY (tenant_id);

-- 1e. Create blank onboarding profiles for workspaces that don't have one
INSERT INTO public.onboarding_profiles (
  user_id, tenant_id, onboarding_status, onboarding_step, business_name,
  content_language, auto_publish, discount_opt_in, socials_connected, approval_preference
)
SELECT
  tm.user_id,
  tm.tenant_id,
  'not_started',
  1,
  t.name,
  'en',
  false,
  false,
  false,
  'manual'
FROM public.tenant_memberships tm
JOIN public.tenants t ON t.id = tm.tenant_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.onboarding_profiles op
  WHERE op.tenant_id = tm.tenant_id
);

-- 1f. Index for user_id reference lookups
CREATE INDEX IF NOT EXISTS onboarding_profiles_user_id_idx
  ON public.onboarding_profiles (user_id);

-- 1g. RLS policies for onboarding_profiles
DROP POLICY IF EXISTS "Users can read own onboarding" ON public.onboarding_profiles;
DROP POLICY IF EXISTS "Users can insert own onboarding" ON public.onboarding_profiles;
DROP POLICY IF EXISTS "Users can update own onboarding" ON public.onboarding_profiles;
DROP POLICY IF EXISTS "onboarding_select_own" ON public.onboarding_profiles;
DROP POLICY IF EXISTS "onboarding_insert_own" ON public.onboarding_profiles;
DROP POLICY IF EXISTS "onboarding_update_own" ON public.onboarding_profiles;

CREATE POLICY "onboarding_select_own" ON public.onboarding_profiles
  FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "onboarding_insert_own" ON public.onboarding_profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_tenant_member(auth.uid(), tenant_id)
  );

CREATE POLICY "onboarding_update_own" ON public.onboarding_profiles
  FOR UPDATE
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ============================================================================
-- PART 2: support_tickets - add tenant_id
-- ============================================================================

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Backfill: assign each existing ticket to the user's first workspace
UPDATE public.support_tickets st
SET tenant_id = (
  SELECT tm.tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = st.user_id
  ORDER BY tm.created_at ASC
  LIMIT 1
)
WHERE st.tenant_id IS NULL;

ALTER TABLE public.support_tickets
  ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS support_tickets_tenant_id_idx
  ON public.support_tickets (tenant_id);

-- ============================================================================
-- PART 3: RLS for support_tickets (tenant-aware)
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own tickets" ON public.support_tickets;
CREATE POLICY "Users can read own workspace tickets" ON public.support_tickets
  FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Users can create own tickets" ON public.support_tickets;
CREATE POLICY "Users can create own workspace tickets" ON public.support_tickets
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_tenant_member(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS "Users can update own tickets" ON public.support_tickets;
CREATE POLICY "Users can update own workspace tickets" ON public.support_tickets
  FOR UPDATE
  USING (public.is_tenant_member(auth.uid(), tenant_id));

-- ============================================================================
-- PART 4: RLS for support_comments (tenant-aware via ticket)
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own ticket comments" ON public.support_comments;
CREATE POLICY "Users can read own workspace ticket comments" ON public.support_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE id = ticket_id
      AND public.is_tenant_member(auth.uid(), tenant_id)
    )
  );

DROP POLICY IF EXISTS "Users can create comments on own tickets" ON public.support_comments;
CREATE POLICY "Users can create comments on own workspace tickets" ON public.support_comments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE id = ticket_id
      AND public.is_tenant_member(auth.uid(), tenant_id)
    )
  );

-- ============================================================================
-- PART 5: RLS for support_attachments (tenant-aware via ticket)
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own ticket attachments" ON public.support_attachments;
CREATE POLICY "Users can read own workspace ticket attachments" ON public.support_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE id = ticket_id
      AND public.is_tenant_member(auth.uid(), tenant_id)
    )
  );

DROP POLICY IF EXISTS "Users can upload attachments to own tickets" ON public.support_attachments;
CREATE POLICY "Users can upload attachments to own workspace tickets" ON public.support_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE id = ticket_id
      AND public.is_tenant_member(auth.uid(), tenant_id)
    )
  );
