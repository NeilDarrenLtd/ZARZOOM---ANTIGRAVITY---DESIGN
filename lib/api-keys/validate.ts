import { createServerClient } from "@supabase/ssr";
import { timingSafeEqual, createHash } from "node:crypto";
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

/**
 * Constant-time comparison of two hex-encoded hashes.
 *
 * Prevents timing attacks that could leak information about
 * valid key prefixes or partial hash matches.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return timingSafeEqual(bufA, bufB);
}

/* ------------------------------------------------------------------ */
/*  Core validator                                                     */
/* ------------------------------------------------------------------ */

/**
 * Validate a ZARZOOM API key (`zarz_live_...`).
 *
 * Steps:
 *   1. Extract the raw token from the Authorization header.
 *   2. Verify the `zarz_live_` prefix.
 *   3. Hash the token and look up matching rows by `key_prefix`.
 *   4. Constant-time compare the stored hash to prevent timing attacks.
 *   5. Ensure the key is not revoked.
 *   6. Fire-and-forget update to `last_used_at`.
 *
 * Returns `null` if the token is not a ZARZOOM API key (so the caller
 * can fall back to session auth).  Throws `AuthError` if the key is
 * a ZARZOOM key but invalid/revoked.
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

  // Look up by key_prefix (all ZARZOOM keys share the same prefix)
  const { data: rows, error } = await admin
    .from("api_keys")
    .select("id, tenant_id, user_id, name, key_hash, scopes_json, revoked_at")
    .eq("key_prefix", "zarz_live_")
    .is("revoked_at", null)
    .limit(100); // Reasonable upper bound per prefix

  if (error) {
    console.error("[ApiKey] DB lookup error:", error);
    return null; // Fail open to session auth
  }

  if (!rows || rows.length === 0) {
    // No keys in DB -- could be invalid key; return null for AuthError later
    return null;
  }

  // Find the matching key via constant-time comparison
  const matched = rows.find((row) => {
    try {
      return safeCompare(candidateHash, row.key_hash);
    } catch {
      return false;
    }
  });

  if (!matched) {
    // Token looks like a ZARZOOM key but didn't match any hash
    // Return null -- the handler will throw AuthError since session auth
    // also won't work for a zarz_live_ token
    return null;
  }

  // Key matched -- check revocation (belt + suspenders)
  if (matched.revoked_at) {
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
