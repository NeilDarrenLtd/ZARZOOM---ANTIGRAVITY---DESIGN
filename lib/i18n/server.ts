/**
 * Server-side i18n utilities
 *
 * For use in Server Components and API routes.
 */

import { cookies, headers } from "next/headers";
import { getDefaultTranslationsSync, loadLocale } from "./load";
import { languages } from "./languages";

const SUPPORTED_CODES = new Set(languages.map((l) => l.code));

/**
 * Read the user's preferred locale: cookie first (persisted choice), then x-next-locale header
 * (set by middleware for locale-prefixed paths so first paint is correct before cookie exists).
 * Returns the value only if it is a supported language code; otherwise undefined.
 */
export async function getPreferredLocale(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("locale")?.value?.trim();
  if (raw) {
    const decoded = decodeURIComponent(raw);
    if (SUPPORTED_CODES.has(decoded)) return decoded;
  }
  const headerLocale = (await headers()).get("x-next-locale")?.trim();
  if (headerLocale && SUPPORTED_CODES.has(headerLocale)) return headerLocale;
  return undefined;
}

type Translations = Record<string, unknown>;
type TranslationKey = string;

const translationCache: Record<string, Translations> = {
  en: getDefaultTranslationsSync(),
};

async function loadServerTranslations(locale: string): Promise<Translations> {
  if (translationCache[locale]) {
    return translationCache[locale];
  }

  const translations = await loadLocale(locale);
  translationCache[locale] = translations;
  return translations;
}

/**
 * Get translation function for server components.
 * When locale is provided (e.g. from [locale] route params), that is used; otherwise uses the "locale" cookie, then 'en'.
 */
export async function getServerTranslations(localeOverride?: string) {
  const cookieStore = await cookies();
  const locale = localeOverride ?? cookieStore.get("locale")?.value ?? "en";

  const translations = await loadServerTranslations(locale);

  function t(key: TranslationKey, fallback?: string): string {
    const keys = key.split(".");
    let current: any = translations;

    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = current[k];
      } else {
        return fallback || key;
      }
    }

    if (typeof current === "string") return current;
    if (Array.isArray(current)) return current.join(", ");
    return fallback || key;
  }

  return t;
}
