import { randomBytes, createHash } from "crypto";
import { env } from "@/lib/api/env";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** All ZARZOOM API keys start with this prefix for easy identification. */
const KEY_PREFIX = "zarz_live_";

/** Length of the random portion (bytes) -- 32 bytes = 256 bits of entropy. */
const RANDOM_BYTES = 32;

/* ------------------------------------------------------------------ */
/*  Key generation                                                     */
/* ------------------------------------------------------------------ */

export interface GeneratedKey {
  /** Full raw key (shown to user ONCE): `zarz_live_<random hex>` */
  rawKey: string;
  /** The static prefix: `zarz_live_` */
  keyPrefix: string;
  /** Last 4 characters of the raw key (stored for display). */
  last4: string;
  /** SHA-256 hash of `pepper + rawKey` -- this is what we persist. */
  keyHash: string;
}

/**
 * Generate a new ZARZOOM API key.
 *
 * Returns the raw key (to show once), its hash (to store), and the
 * prefix + last4 (for listing without exposing material).
 */
export function generateApiKey(): GeneratedKey {
  const randomPart = randomBytes(RANDOM_BYTES).toString("hex");
  const rawKey = `${KEY_PREFIX}${randomPart}`;
  const last4 = rawKey.slice(-4);

  return {
    rawKey,
    keyPrefix: KEY_PREFIX,
    last4,
    keyHash: hashApiKey(rawKey),
  };
}

/* ------------------------------------------------------------------ */
/*  Key hashing                                                        */
/* ------------------------------------------------------------------ */

/**
 * Hash an API key with an optional pepper from the environment.
 *
 * Uses SHA-256(pepper + rawKey). The pepper adds a server-side secret
 * so even if the DB leaks the hashes cannot be brute-forced without it.
 */
export function hashApiKey(rawKey: string): string {
  const pepper = env().API_KEY_PEPPER ?? "";
  return createHash("sha256")
    .update(pepper + rawKey)
    .digest("hex");
}
