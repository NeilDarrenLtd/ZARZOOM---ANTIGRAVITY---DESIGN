/**
 * lib/upload-post/returnTo.ts
 *
 * Sanitises the `returnTo` query-parameter to prevent open redirects.
 * Only allow-listed internal path prefixes are accepted.
 */

const ALLOWED_PREFIXES = [
  "/dashboard/profile",
  "/dashboard",
  "/onboarding",
] as const;

const DEFAULT_RETURN_TO = "/dashboard";

/**
 * Sanitise a `returnTo` value from untrusted input (e.g. a query string).
 *
 * Rules:
 *  - Must be a string starting with "/"
 *  - Must not contain "://"  (absolute URL / protocol hijack)
 *  - Must not contain "//"  (protocol-relative URL)
 *  - Must not contain "\"   (backslash redirect trick)
 *  - Must begin with one of the allowed prefixes
 *
 * Returns the sanitised path, or DEFAULT_RETURN_TO if any rule fails.
 */
export function sanitizeReturnTo(input: unknown): string {
  if (typeof input !== "string" || input.trim() === "") {
    return DEFAULT_RETURN_TO;
  }

  const path = input.trim();

  // Reject absolute URLs and protocol-relative URLs
  if (path.includes("://") || path.startsWith("//")) {
    return DEFAULT_RETURN_TO;
  }

  // Reject backslash (can be treated as "/" by some browsers)
  if (path.includes("\\")) {
    return DEFAULT_RETURN_TO;
  }

  // Must start with "/"
  if (!path.startsWith("/")) {
    return DEFAULT_RETURN_TO;
  }

  // Must begin with one of the explicitly allow-listed prefixes
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix + "?")
  );

  if (!allowed) {
    return DEFAULT_RETURN_TO;
  }

  return path;
}
