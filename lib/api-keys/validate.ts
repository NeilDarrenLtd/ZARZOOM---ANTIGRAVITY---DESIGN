import { createServerClient } from "@supabase/ssr";
import { createHash } from "node:crypto";
import { env } from "@/lib/api/env";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ApiKeyIdentity {
  /** The api_keys row ID. */
  apiKeyId: string;
  /** Tenant that owns the key. */
  tenantId: string;
  /** User who created the key. */
  userId: string;
  /** Display name of the key (e.g. "Production key"). */
  name: string;
  /** Parsed scopes from scopes_json (empty array = all scopes). */
  scopes: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Extract the Bearer token from an Authorization header value. */
export function parseAuthorizationBearer(
  authHeader: string | null
): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

/** Hash a raw API key using SHA-256 with the server pepper. */
function hashKey(rawKey: string): string {
  const pepper = env().API_KEY_PEPPER ?? "";
  return createHash("sha256")
    .update(pepper + rawKey)
    .digest("hex");
}

/* ------------------------------------------------------------------ */
/*  Core validator                                                     */
/* ------------------------------------------------------------------ */

/**
 * Validate a ZARZOOM API key (`zarz_live_...`).
 *
 * Steps:
 *   1. Verify the `zarz_live_` prefix.
 *   2. Hash the token (pepper + rawKey) and look up by key_hash (indexed).
 *   3. Ensure the key is not revoked.
 *   4. Fire-and-forget update to `last_used_at`.
 *
 * Lookup by key_hash is O(1) and scales regardless of total key count.
 * Returns `null` if the token is not a ZARZOOM key or invalid/revoked.
 */
export async function validateZarzApiKey(
  rawToken: string
): Promise<ApiKeyIdentity | null> {
  // Only handle ZARZOOM API keys -- let other tokens fall through
  if (!rawToken.startsWith("zarz_live_")) {
    return null;
  }

  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

  const admin = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { cookies: { getAll: () => [], setAll() {} } }
  );

  const candidateHash = hashKey(rawToken);

  // Look up by key_hash (indexed). Single row; no limit(100) so production-safe at scale.
  const { data: matched, error } = await admin
    .from("api_keys")
    .select("id, tenant_id, user_id, name, key_hash, scopes_json, revoked_at")
    .eq("key_hash", candidateHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    console.error("[ApiKey] DB lookup error:", error);
    return null; // Fail open to session auth
  }

  if (!matched) {
    return null;
  }

  // Fire-and-forget: update last_used_at
  admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", matched.id)
    .then(({ error: updateErr }) => {
      if (updateErr) {
        console.warn("[ApiKey] Failed to update last_used_at:", updateErr);
      }
    });

  return {
    apiKeyId: matched.id,
    tenantId: matched.tenant_id,
    userId: matched.user_id,
    name: matched.name,
    scopes: Array.isArray(matched.scopes_json) ? matched.scopes_json : [],
  };
}
