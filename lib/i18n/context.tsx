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

type Translations = Record<string, unknown>;
type NestedKeyOf<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? NestedKeyOf<T[K], `${Prefix}${Prefix extends "" ? "" : "."}${K}`>
        : `${Prefix}${Prefix extends "" ? "" : "."}${K}`;
    }[keyof T & string]
  : never;

export type TranslationKey = NestedKeyOf<Translations>;

interface I18nContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string, fallback?: string) => string;
  translations: Translations;
}

const I18nContext = createContext<I18nContextType | null>(null);

// Cache loaded translations to avoid re-fetching
const translationCache: Record<string, Translations> = {};

async function loadTranslation(locale: string): Promise<Translations> {
  if (translationCache[locale]) {
    return translationCache[locale];
  }

  try {
    const response = await fetch(`/locales/${locale}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load ${locale}.json`);
    }
    const translations = await response.json();
    translationCache[locale] = translations;
    return translations;
  } catch (error) {
    console.warn(`Failed to load locale ${locale}, falling back to en`, error);
    // Fallback to English if translation file not found
    if (locale !== "en") {
      return loadTranslation("en");
    }
    return {};
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // Return the key itself as fallback
    }
  }
  return typeof current === "string" ? current : path;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(defaultLanguage);
  const [translations, setTranslations] = useState<Translations>({});
  const [isLoading, setIsLoading] = useState(true);

  // Detect browser language on mount
  useEffect(() => {
    async function initializeLocale() {
      try {
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
      } finally {
        setIsLoading(false);
      }
    }
    initializeLocale();
  }, []);

  // Update HTML lang and dir attributes
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
        translations as Record<string, unknown>,
        key
      );
      if (value === key && fallback) return fallback;
      return value;
    },
    [translations]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, translations }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
