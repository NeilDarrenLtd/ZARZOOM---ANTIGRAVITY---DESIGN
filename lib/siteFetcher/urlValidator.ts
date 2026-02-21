/**
 * SSRF-safe URL validation and IP blocking
 * Prevents Server-Side Request Forgery by blocking private IPs and localhost
 */

import { URL } from "url";

export class URLValidationError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "URLValidationError";
  }
}

/**
 * Check if an IP address is in a private range
 */
function isPrivateIP(ip: string): boolean {
  // Remove brackets from IPv6 addresses
  const cleanIP = ip.replace(/^\[|\]$/g, "");

  // IPv4 private ranges
  const ipv4Patterns = [
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^127\./, // Loopback 127.0.0.0/8
    /^169\.254\./, // Link-local 169.254.0.0/16
    /^0\.0\.0\.0$/, // Current network
    /^255\.255\.255\.255$/, // Broadcast
  ];

  for (const pattern of ipv4Patterns) {
    if (pattern.test(cleanIP)) {
      return true;
    }
  }

  // IPv6 private/local ranges
  const ipv6Patterns = [
    /^::1$/, // Loopback
    /^::$/, // Unspecified
    /^fe80:/i, // Link-local
    /^fc00:/i, // Unique local
    /^fd00:/i, // Unique local
    /^ff00:/i, // Multicast
  ];

  for (const pattern of ipv6Patterns) {
    if (pattern.test(cleanIP)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if hostname looks like localhost
 */
function isLocalhostHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower === "0.0.0.0" ||
    lower === "[::]" ||
    lower === "::1"
  );
}

/**
 * Check if hostname is an IP address (v4 or v6)
 */
function isIPAddress(hostname: string): boolean {
  // IPv4 pattern
  const ipv4Pattern =
    /^(\d{1,3}\.){3}\d{1,3}$/;
  
  // IPv6 pattern (simplified - brackets already removed)
  const ipv6Pattern = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;

  const cleaned = hostname.replace(/^\[|\]$/g, "");
  return ipv4Pattern.test(cleaned) || ipv6Pattern.test(cleaned);
}

export interface ValidatedURL {
  url: URL;
  hostname: string;
  protocol: string;
}

/**
 * Validate URL for SSRF safety
 * Throws URLValidationError if validation fails
 */
export function validateURL(urlString: string): ValidatedURL {
  // Parse URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new URLValidationError(
      "Invalid URL format",
      "INVALID_URL_FORMAT"
    );
  }

  // Only allow http/https
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new URLValidationError(
      `Protocol ${url.protocol} not allowed. Only http and https are supported.`,
      "INVALID_PROTOCOL"
    );
  }

  const hostname = url.hostname;

  // Block localhost variations
  if (isLocalhostHostname(hostname)) {
    throw new URLValidationError(
      "Localhost URLs are not allowed",
      "LOCALHOST_BLOCKED"
    );
  }

  // If it's an IP address, check if private
  if (isIPAddress(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new URLValidationError(
        "Private IP addresses are not allowed",
        "PRIVATE_IP_BLOCKED"
      );
    }
  }

  // Block credentials in URL
  if (url.username || url.password) {
    throw new URLValidationError(
      "URLs with authentication credentials are not allowed",
      "CREDENTIALS_IN_URL"
    );
  }

  return {
    url,
    hostname,
    protocol: url.protocol,
  };
}

/**
 * Validate and normalize a URL string
 * Returns null if invalid instead of throwing
 */
export function safeValidateURL(urlString: string): ValidatedURL | null {
  try {
    return validateURL(urlString);
  } catch {
    return null;
  }
}

/**
 * Check if a URL is from the same origin
 */
export function isSameOrigin(baseUrl: string, targetUrl: string): boolean {
  try {
    const base = new URL(baseUrl);
    const target = new URL(targetUrl);
    return base.origin === target.origin;
  } catch {
    return false;
  }
}

/**
 * Normalize URL for comparison (remove trailing slash, fragments)
 */
export function normalizeURL(urlString: string): string {
  try {
    const url = new URL(urlString);
    // Remove fragment
    url.hash = "";
    // Remove trailing slash from pathname
    if (url.pathname.endsWith("/") && url.pathname.length > 1) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return urlString;
  }
}
