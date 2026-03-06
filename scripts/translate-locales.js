#!/usr/bin/env node
'use strict';

/**
 * Locales translation generator.
 *
 * - Uses `locales/en.json` as the source of truth (never modified).
 * - For each target locale code, optionally reads a translation map from
 *   `scripts/translation-maps/<code>.json`.
 * - Deep-merges the map into the English structure, only overriding string
 *   values. Numbers, booleans, array structure, and key names remain identical.
 * - Writes the resulting locale file to `locales/<code>.json` (overwriting).
 *
 * The translation map files can contain a full copy of the structure or just
 * a subset; any keys not present in the map fall back to English.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT_DIR, 'locales');
const MAPS_DIR = path.join(__dirname, 'translation-maps');

const SOURCE_LOCALE = 'en';

/** Target locales to generate. */
const TARGET_LOCALES = [
  'fr',
  'es',
  'de',
  'it',
  'pt',
  'nl',
  'pl',
  'sv',
  'da',
  'no',
  'fi',
  'ru',
  'uk',
  'tr',
  'ar',
  'he',
  'hi',
  'zh',
  'ja',
  'ko',
  'th',
  'vi',
  'id',
  'ms',
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Deep-merge helper that:
 * - Only allows string values to be overridden by the translation map.
 * - Keeps numbers, booleans, null, and other primitives from the source.
 * - Preserves array structure (length and ordering) from the source; when a
 *   corresponding array exists in the map with the same length, items are
 *   merged by index so strings/objects inside arrays can be translated.
 */
function deepMergeStrings(source, override) {
  // String leaf: allow translated override.
  if (typeof source === 'string') {
    return typeof override === 'string' ? override : source;
  }

  // Arrays: preserve structure from source; merge per index when possible.
  if (Array.isArray(source)) {
    if (!Array.isArray(override) || override.length !== source.length) {
      return source.map((item) => deepMergeStrings(item, undefined));
    }
    return source.map((item, index) =>
      deepMergeStrings(item, override[index])
    );
  }

  // Objects: walk known keys from source, ignore unknown keys from override.
  if (source && typeof source === 'object') {
    const result = {};
    for (const key of Object.keys(source)) {
      const nextOverride =
        override && Object.prototype.hasOwnProperty.call(override, key)
          ? override[key]
          : undefined;
      result[key] = deepMergeStrings(source[key], nextOverride);
    }
    return result;
  }

  // Numbers, booleans, null, etc. are always taken from source.
  return source;
}

function main() {
  ensureDir(LOCALES_DIR);
  ensureDir(MAPS_DIR);

  const sourcePath = path.join(LOCALES_DIR, `${SOURCE_LOCALE}.json`);
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source locale file not found: ${sourcePath}`);
    process.exit(1);
  }

  const sourceData = loadJson(sourcePath);

  TARGET_LOCALES.forEach((locale) => {
    const mapPath = path.join(MAPS_DIR, `${locale}.json`);
    let mapData = null;

    if (fs.existsSync(mapPath)) {
      try {
        mapData = loadJson(mapPath);
        // eslint-disable-next-line no-console
        console.log(`Using translation map for ${locale}: ${mapPath}`);
      } catch (err) {
        console.error(
          `Failed to read translation map for ${locale} at ${mapPath}:`,
          err.message
        );
        console.error('Falling back to English for this locale.');
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `No translation map found for ${locale}. Copying English strings.`
      );
    }

    const merged = mapData
      ? deepMergeStrings(sourceData, mapData)
      : sourceData;

    const outPath = path.join(LOCALES_DIR, `${locale}.json`);
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
    // eslint-disable-next-line no-console
    console.log(`Wrote locale file: ${outPath}`);
  });
}

if (require.main === module) {
  main();
}

