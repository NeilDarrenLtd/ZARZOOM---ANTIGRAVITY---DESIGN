-- ============================================================================
-- 022: Generic activity_logs table for analyzer + system activity
--
-- Provides a simple, append-only log stream that admin UIs can query
-- (e.g. /admin/logs) to trace key application flows such as the homepage
-- Social Analyzer.
--
-- This mirrors the wizard_autofill_audit pattern but is intentionally
-- generic and stage-based so multiple features can share it.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text NOT NULL,              -- e.g. 'analyzer', 'wizard', 'billing'
  stage        text NOT NULL,              -- e.g. 'analyzer.api.start_hit'
  level        text NOT NULL DEFAULT 'info', -- 'info' | 'warn' | 'error'
  analysis_id  text,                       -- analyzer run id or similar
  user_id      uuid,                       -- auth.users.id when available
  session_id   text,                       -- anonymous or browser session identifier
  profile_url  text,
  platform     text,
  source       text,                       -- 'frontend' | 'backend' | 'worker' | other
  details      jsonb,                      -- structured metadata blob
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_category_stage
  ON public.activity_logs (category, stage, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_analysis_id
  ON public.activity_logs (analysis_id, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all activity logs via the authenticated context.
DROP POLICY IF EXISTS "Admins can read all activity logs" ON public.activity_logs;
CREATE POLICY "Admins can read all activity logs" ON public.activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- Service role (used by server-side helpers) has full access.
DROP POLICY IF EXISTS "Service role full access on activity_logs" ON public.activity_logs;
CREATE POLICY "Service role full access on activity_logs" ON public.activity_logs
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

