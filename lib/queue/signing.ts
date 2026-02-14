import { createHmac, timingSafeEqual } from "crypto";

/**
 * Sign a queue message using HMAC-SHA256.
 *
 * The canonical string is: `job_id|tenant_id|type|scheduled_for`
 * This prevents message tampering if the queue transport is HTTP-based.
 */
export function signMessage(
  jobId: string,
  tenantId: string,
  type: string,
  scheduledFor: string,
  secret: string
): string {
  const canonical = `${jobId}|${tenantId}|${type}|${scheduledFor}`;
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

/**
 * Verify a queue message signature.
 *
 * Uses constant-time comparison to prevent timing attacks.
 * Returns `true` if the signature is valid.
 */
export function verifyQueueSignature(
  jobId: string,
  tenantId: string,
  type: string,
  scheduledFor: string,
  signature: string,
  secret: string
): boolean {
  const expected = signMessage(jobId, tenantId, type, scheduledFor, secret);

  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expectedBuf = Buffer.from(expected, "hex");

    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}
