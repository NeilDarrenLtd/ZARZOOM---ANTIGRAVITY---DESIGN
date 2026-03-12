-- ============================================================================
-- ZARZOOM Social Profile Analyzer
-- Migration: analysis_cache + analysis_queue tables
-- ============================================================================

-- ---------------------------------------------------------------------------
-- analysis_cache
-- Stores both instant deterministic output and AI output for a given profile.
-- profile_hash is SHA-256(platform + ":" + normalised_profile_url).
-- TTL = 24 hours (enforced in application by comparing NOW() < expires_at).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analysis_cache (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_hash     text        NOT NULL,
  profile_url      text        NOT NULL,
  platform         text        NOT NULL,
  status           text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'failed')),
  instant_json     jsonb,
  analysis_json    jsonb,           -- raw AI output (for debugging)
  ui_json          jsonb,           -- normalised UI contract (for rendering)
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  claimed_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT analysis_cache_hash_unique UNIQUE (profile_hash)
);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_profile_hash  ON public.analysis_cache (profile_hash);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_status        ON public.analysis_cache (status);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_expires_at    ON public.analysis_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_claimed_user  ON public.analysis_cache (claimed_user_id);

-- RLS -------------------------------------------------------------------
ALTER TABLE public.analysis_cache ENABLE ROW LEVEL SECURITY;

-- Service role has unrestricted access (workers, API routes using admin client)
CREATE POLICY "analysis_cache_service_role" ON public.analysis_cache
  FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can read their own claimed analyses
CREATE POLICY "analysis_cache_select_own" ON public.analysis_cache
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND claimed_user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- analysis_queue
-- Lightweight queue table for async AI processing jobs.
-- The existing `jobs` table handles authenticated tenant jobs.
-- This table is intentionally public-facing (no tenant_id) to support
-- unauthenticated homepage visitors triggering analyses.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analysis_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_url  text        NOT NULL,
  platform     text        NOT NULL,
  email        text,
  session_id   text        NOT NULL,
  ip_address   text        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payload_json jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_queue_status      ON public.analysis_queue (status);
CREATE INDEX IF NOT EXISTS idx_analysis_queue_session_id  ON public.analysis_queue (session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_queue_ip_address  ON public.analysis_queue (ip_address);
CREATE INDEX IF NOT EXISTS idx_analysis_queue_created_at  ON public.analysis_queue (created_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_analysis_queue_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analysis_queue_updated_at ON public.analysis_queue;
CREATE TRIGGER trg_analysis_queue_updated_at
  BEFORE UPDATE ON public.analysis_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_analysis_queue_updated_at();

-- RLS -------------------------------------------------------------------
ALTER TABLE public.analysis_queue ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "analysis_queue_service_role" ON public.analysis_queue
  FOR ALL
  USING (auth.role() = 'service_role');

-- Unauthenticated visitors can INSERT their own queue item (rate-limited at API layer)
CREATE POLICY "analysis_queue_anon_insert" ON public.analysis_queue
  FOR INSERT
  WITH CHECK (true);

-- No SELECT for anon – status is polled via the API using the returned id.
