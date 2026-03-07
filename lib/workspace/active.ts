/**
 * Server-side active workspace resolution.
 * Used by dashboard layout to determine and persist the user's active workspace.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

const COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  httpOnly: false, // so client can send X-Tenant-Id from same value
};

export interface ActiveWorkspaceResult {
  activeWorkspaceId: string;
  /** True when cookie was missing or invalid and we resolved to first membership */
  shouldSetCookie: boolean;
}

/**
 * Resolve the user's active workspace id.
 * - If cookieValue is present and user is a member of that tenant, use it.
 * - Otherwise use the user's first tenant membership (existing users default to original workspace).
 * Returns shouldSetCookie true when the cookie should be set (missing or invalid).
 */
export async function getActiveWorkspaceId(
  supabase: SupabaseClient,
  userId: string,
  cookieValue: string | undefined
): Promise<ActiveWorkspaceResult> {
  const trimmed = cookieValue?.trim();
  if (trimmed) {
    const { data } = await supabase
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", userId)
      .eq("tenant_id", trimmed)
      .limit(1)
      .maybeSingle();
    if (data?.tenant_id) {
      return { activeWorkspaceId: data.tenant_id, shouldSetCookie: false };
    }
  }

  const { data: first, error } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !first?.tenant_id) {
    throw new Error("No workspace membership found for user");
  }

  return {
    activeWorkspaceId: first.tenant_id,
    shouldSetCookie: true,
  };
}

export function getActiveWorkspaceCookieOptions() {
  return COOKIE_OPTIONS;
}

/**
 * Client-only: read active_workspace_id from document.cookie.
 * Use when calling billing/API from pages that don't use workspaceFetch (e.g. public pricing)
 * so checkout/portal apply to the user's current workspace when set.
 */
export function getActiveWorkspaceIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/active_workspace_id=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}
