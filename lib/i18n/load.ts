/**
 * Locale loader: supports split namespace files (site, app) per locale,
 * with one shared English-only admin file. Admin strings always come
 * from locales/admin.json. Fallback to legacy single-file per locale
 * when split files are missing.
 *
 * NOTE: All locale JSON files are loaded via dynamic import() to avoid
 * webpack serializing large strings (>128 KiB) into its pack-file cache,
 * which causes a performance warning and slows cold-start deserialization.
 */

export type Translations = Record<string, unknown>;

function mergeNamespaces(
  site: Record<string, unknown>,
  app: Record<string, unknown>,
  admin: Record<string, unknown>
): Translations {
  return { ...site, ...app, ...admin };
}

/** Synchronous default (English) for first paint. Used by client context only. */
export function getDefaultTranslationsSync(): Translations {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const enSite = require("@/locales/en/site.json") as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const enApp = require("@/locales/en/app.json") as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sharedAdmin = require("@/locales/admin.json") as Record<string, unknown>;
  return mergeNamespaces(enSite, enApp, sharedAdmin);
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

  const sharedAdminMod = await import("@/locales/admin.json");
  const sharedAdmin = sharedAdminMod.default as Record<string, unknown>;

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
    // Fall through to legacy
  }

  try {
    const mod = await import(`@/locales/${locale}.json`);
    const legacy = mod.default as Translations;
    const translations = { ...legacy, ...sharedAdmin };
    localeCache[locale] = translations;
    return translations;
  } catch {
    const fallback = getDefaultTranslationsSync();
    localeCache[locale] = fallback;
    return fallback;
  }
}
