/**
 * Server-side i18n utilities
 * 
 * For use in Server Components and API routes
 */

import { cookies } from "next/headers";

type Translations = Record<string, any>;
type TranslationKey = string;

const translationCache: Record<string, Translations> = {};

/**
 * Load translations dynamically to prevent webpack serialization issues
 */
async function loadServerTranslations(locale: string): Promise<Translations> {
  if (translationCache[locale]) {
    return translationCache[locale];
  }

  try {
    // Use dynamic import with locale variable to avoid static imports
    const module = await import(`@/locales/${locale}.json`, { with: { type: "json" } });
    const translations = module.default;
    translationCache[locale] = translations;
    return translations;
  } catch {
    // Fallback to empty object
    return {};
  }
}

/**
 * Get translation function for server components
 * Uses cookies to determine locale, falls back to 'en'
 */
export async function getServerTranslations() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value || "en";
  
  const translations = await loadServerTranslations(locale);
  
  /**
   * Translation function
   */
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
    
    if (typeof current === "string") {
      return current;
    }
    
    if (Array.isArray(current)) {
      return current.join(", ");
    }
    
    return fallback || key;
  }
  
  return t;
}
