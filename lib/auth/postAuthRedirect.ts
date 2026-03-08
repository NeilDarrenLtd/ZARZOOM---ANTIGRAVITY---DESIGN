import { createClient } from "@/lib/supabase/server";

/**
 * Centralised post-authentication redirect resolver.
 *
 * When workspaceId is provided (e.g. from auth callback after setting cookie),
 * checks that workspace's onboarding_profiles row:
 *   - 'completed' → /dashboard
 *   - anything else → /onboarding
 *
 * When workspaceId is not provided, returns /dashboard so the user lands there;
 * the dashboard layout will set the active workspace cookie and the page can
 * redirect to /onboarding for that workspace if needed. No first-workspace fallback.
 */
export async function resolvePostAuthRedirect(
  userId: string,
  workspaceId?: string | null
): Promise<string> {
  try {
    const tenantId = workspaceId?.trim() || null;
    if (!tenantId) {
      return "/dashboard";
    }

    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from("onboarding_profiles")
      .select("onboarding_status")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !profile) {
      return "/onboarding";
    }

    if (profile.onboarding_status === "completed") {
      return "/dashboard";
    }

    return "/onboarding";
  } catch {
    return "/onboarding";
  }
}
