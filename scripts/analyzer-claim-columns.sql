-- ============================================================================
-- ZARZOOM Social Profile Analyzer
-- Migration: claim columns on analysis_queue
-- analysis_cache.claimed_user_id already exists from analyzer-tables.sql
-- ============================================================================

-- Add claimed_user_id to analysis_queue so we know which user owns the job
ALTER TABLE public.analysis_queue
  ADD COLUMN IF NOT EXISTS claimed_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_queue_claimed_user
  ON public.analysis_queue (claimed_user_id);

-- RLS policy: authenticated users can read their own queue items
DROP POLICY IF EXISTS "analysis_queue_select_own" ON public.analysis_queue;
CREATE POLICY "analysis_queue_select_own" ON public.analysis_queue
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND claimed_user_id = auth.uid()
  );
