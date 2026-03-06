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
import enTranslationsRaw from "@/locales/en.json";
import { devCheckPricing } from "./validate-no-pricing";

/* ---------- Types ---------- */

// Use a loose type so JSON-loaded locales are compatible
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

// Pre-populate with English for synchronous first render
const translationCache: Record<string, Translations> = {
  en: enTranslationsRaw,
};

if (process.env.NODE_ENV === "development") {
  devCheckPricing(enTranslationsRaw, "en");
}

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
    // Fallback to English if locale cannot be loaded
    return enTranslationsRaw;
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
  // Initialize with English so translations are available on first render
  const [translations, setTranslations] = useState<Translations>(enTranslationsRaw as Translations);

  useEffect(() => {
    const stored = localStorage.getItem("zarzoom-locale");
    if (stored) {
      setLocaleState(stored);
      // If stored locale is not English, load it asynchronously
      if (stored !== "en") {
        loadTranslation(stored).then(setTranslations);
      }
    } else {
      const browserLang = navigator.language || defaultLanguage;
      const detected = getSupportedLanguageCode(browserLang);
      setLocaleState(detected);
      if (detected !== defaultLanguage && detected !== "en") {
        loadTranslation(detected).then(setTranslations);
      }
    }
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
      const value = getNestedValue(translations as Record<string, unknown>, key);
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
