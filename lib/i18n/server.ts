/**
 * Server-side i18n utilities
 *
 * For use in Server Components and API routes.
 */

import { cookies } from "next/headers";

type Translations = Record<string, unknown>;
type TranslationKey = string;

const translationCache: Record<string, Translations> = {};

async function loadServerTranslations(locale: string): Promise<Translations> {
  if (translationCache[locale]) {
    return translationCache[locale];
  }

  try {
    const module = await import(`@/locales/${locale}.json`);
    const translations: Translations = module.default;
    translationCache[locale] = translations;
    return translations;
  } catch {
    // Fallback to English
    if (!translationCache.en) {
      const enModule = await import(`@/locales/en.json`);
      translationCache.en = enModule.default;
    }
    return translationCache.en;
  }
}

/**
 * Get translation function for server components.
 * Uses the "locale" cookie to determine language, falls back to 'en'.
 */
export async function getServerTranslations() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value || "en";

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
