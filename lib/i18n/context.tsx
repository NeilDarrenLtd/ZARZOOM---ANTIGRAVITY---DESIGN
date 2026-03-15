"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { defaultLanguage, getSupportedLanguageCode, languages } from "./languages";
import { getDefaultTranslations, getDefaultTranslationsSync, loadLocale } from "./load";
import { devCheckPricing } from "./validate-no-pricing";

const COOKIE_NAME = "locale";
const STORAGE_KEY = "zarzoom-locale";

/** Read locale from cookie (client-only). Used so app area picks up locale set on public site. */
function getLocaleFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`\\b${COOKIE_NAME}=([^;]+)`));
  const value = match ? decodeURIComponent(match[1].trim()) : null;
  if (!value) return null;
  const valid = languages.some((l) => l.code === value);
  return valid ? value : null;
}

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

// Start with empty (or already-cached) English; real data loads asynchronously
// to avoid webpack inlining large JSON strings at build time.
const enTranslationsRaw = getDefaultTranslationsSync();

// Pre-populate with English for synchronous first render (will be {} on cold
// start; getDefaultTranslations() below fills it after mount).
const translationCache: Record<string, Translations> = {
  en: enTranslationsRaw,
};

// Eagerly warm the English cache via dynamic import so it's ready quickly.
getDefaultTranslations().then((translations) => {
  translationCache["en"] = translations;
});

if (process.env.NODE_ENV === "development") {
  devCheckPricing(enTranslationsRaw, "en");
}

async function loadTranslation(locale: string): Promise<Translations> {
  if (translationCache[locale]) {
    return translationCache[locale];
  }

  const translations = await loadLocale(locale);
  translationCache[locale] = translations;
  if (process.env.NODE_ENV === "development") {
    devCheckPricing(translations, locale);
  }
  return translations;
}

/* ---------- Nested value accessor ---------- */

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current !== null && typeof current === "object" && (key in current || (Array.isArray(current) && /^\d+$/.test(key)))) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  if (typeof current === "string") return current;
  if (Array.isArray(current)) return current.join(", ");
  return path;
}

/* ---------- Provider ---------- */

export interface I18nProviderProps {
  children: ReactNode;
  /** When set (e.g. from [locale] route), URL is source of truth; cookie/localStorage sync to this. */
  initialLocale?: string;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const pathname = usePathname();
  const [locale, setLocaleState] = useState(initialLocale ?? defaultLanguage);
  const [translations, setTranslations] = useState<Translations>(
    initialLocale === "en" ? enTranslationsRaw : enTranslationsRaw
  );

  useEffect(() => {
    if (initialLocale) {
      setLocaleState(initialLocale);
      setLocaleCookie(initialLocale);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, initialLocale);
      }
      if (initialLocale !== "en") {
        loadTranslation(initialLocale).then(setTranslations);
      } else {
        setTranslations(enTranslationsRaw);
      }
      return;
    }
    const fromCookie = getLocaleFromCookie();
    const stored = fromCookie ?? (typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null);
    const resolved = stored ?? getSupportedLanguageCode(navigator?.language || defaultLanguage);
    setLocaleState(resolved);
    setLocaleCookie(resolved);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, resolved);
    }
    if (resolved !== "en") {
      loadTranslation(resolved).then(setTranslations);
    } else {
      setTranslations(enTranslationsRaw);
    }
  }, [initialLocale]);

  // Sync from cookie when pathname changes so root provider stays in sync (e.g. home → login keeps language)
  useEffect(() => {
    const fromCookie = getLocaleFromCookie();
    if (fromCookie && fromCookie !== locale) {
      setLocaleState(fromCookie);
      setLocaleCookie(fromCookie);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, fromCookie);
      }
      if (fromCookie !== "en") {
        loadTranslation(fromCookie).then(setTranslations);
      } else {
        setTranslations(enTranslationsRaw);
      }
    }
  }, [pathname]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function setLocaleCookie(locale: string) {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(locale)};path=/;max-age=31536000;SameSite=Lax`;
  }

  const setLocale = useCallback((newLocale: string) => {
    setLocaleState(newLocale);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newLocale);
    }
    setLocaleCookie(newLocale);
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
