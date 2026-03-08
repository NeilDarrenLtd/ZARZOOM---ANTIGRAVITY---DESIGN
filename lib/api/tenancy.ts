import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthError } from "./errors";

export interface TenantMembership {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
}

/**
 * Resolve the tenant and membership for an authenticated user.
 *
 * When preferredTenantId is provided (e.g. X-Tenant-Id header), returns that
 * membership if the user belongs to it. When preferredTenantId is null/empty,
 * the query returns the first membership (order undefined); this MUST NOT be
 * used for workspace-scoped data reads or writes. Use requireExplicitTenant: true
 * on API routes so 400 is returned when the header is missing instead of using
 * first membership for data.
 *
 * Throws `AuthError` if the user has no tenant membership at all.
 */
export async function resolveTenant(
  supabase: SupabaseClient,
  userId: string,
  preferredTenantId?: string | null
): Promise<TenantMembership> {
  let query = supabase
    .from("tenant_memberships")
    .select("id, tenant_id, user_id, role")
    .eq("user_id", userId);

  const trimmed = preferredTenantId?.trim();
  if (trimmed) {
    query = query.eq("tenant_id", trimmed);
  }

  const { data, error } = await query.limit(1).single();

  if (error || !data) {
    throw new AuthError(
      preferredTenantId
        ? "You are not a member of the requested tenant"
        : "No tenant membership found for your account"
    );
  }

  return {
    id: data.id,
    tenantId: data.tenant_id,
    userId: data.user_id,
    role: data.role,
  };
}
