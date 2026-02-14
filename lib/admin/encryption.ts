import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

/* ------------------------------------------------------------------ */
/*  Envelope encryption for provider secrets                           */
/* ------------------------------------------------------------------ */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a 32-byte key from the master key string (hex or base64).
 * If the master key is already 32 bytes (64 hex chars), use it directly.
 * Otherwise, SHA-256 hash it to produce a deterministic 32-byte key.
 */
function deriveKey(masterKey: string): Buffer {
  const raw = Buffer.from(masterKey, "hex");
  if (raw.length === 32) return raw;

  // Fallback: hash the master key to 32 bytes
  return createHash("sha256").update(masterKey, "utf8").digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64 string containing: iv | authTag | ciphertext.
 */
export function encryptSecret(plaintext: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: iv (12) + authTag (16) + ciphertext (variable)
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString("base64");
}

/**
 * Decrypt a ciphertext string produced by `encryptSecret`.
 */
export function decryptSecret(ciphertext: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const packed = Buffer.from(ciphertext, "base64");

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final("utf8");
}

/**
 * Generate a fingerprint of a key value for display (last 4 chars).
 * e.g. "sk-proj-abc...wxyz" -> "...wxyz"
 */
export function keyFingerprint(plaintext: string): string {
  if (plaintext.length <= 4) return "****";
  return `...${plaintext.slice(-4)}`;
}
