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
import enTranslations from "@/locales/en.json";
import { devCheckPricing } from "./validate-no-pricing";

/* ---------- Types ---------- */

type Translations = typeof enTranslations;
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
}

/* ---------- Context ---------- */

const I18nContext = createContext<I18nContextType | null>(null);

/* ---------- Translation cache ---------- */

const translationCache: Record<string, Translations> = {
  en: enTranslations,
};

if (process.env.NODE_ENV === "development") {
  devCheckPricing(enTranslations, "en");
}

async function loadTranslation(locale: string): Promise<Translations> {
  if (translationCache[locale]) {
    return translationCache[locale];
  }

  try {
    const mod = await import(`@/locales/${locale}.json`);
    const translations = mod.default;
    translationCache[locale] = translations;
    devCheckPricing(translations, locale);
    return translations;
  } catch {
    return enTranslations;
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
  const [translations, setTranslations] =
    useState<Translations>(enTranslations);

  useEffect(() => {
    const stored = localStorage.getItem("zarzoom-locale");
    if (stored) {
      setLocaleState(stored);
      loadTranslation(stored).then(setTranslations);
    } else {
      const browserLang = navigator.language || defaultLanguage;
      const detected = getSupportedLanguageCode(browserLang);
      setLocaleState(detected);
      if (detected !== defaultLanguage) {
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
      const value = getNestedValue(
        translations as unknown as Record<string, unknown>,
        key
      );
      if (value === key && fallback) return fallback;
      return value;
    },
    [translations]
  );

  // Exclude translations from context value to prevent webpack serialization issues
  // Translations are only used in the t() callback which maintains its reference
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
