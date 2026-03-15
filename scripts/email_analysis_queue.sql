-- email_analysis_queue: queue of analyzer fallback requests for admin follow-up.
-- When the floating analyzer fails, users can leave their email; this table
-- stores those requests so admins can process them manually.
--
-- Used by: POST /api/analyzer/fallback

CREATE TABLE IF NOT EXISTS public.email_analysis_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text,
  profile_url   text NOT NULL,
  platform      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  failure_type  text,
  status        text NOT NULL DEFAULT 'pending_manual_analysis'
                CHECK (status IN ('pending_manual_analysis', 'in_progress', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_email_analysis_queue_status
  ON public.email_analysis_queue (status);
CREATE INDEX IF NOT EXISTS idx_email_analysis_queue_created_at
  ON public.email_analysis_queue (created_at DESC);

ALTER TABLE public.email_analysis_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_analysis_queue_service_role"
  ON public.email_analysis_queue FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "email_analysis_queue_admin_all"
  ON public.email_analysis_queue FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Allow anonymous insert (rate-limited at API layer)
CREATE POLICY "email_analysis_queue_anon_insert"
  ON public.email_analysis_queue FOR INSERT
  WITH CHECK (true);
