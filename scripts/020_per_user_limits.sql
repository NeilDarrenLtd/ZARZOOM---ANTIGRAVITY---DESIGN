-- ================================================================
-- 020: Per-user configurable limits for autofill and analyzer
-- ================================================================
-- Adds nullable limit columns to profiles so admins can override
-- system defaults on a per-user basis. NULL = use system default.
--
-- System defaults (when column is NULL):
--   daily_autofill_limit     → 2
--   total_autofill_limit     → 10  (degradation threshold)
--   analyzer_usage_limit     → 3   (per-session cap, now per-user)
-- ================================================================

-- ── Add limit columns to profiles ──────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_autofill_limit  INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_autofill_limit  INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS analyzer_usage_limit  INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS analyzer_usage_count  INTEGER DEFAULT 0;

-- ── Update check_autofill_usage to read per-user limits ─────────

CREATE OR REPLACE FUNCTION public.check_autofill_usage(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_daily_limit INTEGER;
  v_lifetime_degrade_threshold INTEGER;
  v_now TIMESTAMPTZ := now();
  v_daily_count INTEGER;
  v_lifetime_count INTEGER;
  v_degraded BOOLEAN;
  v_blocked BOOLEAN;
BEGIN
  SELECT
    autofill_lifetime_count,
    autofill_daily_count,
    autofill_daily_reset_at,
    autofill_degraded,
    autofill_blocked,
    daily_autofill_limit,
    total_autofill_limit
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'profile_not_found'
    );
  END IF;

  -- Per-user limits with system defaults
  v_daily_limit := COALESCE(v_profile.daily_autofill_limit, 2);
  v_lifetime_degrade_threshold := COALESCE(v_profile.total_autofill_limit, 10);

  IF v_profile.autofill_blocked THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'blocked',
      'degraded', v_profile.autofill_degraded,
      'daily_remaining', 0,
      'lifetime_total', v_profile.autofill_lifetime_count
    );
  END IF;

  -- Reset daily count if a new UTC day has started
  IF v_profile.autofill_daily_reset_at IS NULL
     OR date_trunc('day', v_now AT TIME ZONE 'UTC')
        > date_trunc('day', v_profile.autofill_daily_reset_at AT TIME ZONE 'UTC')
  THEN
    v_daily_count := 0;
    UPDATE public.profiles
    SET autofill_daily_count = 0,
        autofill_daily_reset_at = v_now
    WHERE id = p_user_id;
  ELSE
    v_daily_count := COALESCE(v_profile.autofill_daily_count, 0);
  END IF;

  v_lifetime_count := COALESCE(v_profile.autofill_lifetime_count, 0);
  v_degraded := COALESCE(v_profile.autofill_degraded, false);

  -- Check daily limit
  IF v_daily_count >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit',
      'degraded', v_degraded,
      'daily_remaining', 0,
      'lifetime_total', v_lifetime_count
    );
  END IF;

  -- Check if should be degraded
  IF v_lifetime_count >= v_lifetime_degrade_threshold AND NOT v_degraded THEN
    UPDATE public.profiles
    SET autofill_degraded = true
    WHERE id = p_user_id;
    v_degraded := true;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'degraded', v_degraded,
    'daily_remaining', v_daily_limit - v_daily_count,
    'lifetime_total', v_lifetime_count
  );
END;
$$;

-- ── Update increment to use per-user threshold ──────────────────

CREATE OR REPLACE FUNCTION public.increment_autofill_usage(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_lifetime INTEGER;
  v_threshold INTEGER;
BEGIN
  UPDATE public.profiles
  SET
    autofill_daily_count = autofill_daily_count + 1,
    autofill_lifetime_count = autofill_lifetime_count + 1,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING autofill_lifetime_count INTO v_new_lifetime;

  SELECT COALESCE(total_autofill_limit, 10)
  INTO v_threshold
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_new_lifetime >= v_threshold THEN
    UPDATE public.profiles
    SET autofill_degraded = true
    WHERE id = p_user_id AND autofill_degraded = false;
  END IF;
END;
$$;
