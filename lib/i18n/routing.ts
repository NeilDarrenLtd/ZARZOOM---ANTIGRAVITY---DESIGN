/**
 * Locale routing config for SEO-friendly public URLs.
 * All supported languages listed here get [locale] prefix on public marketing pages.
 * Must match languages that have locales/{code}/site.json and app.json.
 */

export const ROUTED_LOCALES = [
  "en",
  "fr",
  "es",
  "de",
  "it",
  "pt",
  "nl",
  "pl",
  "sv",
  "da",
  "no",
  "fi",
  "ru",
  "uk",
  "tr",
  "ar",
  "he",
  "hi",
  "zh",
  "ja",
  "ko",
  "th",
  "vi",
  "id",
  "ms",
] as const;
export type RoutedLocale = (typeof ROUTED_LOCALES)[number];

export const DEFAULT_LOCALE: RoutedLocale = "en";

export function isRoutedLocale(value: string): value is RoutedLocale {
  return ROUTED_LOCALES.includes(value as RoutedLocale);
}

/** Public path segments that should be under [locale] (no leading slash). */
export const PUBLIC_PATH_SEGMENTS = [
  "about",
  "features",
  "pricing",
  "contact",
  "support",
  "privacy",
  "cookies",
  "terms-user",
  "terms-website",
] as const;

export function getPublicPathSegments(): readonly string[] {
  return PUBLIC_PATH_SEGMENTS;
}

/** Paths that get redirected to /en/... when requested without locale prefix. */
export function getPublicPathsWithoutLocale(): string[] {
  return ["", ...PUBLIC_PATH_SEGMENTS];
}
