/**
 * Locale loader: supports split namespace files (site, app) per locale,
 * with one shared English-only admin file. Admin strings always come
 * from locales/admin.json. Fallback to legacy single-file per locale
 * when split files are missing.
 */

import enSite from "@/locales/en/site.json";
import enApp from "@/locales/en/app.json";
import sharedAdmin from "@/locales/admin.json";

export type Translations = Record<string, unknown>;

const NAMESPACES = ["site", "app", "admin"] as const;

function mergeNamespaces(
  site: Record<string, unknown>,
  app: Record<string, unknown>,
  admin: Record<string, unknown>
): Translations {
  return { ...site, ...app, ...admin };
}

/** Synchronous default (English) for first paint. Used by client context only. */
export function getDefaultTranslationsSync(): Translations {
  return mergeNamespaces(
    enSite as Record<string, unknown>,
    enApp as Record<string, unknown>,
    sharedAdmin as Record<string, unknown>
  );
}

const localeCache: Record<string, Translations> = {};

/**
 * Load translations for a locale. Prefers split files (locales/<locale>/site.json, app.json),
 * always merges in shared admin from locales/admin.json. Falls back to legacy
 * locales/<locale>.json, then to English (sync default).
 */
export async function loadLocale(locale: string): Promise<Translations> {
  if (localeCache[locale]) {
    return localeCache[locale];
  }

  try {
    const [siteMod, appMod] = await Promise.all([
      import(`@/locales/${locale}/site.json`).catch(() => null),
      import(`@/locales/${locale}/app.json`).catch(() => null),
    ]);
    if (siteMod?.default && appMod?.default) {
      const merged = mergeNamespaces(
        siteMod.default as Record<string, unknown>,
        appMod.default as Record<string, unknown>,
        sharedAdmin as Record<string, unknown>
      );
      localeCache[locale] = merged;
      return merged;
    }
  } catch {
    // Fall through to legacy
  }

  try {
    const mod = await import(`@/locales/${locale}.json`);
    const legacy = mod.default as Translations;
    const translations = { ...legacy, ...(sharedAdmin as Record<string, unknown>) };
    localeCache[locale] = translations;
    return translations;
  } catch {
    const fallback = getDefaultTranslationsSync();
    localeCache[locale] = fallback;
    return fallback;
  }
}
