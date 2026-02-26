/**
 * lib/upload-post/state.ts
 *
 * SECURITY: This module is server-only. NEVER import in client components.
 * It uses UPLOAD_POST_STATE_SECRET to sign and verify HMAC state tokens
 * passed through the OAuth / social-connect redirect flow.
 */

import { requireEnv } from "./config";
import { sanitizeReturnTo } from "./returnTo";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface StatePayload {
  /** The internal path to redirect back to after connecting accounts. */
  returnTo: string;
  /** The authenticated user's ID — used to bind the session to this user. */
  userId: string;
  /** Unix timestamp (seconds) at which the token expires. */
  exp: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

/** TTL in seconds (10 minutes). */
const TTL_SECONDS = 10 * 60;

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                    */
/* ------------------------------------------------------------------ */

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  // Convert ArrayBuffer to Uint8Array if needed (Buffer.from requires this)
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const normalized = pad ? padded + "=".repeat(4 - pad) : padded;
  return Buffer.from(normalized, "base64");
}

/* ------------------------------------------------------------------ */
/*  createState                                                         */
/* ------------------------------------------------------------------ */

/**
 * Create a signed, time-limited state token for the social-connect flow.
 *
 * The token is structured as:  base64url(payload) + "." + base64url(signature)
 *
 * @param options.returnTo - Internal path to redirect to after connecting.
 * @param options.userId   - The current user's ID.
 * @param options.exp      - Optional explicit expiry (Unix seconds). Defaults to now + 10 min.
 */
export async function createState({
  returnTo,
  userId,
  exp,
}: {
  returnTo: string;
  userId: string;
  exp?: number;
}): Promise<string> {
  const secret = requireEnv("UPLOAD_POST_STATE_SECRET");

  const payload: StatePayload = {
    returnTo: sanitizeReturnTo(returnTo),
    userId,
    exp: exp ?? Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };

  const encoder = new TextEncoder();
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));

  const key = await getHmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payloadB64)
  );

  const signatureB64 = base64UrlEncode(signatureBuffer);
  return `${payloadB64}.${signatureB64}`;
}

/* ------------------------------------------------------------------ */
/*  verifyState                                                         */
/* ------------------------------------------------------------------ */

/**
 * Verify a state token produced by `createState`.
 *
 * Validates:
 *  1. Token structure (two dot-separated base64url segments)
 *  2. HMAC signature matches
 *  3. Token has not expired
 *
 * @returns The decoded `StatePayload` on success, or `null` on any failure.
 */
export async function verifyState(token: string): Promise<StatePayload | null> {
  try {
    const secret = requireEnv("UPLOAD_POST_STATE_SECRET");

    const dotIndex = token.indexOf(".");
    if (dotIndex === -1) return null;

    const payloadB64 = token.slice(0, dotIndex);
    const signatureB64 = token.slice(dotIndex + 1);

    if (!payloadB64 || !signatureB64) return null;

    // Verify signature
    const encoder = new TextEncoder();
    const key = await getHmacKey(secret);
    const signatureBytes = base64UrlDecode(signatureB64);

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(payloadB64)
    );

    if (!valid) return null;

    // Decode payload
    const payloadJson = base64UrlDecode(payloadB64).toString("utf-8");
    const payload: StatePayload = JSON.parse(payloadJson);

    // Check expiry
    if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
