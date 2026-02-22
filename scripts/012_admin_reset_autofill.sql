-- =====================================================
-- admin_reset_autofill RPC
-- Allows admins to reset a user's autofill usage counters
-- =====================================================

CREATE OR REPLACE FUNCTION admin_reset_autofill(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET
    autofill_daily_count    = 0,
    autofill_lifetime_count = 0,
    autofill_degraded       = false,
    autofill_blocked        = false,
    autofill_daily_reset_at = NULL,
    updated_at              = now()
  WHERE id = p_user_id;
END;
$$;
