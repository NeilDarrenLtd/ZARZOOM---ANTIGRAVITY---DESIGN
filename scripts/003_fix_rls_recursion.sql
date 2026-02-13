-- Fix infinite recursion in profiles RLS policies
-- The problem: profiles_admin_select checks profiles table which triggers itself

-- Step 1: Drop the recursive admin policy on profiles
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;

-- Step 2: Recreate admin select policy using auth.jwt() instead of querying profiles
-- This avoids recursion because auth.jwt() reads from the JWT token, not from the profiles table
CREATE POLICY "profiles_admin_select" ON public.profiles FOR SELECT USING (
  auth.uid() = id
  OR
  (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

-- Wait -- the above still has recursion via the EXISTS clause.
-- The correct approach: use a SECURITY DEFINER function to check admin status
-- This function runs with elevated privileges and bypasses RLS.

-- Drop the policy we just created (if it was applied)
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;

-- Create a security definer function that bypasses RLS to check admin status
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = check_user_id AND is_admin = true
  );
END;
$$;

-- Now recreate the profiles admin select policy using the security definer function
CREATE POLICY "profiles_admin_select" ON public.profiles FOR SELECT USING (
  auth.uid() = id
  OR
  public.is_admin(auth.uid())
);

-- Also add admin update policy so admins can update other users' profiles
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE USING (
  auth.uid() = id
  OR
  public.is_admin(auth.uid())
);

-- Fix site_settings policies to also use the security definer function
DROP POLICY IF EXISTS "settings_admin_select" ON public.site_settings;
CREATE POLICY "settings_admin_select" ON public.site_settings FOR SELECT USING (
  public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "settings_admin_insert" ON public.site_settings;
CREATE POLICY "settings_admin_insert" ON public.site_settings FOR INSERT WITH CHECK (
  public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "settings_admin_update" ON public.site_settings;
CREATE POLICY "settings_admin_update" ON public.site_settings FOR UPDATE USING (
  public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "settings_admin_delete" ON public.site_settings;
CREATE POLICY "settings_admin_delete" ON public.site_settings FOR DELETE USING (
  public.is_admin(auth.uid())
);
