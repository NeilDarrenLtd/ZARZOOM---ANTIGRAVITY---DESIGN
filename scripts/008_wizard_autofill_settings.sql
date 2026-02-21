-- ============================================================
-- 008: Create wizard_autofill_settings table for OpenRouter prompts
-- Also adds openrouter_api_key and openrouter_model fields
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wizard_autofill_settings (
  id            integer PRIMARY KEY DEFAULT 1,
  website_prompt text,
  file_prompt    text,
  feature_enabled boolean NOT NULL DEFAULT true,
  openrouter_api_key text,
  openrouter_model   text DEFAULT 'openai/gpt-4o-mini',
  updated_at     timestamptz DEFAULT now(),
  updated_by     uuid REFERENCES auth.users(id),
  CONSTRAINT singleton_row CHECK (id = 1)
);

-- RLS: only admins can access this table
ALTER TABLE public.wizard_autofill_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (idempotent)
DROP POLICY IF EXISTS "Admins can read autofill settings" ON public.wizard_autofill_settings;
DROP POLICY IF EXISTS "Admins can insert autofill settings" ON public.wizard_autofill_settings;
DROP POLICY IF EXISTS "Admins can update autofill settings" ON public.wizard_autofill_settings;
DROP POLICY IF EXISTS "Service role full access on autofill settings" ON public.wizard_autofill_settings;

-- Admin select
CREATE POLICY "Admins can read autofill settings"
  ON public.wizard_autofill_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Admin insert
CREATE POLICY "Admins can insert autofill settings"
  ON public.wizard_autofill_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Admin update
CREATE POLICY "Admins can update autofill settings"
  ON public.wizard_autofill_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Service role full access
CREATE POLICY "Service role full access on autofill settings"
  ON public.wizard_autofill_settings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Insert default row so queries don't fail with no rows
INSERT INTO public.wizard_autofill_settings (id, feature_enabled, openrouter_model)
VALUES (1, true, 'openai/gpt-4o-mini')
ON CONFLICT (id) DO NOTHING;
