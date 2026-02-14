import type { NextRequest } from "next/server";

/** Languages the API can return content in. */
const SUPPORTED_LANGUAGES = ["en", "he", "ar", "fr", "es", "de"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Resolve the preferred language for a request.
 *
 * Priority:
 *   1. Explicit `?lang=` query parameter
 *   2. `Accept-Language` header (first supported match)
 *   3. Tenant setting (`default_language` from `tenant_settings`)
 *   4. Fallback to "en"
 */
export function resolveLanguage(
  req: NextRequest,
  tenantDefaultLanguage?: string | null
): SupportedLanguage {
  // 1. Query param
  const paramLang = req.nextUrl.searchParams.get("lang");
  if (paramLang && isSupported(paramLang)) {
    return paramLang as SupportedLanguage;
  }

  // 2. Accept-Language header
  const acceptLang = req.headers.get("accept-language");
  if (acceptLang) {
    const preferred = parseAcceptLanguage(acceptLang);
    for (const lang of preferred) {
      if (isSupported(lang)) return lang as SupportedLanguage;
      // Try base language (e.g. "en-US" -> "en")
      const base = lang.split("-")[0];
      if (isSupported(base)) return base as SupportedLanguage;
    }
  }

  // 3. Tenant default
  if (tenantDefaultLanguage && isSupported(tenantDefaultLanguage)) {
    return tenantDefaultLanguage as SupportedLanguage;
  }

  // 4. Fallback
  return "en";
}

function isSupported(lang: string): boolean {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

/**
 * Parse an Accept-Language header into an ordered list of language tags,
 * sorted by quality value descending.
 */
function parseAcceptLanguage(header: string): string[] {
  return header
    .split(",")
    .map((entry) => {
      const [lang, q] = entry.trim().split(";q=");
      return { lang: lang.trim(), q: q ? parseFloat(q) : 1.0 };
    })
    .sort((a, b) => b.q - a.q)
    .map((entry) => entry.lang);
}
