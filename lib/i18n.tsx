"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

// Supported languages list
export const languages = [
  { code: "en", nativeName: "English" },
  { code: "es", nativeName: "Espa\u00f1ol" },
  { code: "fr", nativeName: "Fran\u00e7ais" },
  { code: "de", nativeName: "Deutsch" },
  { code: "pt", nativeName: "Portugu\u00eas" },
  { code: "it", nativeName: "Italiano" },
  { code: "nl", nativeName: "Nederlands" },
  { code: "pl", nativeName: "Polski" },
  { code: "ru", nativeName: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439" },
  { code: "ja", nativeName: "\u65e5\u672c\u8a9e" },
  { code: "ko", nativeName: "\ud55c\uad6d\uc5b4" },
  { code: "zh", nativeName: "\u4e2d\u6587" },
  { code: "ar", nativeName: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" },
  { code: "hi", nativeName: "\u0939\u093f\u0928\u094d\u0926\u0940" },
  { code: "tr", nativeName: "T\u00fcrk\u00e7e" },
];

type Translations = Record<string, unknown>;

interface I18nContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string) => string;
  translations: Translations;
}

const I18nContext = createContext<I18nContextType | null>(null);

// Helper to get a nested value from an object using a dot-separated key
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return path;
    }
    current = (current as Record<string, unknown>)[key];
  }

  if (typeof current === "string") {
    return current;
  }

  return path;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState("en");
  const [translations, setTranslations] = useState<Translations>({});

  // Dynamically load translations to avoid bundling large JSON into webpack cache
  useEffect(() => {
    import("@/locales/en.json").then((mod) => {
      setTranslations(mod.default);
    });
  }, []);

  const t = useCallback(
    (key: string): string => {
      if (Object.keys(translations).length === 0) return "";
      return getNestedValue(translations, key);
    },
    [translations]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, translations }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
