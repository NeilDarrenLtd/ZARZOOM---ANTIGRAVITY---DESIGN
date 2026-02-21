-- ============================================================================
-- Migration 006: Wizard Auto-fill Feature
--
-- Creates tables and RLS policies to support:
-- - OpenRouter prompt configuration for admin
-- - Audit logs for wizard auto-fill analysis runs
-- - Enhanced onboarding_profiles with auto-fill metadata
-- - Supabase Storage bucket: wizard-uploads (PRIVATE)
-- 
-- Dependencies:
-- - Requires public.is_admin() function from 003_fix_rls_recursion.sql
-- - Requires public.profiles table with is_admin column from 001_create_schema.sql
-- - Requires public.onboarding_profiles table from 001_create_onboarding_profiles.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. WIZARD_AUTOFILL_SETTINGS -- Admin-configurable OpenRouter prompts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wizard_autofill_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- OpenRouter prompts for different analysis sources
  website_prompt_text TEXT NOT NULL DEFAULT 
    'Analyze the provided website content and extract brand information including business name, description, brand colors, content style, and target audience. Return structured JSON with fields: business_name, business_description, brand_colors[], content_styles[], language.',
  
  file_prompt_text TEXT NOT NULL DEFAULT 
    'Analyze the provided document content and extract brand information including business name, description, brand colors, content style, and target audience. Return structured JSON with fields: business_name, business_description, brand_colors[], content_styles[], language.',
  
  -- Feature flags
  website_autofill_enabled BOOLEAN NOT NULL DEFAULT true,
  file_autofill_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Model configuration
  openrouter_model TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
  max_tokens INTEGER NOT NULL DEFAULT 1500,
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  
  -- Audit
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure only one settings row exists
  CONSTRAINT single_settings_row CHECK (id = gen_random_uuid())
);

-- Ensure only one row can exist (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS wizard_autofill_settings_singleton 
  ON public.wizard_autofill_settings ((true));

-- Enable RLS
ALTER TABLE public.wizard_autofill_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read settings
CREATE POLICY "wizard_autofill_settings_admin_select"
  ON public.wizard_autofill_settings FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Only admins can insert settings (singleton pattern prevents multiple rows)
CREATE POLICY "wizard_autofill_settings_admin_insert"
  ON public.wizard_autofill_settings FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Only admins can update settings
CREATE POLICY "wizard_autofill_settings_admin_update"
  ON public.wizard_autofill_settings FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- Seed default settings
INSERT INTO public.wizard_autofill_settings (
  website_prompt_text,
  file_prompt_text
) VALUES (
  'Analyze the provided website content and extract brand information including business name, description, brand colors, content style, and target audience. Return structured JSON with fields: business_name, business_description, brand_colors[], content_styles[], language.',
  'Analyze the provided document content and extract brand information including business name, description, brand colors, content style, and target audience. Return structured JSON with fields: business_name, business_description, brand_colors[], content_styles[], language.'
)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- 2. WIZARD_AUTOFILL_AUDIT -- Audit logs for analysis runs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wizard_autofill_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User and source tracking
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('website', 'file')),
  source_value TEXT NOT NULL, -- URL or filename
  
  -- Analysis result status
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'error')),
  
  -- Extracted data (what was filled)
  extracted_fields JSONB, -- { "business_name": "...", "brand_color_hex": "..." }
  fields_filled TEXT[], -- ["business_name", "business_description"]
  
  -- Error handling
  error_message TEXT,
  error_code TEXT,
  
  -- OpenRouter metadata
  openrouter_model TEXT,
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  
  -- File upload metadata (if source_type = 'file')
  file_size_bytes INTEGER,
  file_mime_type TEXT,
  file_storage_path TEXT, -- Path in Supabase Storage
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS wizard_autofill_audit_user_id_idx 
  ON public.wizard_autofill_audit (user_id);

CREATE INDEX IF NOT EXISTS wizard_autofill_audit_created_at_idx 
  ON public.wizard_autofill_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS wizard_autofill_audit_source_type_idx 
  ON public.wizard_autofill_audit (source_type);

CREATE INDEX IF NOT EXISTS wizard_autofill_audit_status_idx 
  ON public.wizard_autofill_audit (status);

-- Enable RLS
ALTER TABLE public.wizard_autofill_audit ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit logs
CREATE POLICY "wizard_autofill_audit_select_own"
  ON public.wizard_autofill_audit FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own audit logs (via API)
CREATE POLICY "wizard_autofill_audit_insert_own"
  ON public.wizard_autofill_audit FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all audit logs
CREATE POLICY "wizard_autofill_audit_admin_select"
  ON public.wizard_autofill_audit FOR SELECT
  USING (public.is_admin(auth.uid()));


-- ============================================================================
-- 3. ENHANCE ONBOARDING_PROFILES -- Add auto-fill metadata columns
-- ============================================================================

-- Add new columns to track auto-fill state
ALTER TABLE public.onboarding_profiles
  ADD COLUMN IF NOT EXISTS autofilled_from_source TEXT 
    CHECK (autofilled_from_source IS NULL OR autofilled_from_source IN ('website', 'file'));

ALTER TABLE public.onboarding_profiles
  ADD COLUMN IF NOT EXISTS autofill_source_value TEXT; -- URL or filename

ALTER TABLE public.onboarding_profiles
  ADD COLUMN IF NOT EXISTS autofill_performed_at TIMESTAMPTZ;

ALTER TABLE public.onboarding_profiles
  ADD COLUMN IF NOT EXISTS autofill_fields_filled TEXT[]; -- Array of field names that were auto-filled

ALTER TABLE public.onboarding_profiles
  ADD COLUMN IF NOT EXISTS autofill_audit_id UUID REFERENCES public.wizard_autofill_audit(id) ON DELETE SET NULL;

