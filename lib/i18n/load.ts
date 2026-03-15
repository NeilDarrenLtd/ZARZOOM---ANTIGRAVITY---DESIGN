/**
 * Locale loader — client & server safe.
 *
 * The English default files (en/site.json, en/app.json, admin.json) are
 * statically imported so they are always available synchronously for the
 * first-render fallback used by both the client I18nProvider and the server
 * translation cache. Non-English locales are loaded lazily via dynamic import.
 *
 * The webpack PackFileCacheStrategy "Serializing big strings" warning that
 * appears for these files is a build-cache performance hint only — it does not
 * affect correctness or runtime behaviour. It is suppressed in next.config.mjs.
 */

import enSiteJson from "@/locales/en/site.json";
import enAppJson from "@/locales/en/app.json";
import adminJson from "@/locales/admin.json";

export type Translations = Record<string, unknown>;

function mergeNamespaces(
  site: Record<string, unknown>,
  app: Record<string, unknown>,
  admin: Record<string, unknown>
): Translations {
  return { ...site, ...app, ...admin };
}

/** Synchronous default (English) for first render. Safe for both client and server. */
export function getDefaultTranslationsSync(): Translations {
  return mergeNamespaces(
    enSiteJson as Record<string, unknown>,
    enAppJson as Record<string, unknown>,
    adminJson as Record<string, unknown>
  );
}

const localeCache: Record<string, Translations> = {};

/**
 * Load translations for a locale. Prefers split files (locales/<locale>/site.json, app.json),
 * always merges in shared admin from locales/admin.json. Falls back to legacy
 * locales/<locale>.json, then to English defaults.
 */
export async function loadLocale(locale: string): Promise<Translations> {
  if (localeCache[locale]) {
    return localeCache[locale];
  }

  const sharedAdmin = adminJson as Record<string, unknown>;

  // Try split site + app files first
  try {
    const [siteMod, appMod] = await Promise.all([
      import(`@/locales/${locale}/site.json`).catch(() => null),
      import(`@/locales/${locale}/app.json`).catch(() => null),
    ]);
    if (siteMod?.default && appMod?.default) {
      const merged = mergeNamespaces(
        siteMod.default as Record<string, unknown>,
        appMod.default as Record<string, unknown>,
        sharedAdmin
      );
      localeCache[locale] = merged;
      return merged;
    }
  } catch {
    // Fall through to legacy single-file
  }

  // Try legacy single-file (locales/<locale>.json)
  try {
    const mod = await import(`@/locales/${locale}.json`);
    const legacy = mod.default as Translations;
    const translations: Translations = { ...legacy, ...sharedAdmin };
    localeCache[locale] = translations;
    return translations;
  } catch {
    // Final fallback: English defaults
    const fallback = getDefaultTranslationsSync();
    localeCache[locale] = fallback;
    return fallback;
  }
}

