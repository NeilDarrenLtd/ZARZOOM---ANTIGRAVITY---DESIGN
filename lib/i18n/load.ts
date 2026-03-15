/**
 * Locale loader — client & server safe entry point.
 *
 * getDefaultTranslationsSync: used by the client-side I18nProvider for the
 *   synchronous first-render English fallback. Uses require() with computed
 *   paths so webpack does NOT statically inline the large JSON strings into
 *   the client bundle (which triggers the "Serializing big strings (128 KiB)"
 *   cache warning and bloats the bundle).
 *
 * loadLocale: async loader for non-English locales. Safe to call from both
 *   server components and client context (it uses dynamic import() with a
 *   non-literal path, which webpack handles as a lazy chunk).
 */

/* eslint-disable @typescript-eslint/no-require-imports */

export type Translations = Record<string, unknown>;

function mergeNamespaces(
  site: Record<string, unknown>,
  app: Record<string, unknown>,
  admin: Record<string, unknown>
): Translations {
  return { ...site, ...app, ...admin };
}

/**
 * Load a locale JSON file via require() without webpack inlining the content.
 *
 * Webpack statically analyses require() calls with string literals and inlines
 * the resolved module content into the bundle. Using a computed (non-literal)
 * path makes the call opaque to the static analyser, so the file is resolved
 * at runtime via the Node.js module cache instead of being bundled inline.
 */
function requireLocaleJson(prefix: string, file: string): Record<string, unknown> {
  // Concatenating at runtime keeps the path non-literal for webpack.
  const mod = require(prefix + file) as { default?: Record<string, unknown> } | Record<string, unknown>;
  return ("default" in mod ? mod.default : mod) as Record<string, unknown>;
}

/** Synchronous default (English) for first render. Safe to call in client components. */
export function getDefaultTranslationsSync(): Translations {
  const base = "@/locales/";
  const enSite = requireLocaleJson(base + "en/", "site.json");
  const enApp = requireLocaleJson(base + "en/", "app.json");
  const sharedAdmin = requireLocaleJson(base, "admin.json");
  return mergeNamespaces(enSite, enApp, sharedAdmin);
}

const localeCache: Record<string, Translations> = {};

/**
 * Load translations for a locale. Prefers split files (locales/<locale>/site.json, app.json),
 * always merges in shared admin from locales/admin.json. Falls back to legacy
 * locales/<locale>.json, then to English defaults.
 *
 * Dynamic import() with a non-literal path is emitted as a lazy webpack chunk,
 * so the JSON is never bundled into the main bundle.
 */
export async function loadLocale(locale: string): Promise<Translations> {
  if (localeCache[locale]) {
    return localeCache[locale];
  }

  const base = "@/locales/";
  const sharedAdmin = requireLocaleJson(base, "admin.json");

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
