-- ================================================================
-- 021: Site-wide usage defaults for autofill and analyzer
-- ================================================================
-- Stores global defaults in site_settings so admins can change
-- limits from the UI without redeploying. Per-user overrides on
-- profiles still take precedence.
-- ================================================================

-- Seed default values (strings; parsed as integers in code/SQL)
INSERT INTO public.site_settings (key, value, encrypted)
VALUES
  ('usage_daily_autofill_default', '2', false),
  ('usage_total_autofill_default', '10', false),
  ('usage_analyzer_default', '3', false)
ON CONFLICT (key) DO NOTHING;

-- Update check_autofill_usage to use site_settings-backed defaults

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
  v_daily_default INTEGER;
  v_total_default INTEGER;
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

  -- Global defaults from site_settings with hard-coded fallbacks
  SELECT COALESCE(NULLIF(value, '')::INTEGER, 2)
  INTO v_daily_default
  FROM public.site_settings
  WHERE key = 'usage_daily_autofill_default'
  LIMIT 1;

  IF v_daily_default IS NULL THEN
    v_daily_default := 2;
  END IF;

  SELECT COALESCE(NULLIF(value, '')::INTEGER, 10)
  INTO v_total_default
  FROM public.site_settings
  WHERE key = 'usage_total_autofill_default'
  LIMIT 1;

  IF v_total_default IS NULL THEN
    v_total_default := 10;
  END IF;

  -- Per-user limits override global defaults
  v_daily_limit := COALESCE(v_profile.daily_autofill_limit, v_daily_default);
  v_lifetime_degrade_threshold := COALESCE(v_profile.total_autofill_limit, v_total_default);

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

