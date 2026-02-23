/**
 * Server-side i18n utilities
 * 
 * For use in Server Components and API routes
 */

import { cookies } from "next/headers";
import enTranslations from "@/locales/en.json";

type Translations = typeof enTranslations;
type TranslationKey = string;

/**
 * Get translation function for server components
 * Uses cookies to determine locale, falls back to 'en'
 */
export async function getServerTranslations() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value || "en";
  
  // For now, only English is supported
  // When adding more languages, dynamically import based on locale
  const translations = enTranslations;
  
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
