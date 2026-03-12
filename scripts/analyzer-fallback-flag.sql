-- Migration: add is_fallback flag and email index to analysis_queue
-- Fallback rows are inserted when the analyzer service is unavailable.
-- They are processed by /api/analyzer/fallback-notify to send delivery emails.

ALTER TABLE public.analysis_queue
  ADD COLUMN IF NOT EXISTS is_fallback boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_analysis_queue_fallback
  ON public.analysis_queue (is_fallback, status)
  WHERE is_fallback = true;

CREATE INDEX IF NOT EXISTS idx_analysis_queue_email
  ON public.analysis_queue (email)
  WHERE email IS NOT NULL;
