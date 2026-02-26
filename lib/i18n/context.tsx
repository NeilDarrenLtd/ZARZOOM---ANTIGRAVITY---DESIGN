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

type Translations = Record<string, any>;
type NestedKeyOf<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? NestedKeyOf<T[K], `${Prefix}${Prefix extends "" ? "" : "."}${K}`>
        : `${Prefix}${Prefix extends "" ? "" : "."}${K}`;
    }[keyof T & string]
  : never;

export type TranslationKey = string;

interface I18nContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string, fallback?: string) => string;
}

/* ---------- Context ---------- */

const I18nContext = createContext<I18nContextType | null>(null);

/* ---------- Translation cache ---------- */

const translationCache: Record<string, Translations | Promise<Translations>> = {};
let enTranslationsPromise: Promise<Translations> | null = null;

/**
 * Load English translations dynamically to prevent webpack serialization
 */
async function getEnglishTranslations(): Promise<Translations> {
  if (enTranslationsPromise) {
    return enTranslationsPromise;
  }

  enTranslationsPromise = (async () => {
    try {
      const response = await fetch(new URL("../../locales/en.json", import.meta.url));
      const translations = await response.json();
      translationCache["en"] = translations;
      if (process.env.NODE_ENV === "development") {
        devCheckPricing(translations, "en");
      }
      return translations;
    } catch (error) {
      console.error("Failed to load English translations:", error);
      // Return empty object as fallback
      return {};
    }
  })();

  return enTranslationsPromise;
}

async function loadTranslation(locale: string): Promise<Translations> {
  if (translationCache[locale] instanceof Promise) {
    return translationCache[locale] as Promise<Translations>;
  }

  if (translationCache[locale]) {
    return translationCache[locale] as Translations;
  }

  try {
    const response = await fetch(new URL(`../../locales/${locale}.json`, import.meta.url));
    if (!response.ok) {
      return getEnglishTranslations();
    }
    const translations = await response.json();
    translationCache[locale] = translations;
    if (process.env.NODE_ENV === "development") {
      devCheckPricing(translations, locale);
    }
    return translations;
  } catch {
    return getEnglishTranslations();
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
  const [translations, setTranslations] = useState<Translations>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Load initial translations
    (async () => {
      const stored = localStorage.getItem("zarzoom-locale");
      if (stored) {
        setLocaleState(stored);
        const trans = await loadTranslation(stored);
        setTranslations(trans);
      } else {
        const browserLang = navigator.language || defaultLanguage;
        const detected = getSupportedLanguageCode(browserLang);
        setLocaleState(detected);
        const trans = await loadTranslation(detected);
        setTranslations(trans);
      }
      setIsReady(true);
    })();
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
      const value = getNestedValue(
        translations as unknown as Record<string, unknown>,
        key
      );
      if (value === key && fallback) return fallback;
      return value;
    },
    [translations]
  );

  const contextValue = {
    locale,
    setLocale,
    t,
  };

  return (
    <I18nContext.Provider value={contextValue}>
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
