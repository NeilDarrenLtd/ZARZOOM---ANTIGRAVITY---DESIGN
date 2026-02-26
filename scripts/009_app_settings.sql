-- ============================================================
-- 009: Create app_settings table
-- Stores application-level config including Upload-Post credentials.
-- Single-row enforced by CHECK (id = 1).
-- RLS: service role only — no direct client access.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  id                               integer      PRIMARY KEY DEFAULT 1,
  upload_post_api_key              text         NULL,
  upload_post_logo_url             text         NULL,
  upload_post_connect_title        text         NULL,
  upload_post_connect_description  text         NULL,
  upload_post_redirect_button_text text         NULL,
  upload_post_default_platforms    text         NULL,
  updated_at                       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (idempotent)
DROP POLICY IF EXISTS "app_settings_service_role" ON public.app_settings;

-- Service role has full access; all other roles (including anon and authenticated) are denied
CREATE POLICY "app_settings_service_role"
  ON public.app_settings
  FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Seed default row ─────────────────────────────────────────

INSERT INTO public.app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
