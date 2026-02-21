-- Migration: Create is_admin RPC function
-- This function checks if the currently authenticated user is an admin.
-- It uses SECURITY DEFINER to bypass RLS and avoid recursion issues.

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS is_admin();

-- Create the is_admin function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  -- Get the current authenticated user's ID
  v_user_id := auth.uid();
  
  -- If no authenticated user, return false
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user has is_admin = true in profiles table
  SELECT is_admin INTO v_is_admin
  FROM profiles
  WHERE id = v_user_id;
  
  -- Return the result (NULL becomes false)
  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION is_admin() IS 'Returns true if the currently authenticated user has is_admin = true in profiles table. Uses SECURITY DEFINER to bypass RLS.';
