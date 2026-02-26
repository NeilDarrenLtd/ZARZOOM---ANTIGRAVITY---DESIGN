/**
 * lib/auth/admin.ts
 *
 * Admin guard for API routes. Checks both the profiles.is_admin flag
 * (via the existing is_admin RPC) AND the ADMIN_EMAILS env var.
 *
 * Usage in Route Handlers:
 *   const { user, admin } = await requireAdminApi();
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Server-side admin guard for API route handlers.
 * Returns the authenticated user and a service-role Supabase client.
 * Throws a descriptive error if the caller is not an admin.
 */
export async function requireAdminApi() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  // 1. Fast path: JWT metadata
  let isAdmin = user.user_metadata?.is_admin === true;

  // 2. DB check via security-definer RPC (avoids RLS recursion)
  if (!isAdmin) {
    const { data } = await supabase.rpc("is_admin");
    isAdmin = data === true;
  }

  // 3. Fallback: ADMIN_EMAILS env var
  if (!isAdmin && user.email) {
    const allowed = getAdminEmails();
    isAdmin = allowed.includes(user.email.toLowerCase());
  }

  if (!isAdmin) {
    throw new Error("Not authorised");
  }

  const admin = await createAdminClient();
  return { user, admin };
}
