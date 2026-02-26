-- 013_upload_post_mapping.sql
-- Minimal audit trail for Upload-Post connect-url generation.
-- One row per Supabase user; upserted each time a connect URL is generated.

CREATE TABLE IF NOT EXISTS public.upload_post_mapping (
  user_id                       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  upload_post_username           text,
  last_connect_url_generated_at  timestamptz,
  created_at                     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.upload_post_mapping ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by the connect-url route)
CREATE POLICY "Service role full access on upload_post_mapping"
  ON public.upload_post_mapping
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Users can read their own mapping row
CREATE POLICY "Users can read own upload_post_mapping"
  ON public.upload_post_mapping
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all rows
CREATE POLICY "Admins can read all upload_post_mapping"
  ON public.upload_post_mapping
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );
