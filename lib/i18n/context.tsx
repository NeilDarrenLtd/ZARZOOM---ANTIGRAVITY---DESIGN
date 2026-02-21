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

type Translations = Record<string, any>;
type NestedKeyOf<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? NestedKeyOf<T[K], `${Prefix}${Prefix extends "" ? "" : "."}${K}`>
        : `${Prefix}${Prefix extends "" ? "" : "."}${K}`;
    }[keyof T & string]
  : never;

export type TranslationKey = string; // Relaxed type since translations are now dynamic

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
    // Dynamically import translation files to avoid bundling large strings
    const mod = await import(`@/locales/${locale}.json`);
    translationCache[locale] = mod.default;
    return mod.default;
  } catch {
    // Fallback to English if translation file not found
    console.warn(`Failed to load translation for locale: ${locale}`);
    try {
      const enMod = await import(`@/locales/en.json`);
      translationCache[locale] = enMod.default;
      return enMod.default;
    } catch (enError) {
      console.error("Failed to load English translation:", enError);
      return {};
    }
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

  // Load translations on mount
  useEffect(() => {
    const initTranslations = async () => {
      const stored = localStorage.getItem("zarzoom-locale");
      let targetLocale = defaultLanguage;

      if (stored) {
        targetLocale = stored;
      } else {
        const browserLang = navigator.language || defaultLanguage;
        targetLocale = getSupportedLanguageCode(browserLang);
      }

      setLocaleState(targetLocale);
      const loaded = await loadTranslation(targetLocale);
      setTranslations(loaded);
      setIsLoading(false);
    };

    initTranslations();
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
