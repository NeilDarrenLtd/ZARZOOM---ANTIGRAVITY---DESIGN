-- 019_email_queue.sql
-- Production-safe email queue table for ZARZOOM.
-- Emails are enqueued here by application code; a future external engine
-- will poll this table to send them via SMTP.

-- ── Table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_queue (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Status
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','processing','sent','failed','cancelled')),

  -- Addressing
  to_email        TEXT        NOT NULL,
  to_name         TEXT,
  from_email      TEXT,
  from_name       TEXT,

  -- Content
  subject         TEXT        NOT NULL,
  html_body       TEXT        NOT NULL,
  text_body       TEXT,

  -- Classification / tracing
  email_type      TEXT        NOT NULL,
  related_type    TEXT,
  related_id      TEXT,

  -- Context
  tenant_id       UUID,
  created_by      UUID,

  -- Engine metadata
  retry_count     INT         NOT NULL DEFAULT 0,
  max_retries     INT         NOT NULL DEFAULT 3,
  error_message   TEXT,
  priority        INT         NOT NULL DEFAULT 0,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  queued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ
);

-- ── Indexes for future engine polling ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_email_queue_pending
  ON public.email_queue (status, scheduled_for)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_email_queue_reference
  ON public.email_queue (related_type, related_id);

CREATE INDEX IF NOT EXISTS idx_email_queue_created
  ON public.email_queue (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_queue_type
  ON public.email_queue (email_type);

-- ── RLS: admin-only via authenticated role ───────────────────────
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_queue"
  ON public.email_queue
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

-- ── Auto-update updated_at on row changes ────────────────────────
CREATE OR REPLACE FUNCTION public.email_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_queue_updated_at
  BEFORE UPDATE ON public.email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.email_queue_updated_at();
