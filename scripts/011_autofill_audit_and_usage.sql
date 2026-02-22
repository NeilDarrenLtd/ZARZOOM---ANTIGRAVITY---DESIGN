-- =====================================================
-- wizard_autofill_audit table + usage RPC functions
-- =====================================================

-- 1. Create the audit log table
CREATE TABLE IF NOT EXISTS wizard_autofill_audit (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type   text NOT NULL CHECK (source_type IN ('website', 'file')),
  source_identifier text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'fail',
  error_message text,
  fields_populated integer NOT NULL DEFAULT 0,
  confidence_scores jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_autofill_audit_user_id ON wizard_autofill_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_autofill_audit_created ON wizard_autofill_audit(created_at DESC);

-- RLS: users can read own audit entries, admins can read all
ALTER TABLE wizard_autofill_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own audit" ON wizard_autofill_audit;
CREATE POLICY "Users can read own audit" ON wizard_autofill_audit
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on autofill audit" ON wizard_autofill_audit;
CREATE POLICY "Service role full access on autofill audit" ON wizard_autofill_audit
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read all audit" ON wizard_autofill_audit;
CREATE POLICY "Admins can read all audit" ON wizard_autofill_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Allow insert for authenticated users (logging their own usage)
DROP POLICY IF EXISTS "Users can insert own audit" ON wizard_autofill_audit;
CREATE POLICY "Users can insert own audit" ON wizard_autofill_audit
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. check_autofill_usage RPC
-- Returns whether the user is allowed to run autofill,
-- handles daily reset, and checks lifetime degradation.
CREATE OR REPLACE FUNCTION check_autofill_usage(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile   profiles%ROWTYPE;
  v_daily     integer;
  v_lifetime  integer;
  v_degraded  boolean;
  v_blocked   boolean;
  v_reset_at  timestamptz;
  v_now       timestamptz := now();
BEGIN
  -- Fetch profile
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'degraded', false,
      'reason', 'profile_not_found',
      'daily_remaining', 0,
      'lifetime_total', 0
    );
  END IF;

  v_daily     := COALESCE(v_profile.autofill_daily_count, 0);
  v_lifetime  := COALESCE(v_profile.autofill_lifetime_count, 0);
  v_degraded  := COALESCE(v_profile.autofill_degraded, false);
  v_blocked   := COALESCE(v_profile.autofill_blocked, false);
  v_reset_at  := v_profile.autofill_daily_reset_at;

  -- Check if blocked
  IF v_blocked THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'degraded', v_degraded,
      'reason', 'blocked',
      'daily_remaining', 0,
      'lifetime_total', v_lifetime
    );
  END IF;

  -- Reset daily counter if past the reset window (new day)
  IF v_reset_at IS NULL OR v_reset_at < date_trunc('day', v_now) THEN
    UPDATE profiles
    SET autofill_daily_count = 0,
        autofill_daily_reset_at = date_trunc('day', v_now) + interval '1 day'
    WHERE id = p_user_id;

    v_daily := 0;
  END IF;

  -- Daily limit: 2 per day
  IF v_daily >= 2 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'degraded', v_degraded,
      'reason', 'daily_limit',
      'daily_remaining', 0,
      'lifetime_total', v_lifetime
    );
  END IF;

  -- Auto-degrade after 10 lifetime uses
  IF v_lifetime >= 10 AND NOT v_degraded THEN
    UPDATE profiles SET autofill_degraded = true WHERE id = p_user_id;
    v_degraded := true;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'degraded', v_degraded,
    'reason', null,
    'daily_remaining', 2 - v_daily,
    'lifetime_total', v_lifetime
  );
END;
$$;

-- 3. increment_autofill_usage RPC
-- Called after each successful autofill run.
CREATE OR REPLACE FUNCTION increment_autofill_usage(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET
    autofill_daily_count    = COALESCE(autofill_daily_count, 0) + 1,
    autofill_lifetime_count = COALESCE(autofill_lifetime_count, 0) + 1,
    updated_at              = now()
  WHERE id = p_user_id;
END;
$$;