-- Add comment to document the new columns
COMMENT ON COLUMN public.onboarding_profiles.autofilled_from_source IS 
  'Tracks whether this profile was auto-filled from a website or uploaded file';

COMMENT ON COLUMN public.onboarding_profiles.autofill_source_value IS 
  'The URL or filename that was used for auto-filling';

COMMENT ON COLUMN public.onboarding_profiles.autofill_performed_at IS 
  'Timestamp when the auto-fill was performed';

COMMENT ON COLUMN public.onboarding_profiles.autofill_fields_filled IS 
  'Array of field names that were successfully auto-filled';

COMMENT ON COLUMN public.onboarding_profiles.autofill_audit_id IS 
  'Reference to the audit log entry for this auto-fill operation';


-- ============================================================================
-- 4. SUPABASE STORAGE BUCKET -- wizard-uploads (PRIVATE)
-- ============================================================================

-- Create storage bucket for wizard file uploads
-- Note: This must be run as a SQL query in Supabase Dashboard or via service role
-- because storage.buckets is not accessible in standard migrations

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wizard-uploads',
  'wizard-uploads',
  false, -- PRIVATE bucket
  10485760, -- 10MB max file size
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for wizard-uploads bucket
-- Users can upload files to their own folder
CREATE POLICY "wizard_uploads_user_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'wizard-uploads' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their own uploaded files
CREATE POLICY "wizard_uploads_user_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'wizard-uploads' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own uploaded files
CREATE POLICY "wizard_uploads_user_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'wizard-uploads' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can read all wizard uploads
CREATE POLICY "wizard_uploads_admin_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'wizard-uploads' 
    AND public.is_admin(auth.uid())
  );


-- ============================================================================
-- 5. HELPER FUNCTIONS -- Utility functions for wizard auto-fill
-- ============================================================================

-- Function to get wizard auto-fill settings (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_wizard_autofill_settings()
RETURNS TABLE (
  website_prompt TEXT,
  file_prompt TEXT,
  website_enabled BOOLEAN,
  file_enabled BOOLEAN,
  model TEXT,
  max_tokens INTEGER,
  temperature NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    website_prompt_text,
    file_prompt_text,
    website_autofill_enabled,
    file_autofill_enabled,
    openrouter_model,
    wizard_autofill_settings.max_tokens,
    wizard_autofill_settings.temperature
  FROM public.wizard_autofill_settings
  LIMIT 1;
END;
$$;

-- Function to log wizard auto-fill attempt
CREATE OR REPLACE FUNCTION public.log_wizard_autofill(
  p_user_id UUID,
  p_source_type TEXT,
  p_source_value TEXT,
  p_status TEXT,
  p_extracted_fields JSONB DEFAULT NULL,
  p_fields_filled TEXT[] DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_openrouter_model TEXT DEFAULT NULL,
  p_tokens_used INTEGER DEFAULT NULL,
  p_processing_time_ms INTEGER DEFAULT NULL,
  p_file_size_bytes INTEGER DEFAULT NULL,
  p_file_mime_type TEXT DEFAULT NULL,
  p_file_storage_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO public.wizard_autofill_audit (
    user_id,
    source_type,
    source_value,
    status,
    extracted_fields,
    fields_filled,
    error_message,
    error_code,
    openrouter_model,
    tokens_used,
    processing_time_ms,
    file_size_bytes,
    file_mime_type,
    file_storage_path
  ) VALUES (
    p_user_id,
    p_source_type,
    p_source_value,
    p_status,
    p_extracted_fields,
    p_fields_filled,
    p_error_message,
    p_error_code,
    p_openrouter_model,
    p_tokens_used,
    p_processing_time_ms,
    p_file_size_bytes,
    p_file_mime_type,
    p_file_storage_path
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_wizard_autofill_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_wizard_autofill(UUID, TEXT, TEXT, TEXT, JSONB, TEXT[], TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT) TO authenticated;


-- ============================================================================
-- 6. AUTO-UPDATE TRIGGER -- Update wizard_autofill_settings.updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_wizard_autofill_settings_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wizard_autofill_settings_updated_at ON public.wizard_autofill_settings;

CREATE TRIGGER wizard_autofill_settings_updated_at
  BEFORE UPDATE ON public.wizard_autofill_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_wizard_autofill_settings_timestamp();


-- ============================================================================
-- 7. INDEXES AND CONSTRAINTS
-- ============================================================================

-- Index for quick lookup of auto-filled profiles
CREATE INDEX IF NOT EXISTS onboarding_profiles_autofilled_idx 
  ON public.onboarding_profiles (autofilled_from_source) 
  WHERE autofilled_from_source IS NOT NULL;

-- Index for audit log lookups by audit_id
CREATE INDEX IF NOT EXISTS onboarding_profiles_autofill_audit_id_idx 
  ON public.onboarding_profiles (autofill_audit_id) 
  WHERE autofill_audit_id IS NOT NULL;


COMMIT;


-- ============================================================================
-- VERIFICATION QUERIES (Run these manually to verify the migration)
-- ============================================================================

-- Check that wizard_autofill_settings table exists and has default row
-- SELECT * FROM public.wizard_autofill_settings;

-- Check that wizard_autofill_audit table exists
-- SELECT COUNT(*) FROM public.wizard_autofill_audit;

-- Check that onboarding_profiles has new columns
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'onboarding_profiles'
--   AND column_name LIKE 'autofill%';

-- Check that wizard-uploads storage bucket exists
-- SELECT * FROM storage.buckets WHERE id = 'wizard-uploads';

-- Check that storage policies exist for wizard-uploads
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'wizard_uploads%';
