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

// Pre-populate with an empty object initially
const translationCache: Record<string, Translations> = {};

// Flag to track if English has been loaded
let enTranslationsLoaded = false;
let enTranslationsRaw: Translations = {};

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
    // Ensure English is loaded as fallback
    if (!enTranslationsLoaded) {
      const enMod = await import(`@/locales/en.json`);
      enTranslationsRaw = enMod.default;
      enTranslationsLoaded = true;
      translationCache.en = enTranslationsRaw;
      if (process.env.NODE_ENV === "development") {
        devCheckPricing(enTranslationsRaw, "en");
      }
    }
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
  // Start with empty object, will be populated on first render
  const [translations, setTranslations] = useState<Translations>({});

  useEffect(() => {
    const initializeI18n = async () => {
      // Load English translations first (always needed as fallback)
      if (!enTranslationsLoaded) {
        await loadTranslation("en");
      }

      const stored = localStorage.getItem("zarzoom-locale");
      if (stored) {
        setLocaleState(stored);
        // If stored locale is not English, load it asynchronously
        if (stored !== "en") {
          const trans = await loadTranslation(stored);
          setTranslations(trans);
        } else {
          setTranslations(enTranslationsRaw);
        }
      } else {
        const browserLang = navigator.language || defaultLanguage;
        const detected = getSupportedLanguageCode(browserLang);
        setLocaleState(detected);
        if (detected !== defaultLanguage && detected !== "en") {
          const trans = await loadTranslation(detected);
          setTranslations(trans);
        } else {
          setTranslations(enTranslationsRaw);
        }
      }
    };

    initializeI18n();
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
