/**
 * Locale routing config for SEO-friendly public URLs.
 * Only locales listed here get [locale] prefix and are shown in the switcher on locale routes.
 */

export const ROUTED_LOCALES = ["en", "fr"] as const;
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
