/**
 * Locale loader: supports split namespace files (site, app) per locale,
 * with one shared English-only admin file. Admin strings always come
 * from locales/admin.json. Fallback to legacy single-file per locale
 * when split files are missing.
 *
 * All JSON files are loaded via dynamic import() so webpack does not
 * inline them as large strings, avoiding the PackFileCacheStrategy
 * serialization warning.
 */

export type Translations = Record<string, unknown>;

function mergeNamespaces(
  site: Record<string, unknown>,
  app: Record<string, unknown>,
  admin: Record<string, unknown>
): Translations {
  return { ...site, ...app, ...admin };
}

const localeCache: Record<string, Translations> = {};

async function loadAdminTranslations(): Promise<Record<string, unknown>> {
  const mod = await import("@/locales/admin.json");
  return mod.default as Record<string, unknown>;
}

/**
 * Async default (English) for first paint. Used by client context only.
 * Replaced the old synchronous version to avoid static imports of large JSON.
 */
export async function getDefaultTranslations(): Promise<Translations> {
  const [siteMod, appMod, adminMod] = await Promise.all([
    import("@/locales/en/site.json"),
    import("@/locales/en/app.json"),
    loadAdminTranslations(),
  ]);
  return mergeNamespaces(
    siteMod.default as Record<string, unknown>,
    appMod.default as Record<string, unknown>,
    adminMod
  );
}

/**
 * Synchronous default kept for backwards-compat. Returns an empty object
 * on first call; callers should prefer getDefaultTranslations() (async).
 */
export function getDefaultTranslationsSync(): Translations {
  // Return cached English if already loaded, otherwise empty (will be
  // filled on next async load). This avoids the static large-string import.
  return localeCache["en"] ?? {};
}

/**
 * Load translations for a locale. Prefers split files (locales/<locale>/site.json, app.json),
 * always merges in shared admin from locales/admin.json. Falls back to legacy
 * locales/<locale>.json, then to English.
 */
export async function loadLocale(locale: string): Promise<Translations> {
  if (localeCache[locale]) {
    return localeCache[locale];
  }

  const adminMod = await loadAdminTranslations();

  try {
    const [siteMod, appMod] = await Promise.all([
      import(`@/locales/${locale}/site.json`).catch(() => null),
      import(`@/locales/${locale}/app.json`).catch(() => null),
    ]);
    if (siteMod?.default && appMod?.default) {
      const merged = mergeNamespaces(
        siteMod.default as Record<string, unknown>,
        appMod.default as Record<string, unknown>,
        adminMod
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
    const translations = { ...legacy, ...adminMod };
    localeCache[locale] = translations;
    return translations;
  } catch {
    // Fall back to English
    const fallback = await getDefaultTranslations();
    localeCache[locale] = fallback;
    return fallback;
  }
}
