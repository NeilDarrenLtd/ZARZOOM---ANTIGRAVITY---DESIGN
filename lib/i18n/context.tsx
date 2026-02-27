"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { defaultLanguage, getSupportedLanguageCode } from "./languages";
import { devCheckPricing } from "./validate-no-pricing";

/* ---------- Types ---------- */

type Translations = Record<string, unknown>;

export type TranslationKey = string;

interface I18nContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string, fallback?: string) => string;
}

/* ---------- Context ---------- */

const I18nContext = createContext<I18nContextType | null>(null);

/* ---------- Translation cache ---------- */

// Translation cache is loaded asynchronously to avoid webpack serialization warnings
const translationCache: Record<string, Translations> = {};

async function loadTranslation(locale: string): Promise<Translations> {
  if (translationCache[locale]) {
    return translationCache[locale];
  }

  try {
    const mod = await import(`@/locales/${locale}.json`);
    const translations: Translations = mod.default;
    translationCache[locale] = translations;
    if (process.env.NODE_ENV === "development") {
      devCheckPricing(translations, locale);
    }
    return translations;
  } catch {
    // Fallback to empty object if locale cannot be loaded
    return {};
  }
}

/* ---------- Nested value accessor ---------- */

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}

/* ---------- Provider ---------- */

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(defaultLanguage);
  // Start with empty translations; they'll be loaded asynchronously
  const [translations, setTranslations] = useState<Translations>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Load translations on mount
  useEffect(() => {
    const initI18n = async () => {
      const stored = localStorage.getItem("zarzoom-locale");
      let activeLocale = stored || defaultLanguage;
      const browserLang = navigator.language || defaultLanguage;
      const detected = getSupportedLanguageCode(browserLang);
      
      if (!stored) {
        activeLocale = detected;
        setLocaleState(detected);
      } else {
        setLocaleState(stored);
      }

      // Load translations for active locale
      const trans = await loadTranslation(activeLocale);
      setTranslations(trans);
      setIsInitialized(true);
    };

    initI18n();
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((newLocale: string) => {
    setLocaleState(newLocale);
    localStorage.setItem("zarzoom-locale", newLocale);
    loadTranslation(newLocale).then(setTranslations);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = getNestedValue(translations, key);
      if (value === key && fallback) return fallback;
      return value;
    },
    [translations]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

/* ---------- Hook ---------- */

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
