/**
 * Locale loader: supports split namespace files (site, app) per locale,
 * with one shared English-only admin file. Admin strings always come
 * from locales/admin.json. Fallback to legacy single-file per locale
 * when split files are missing.
 *
 * NOTE: Large locale JSON files are intentionally loaded via fs.readFileSync /
 * dynamic import() rather than static import / require() with literal paths.
 * Webpack statically resolves literal require() / import paths and inlines the
 * entire JSON string into the module chunk, which triggers:
 *   "[webpack.cache.PackFileCacheStrategy] Serializing big strings (128kiB)…"
 * Using fs.readFileSync is opaque to webpack's static analyser, so the content
 * is never bundled — it is read from disk at runtime instead.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Translations = Record<string, unknown>;

function mergeNamespaces(
  site: Record<string, unknown>,
  app: Record<string, unknown>,
  admin: Record<string, unknown>
): Translations {
  return { ...site, ...app, ...admin };
}

/** Read a locale JSON file from disk without bundling it into the webpack chunk. */
function readLocaleFile(relativePath: string): Record<string, unknown> {
  const absPath = join(process.cwd(), relativePath);
  return JSON.parse(readFileSync(absPath, "utf8")) as Record<string, unknown>;
}

/** Synchronous default (English) for first paint. Used by client context only. */
export function getDefaultTranslationsSync(): Translations {
  const enSite = readLocaleFile("locales/en/site.json");
  const enApp = readLocaleFile("locales/en/app.json");
  const sharedAdmin = readLocaleFile("locales/admin.json");
  return mergeNamespaces(enSite, enApp, sharedAdmin);
}

const localeCache: Record<string, Translations> = {};

/**
 * Load translations for a locale. Prefers split files (locales/<locale>/site.json, app.json),
 * always merges in shared admin from locales/admin.json. Falls back to legacy
 * locales/<locale>.json, then to English (sync default).
 *
 * All reads use readLocaleFile (fs.readFileSync) so webpack never inlines the
 * JSON content into the bundle — the files are read from disk at runtime.
 */
export async function loadLocale(locale: string): Promise<Translations> {
  if (localeCache[locale]) {
    return localeCache[locale];
  }

  // Read admin JSON via fs — opaque to webpack static analysis
  const sharedAdmin = readLocaleFile("locales/admin.json");

  // Try split site + app files first
  try {
    const siteData = readLocaleFile(`locales/${locale}/site.json`);
    const appData = readLocaleFile(`locales/${locale}/app.json`);
    const merged = mergeNamespaces(siteData, appData, sharedAdmin);
    localeCache[locale] = merged;
    return merged;
  } catch {
    // Fall through to legacy single-file
  }

  // Try legacy single-file (locales/<locale>.json)
  try {
    const legacyData = readLocaleFile(`locales/${locale}.json`);
    const translations: Translations = { ...legacyData, ...sharedAdmin };
    localeCache[locale] = translations;
    return translations;
  } catch {
    // Final fallback: English defaults
    const fallback = getDefaultTranslationsSync();
    localeCache[locale] = fallback;
    return fallback;
  }
}
