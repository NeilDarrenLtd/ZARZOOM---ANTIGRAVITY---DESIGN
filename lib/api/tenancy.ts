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
 * Queries the `tenant_memberships` table. If the user has multiple tenants the
 * caller can pass a preferred `tenantId` (from a header or query param);
 * otherwise the first membership is used.
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

  if (preferredTenantId) {
    query = query.eq("tenant_id", preferredTenantId);
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
