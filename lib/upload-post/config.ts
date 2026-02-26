/**
 * lib/upload-post/config.ts
 *
 * SECURITY: This module is server-only. NEVER import in client components.
 * It reads server-only environment variables (UPLOAD_POST_API_KEY,
 * UPLOAD_POST_STATE_SECRET) that must never be exposed to the browser.
 */

/* ------------------------------------------------------------------ */
/*  requireEnv                                                          */
/* ------------------------------------------------------------------ */

/**
 * Assert that an environment variable is present and non-empty.
 * Throws at call-time so misconfigured deployments fail fast.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `[upload-post] Required environment variable "${name}" is not set.`
    );
  }
  return value;
}

/* ------------------------------------------------------------------ */
/*  getBaseUrl                                                          */
/* ------------------------------------------------------------------ */

/**
 * Return the canonical base URL for this application.
 *
 * Resolution order:
 *   1. APP_BASE_URL           – explicit override (recommended in production)
 *   2. VERCEL_URL             – automatically set by Vercel on preview/production
 *   3. http://localhost:3000  – local fallback
 *
 * The returned value always has no trailing slash.
 */
export function getBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL;
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    // VERCEL_URL does not include the protocol
    return `https://${vercelUrl}`.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

/* ------------------------------------------------------------------ */
/*  getDefaultPlatforms                                                 */
/* ------------------------------------------------------------------ */

/**
 * Parse UPLOAD_POST_DEFAULT_PLATFORMS into an array of trimmed strings.
 *
 * Example env value: "instagram,facebook, tiktok"
 * Returns: ["instagram", "facebook", "tiktok"]
 *
 * Returns undefined when the variable is unset or empty so callers can
 * distinguish "no preference" from "empty list".
 */
export function getDefaultPlatforms(): string[] | undefined {
  const raw = process.env.UPLOAD_POST_DEFAULT_PLATFORMS;
  if (!raw || raw.trim() === "") {
    return undefined;
  }

  const platforms = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  return platforms.length > 0 ? platforms : undefined;
}

/* ------------------------------------------------------------------ */
/*  Public / UI config                                                  */
/* ------------------------------------------------------------------ */

/**
 * Non-sensitive configuration values intended for use in server
 * components / server actions only (never passed directly to client).
 *
 * Values fall back gracefully so the app renders without these vars set.
 */
export function getUploadPostUiConfig() {
  return {
    logoUrl: process.env.UPLOAD_POST_LOGO_URL ?? null,
    connectTitle:
      process.env.UPLOAD_POST_CONNECT_TITLE ?? "Connect Social Accounts",
    connectDescription:
      process.env.UPLOAD_POST_CONNECT_DESCRIPTION ??
      "Link your social media accounts to enable publishing.",
    redirectButtonText:
      process.env.UPLOAD_POST_REDIRECT_BUTTON_TEXT ?? "Connect Accounts",
    defaultPlatforms: getDefaultPlatforms(),
  };
}
