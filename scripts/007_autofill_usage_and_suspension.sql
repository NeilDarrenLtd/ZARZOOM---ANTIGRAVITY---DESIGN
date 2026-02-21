-- ================================================================
-- 007: Autofill usage tracking, degradation, and user suspension
-- ================================================================
-- Adds columns to profiles for:
--   1. Lifetime autofill usage count (website + file combined)
--   2. Daily autofill usage tracking (reset daily)
--   3. Degraded mode flag (after 10 lifetime uses, bypass OpenRouter)
--   4. Autofill blocked flag (admin can block a user entirely)
--   5. User suspension (prevent login)
-- ================================================================

-- ── Add columns to profiles ──────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS autofill_lifetime_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autofill_daily_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS autofill_daily_reset_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS autofill_degraded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS autofill_blocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- ── Helper: check and increment autofill usage ───────────────────
-- Returns JSON with: allowed, degraded, daily_remaining, lifetime_total
-- Also handles daily reset automatically.

CREATE OR REPLACE FUNCTION public.check_autofill_usage(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_daily_limit INTEGER := 2;
  v_lifetime_degrade_threshold INTEGER := 10;
  v_now TIMESTAMPTZ := now();
  v_daily_count INTEGER;
  v_lifetime_count INTEGER;
  v_degraded BOOLEAN;
  v_blocked BOOLEAN;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT
    autofill_lifetime_count,
    autofill_daily_count,
    autofill_daily_reset_at,
    autofill_degraded,
    autofill_blocked
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

  -- Check if user is blocked from autofill
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

  -- Check if should be degraded (>= 10 lifetime uses)
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

-- ── Helper: increment usage after a successful run ───────────────

CREATE OR REPLACE FUNCTION public.increment_autofill_usage(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_lifetime INTEGER;
BEGIN
  UPDATE public.profiles
  SET
    autofill_daily_count = autofill_daily_count + 1,
    autofill_lifetime_count = autofill_lifetime_count + 1,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING autofill_lifetime_count INTO v_new_lifetime;

  -- Auto-degrade at threshold
  IF v_new_lifetime >= 10 THEN
    UPDATE public.profiles
    SET autofill_degraded = true
    WHERE id = p_user_id AND autofill_degraded = false;
  END IF;
END;
$$;

-- ── Admin helpers for user management ────────────────────────────

-- Reset autofill usage for a user (admin action)
CREATE OR REPLACE FUNCTION public.admin_reset_autofill(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    autofill_lifetime_count = 0,
    autofill_daily_count = 0,
    autofill_daily_reset_at = now(),
    autofill_degraded = false,
    autofill_blocked = false,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- ── Allow admin to update new columns ────────────────────────────

-- The existing profiles_admin_update policy allows admins to update.
-- Verify it exists (it was created in 003_fix_rls_recursion.sql).
-- No action needed if policy already uses is_admin() function.

-- ── Ensure admins can read all profiles including new columns ────
-- Already covered by existing profiles_admin_select policy.
