import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Check if a user is an admin using the is_admin RPC.
 * This uses the security definer function to avoid RLS recursion.
 */
export async function isUserAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");

  if (error) {
    console.error("[rbac] Failed to check admin status:", error);
    return false;
  }

  return data === true;
}

/**
 * Server-side guard to enforce admin access.
 * Redirects to /admin/login if not authenticated.
 * Redirects to / with 403 if not an admin.
 * 
 * @returns The authenticated user and supabase client if admin
 */
export async function requireAdmin() {
  const supabase = await createClient();
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Not authenticated - redirect to admin login
  if (authError || !user) {
    redirect("/admin/login");
  }

  // Check admin status
  const admin = await isUserAdmin(supabase, user.id);

  // Not an admin - redirect to home with error
  if (!admin) {
    redirect("/?error=forbidden");
  }

  return { user, supabase };
}

/**
 * Client-safe check if current user is admin.
 * Does NOT redirect, only returns boolean.
 * Use this for conditional UI rendering on client components.
 */
export async function checkIsAdmin(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  return isUserAdmin(supabase, user.id);
}
