/**
 * Correlation / request ID helper.
 *
 * If the incoming request already carries an `X-Request-Id` header (e.g. from
 * a load-balancer or gateway) we reuse it; otherwise we mint a new UUID v4.
 */
export function getRequestId(req?: Request): string {
  const existing = req?.headers.get("x-request-id");
  if (existing) return existing;
  return crypto.randomUUID();
}
