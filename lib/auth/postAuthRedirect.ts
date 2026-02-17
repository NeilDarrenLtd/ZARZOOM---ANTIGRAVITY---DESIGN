import { createClient } from "@/lib/supabase/server";

/**
 * Centralised post-authentication redirect resolver.
 *
 * Checks the user's onboarding_profiles row and returns the
 * appropriate destination path:
 *   - 'completed' → /dashboard
 *   - anything else (not_started | in_progress | skipped | missing) → /onboarding
 *
 * This function is the ONLY place that decides post-login routing.
 */
export async function resolvePostAuthRedirect(
  userId: string
): Promise<string> {
  try {
    const supabase = await createClient();

    const { data: profile, error } = await supabase
      .from("onboarding_profiles")
      .select("onboarding_status")
      .eq("user_id", userId)
      .single();

    // If no profile row or fetch error, user hasn't started onboarding
    if (error || !profile) {
      return "/onboarding";
    }

    if (profile.onboarding_status === "completed") {
      return "/dashboard";
    }

    // not_started | in_progress | skipped → onboarding
    return "/onboarding";
  } catch {
    // If anything fails, default to onboarding (safe fallback)
    return "/onboarding";
  }
}
