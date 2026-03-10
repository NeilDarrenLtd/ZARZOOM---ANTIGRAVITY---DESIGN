#!/usr/bin/env tsx
/**
 * Locale Sync Utility
 *
 * Uses the English locale as the canonical source of truth and updates
 * all other locale files with any missing keys.
 *
 * Usage:
 *   npx tsx scripts/sync-locales.ts          # dry-run (report only)
 *   npx tsx scripts/sync-locales.ts --write  # apply changes
 *   npm run sync:i18n                        # dry-run via npm
 *   npm run sync:i18n -- --write             # apply via npm
 *
 * Behaviour:
 *   - Recursively compares nested JSON structures
 *   - Adds missing keys with a "[TODO:xx] <english value>" placeholder
 *   - Preserves existing non-empty translations
 *   - Never overwrites existing values
 *   - Reports missing keys, extra keys, and empty values per locale
 *   - Safe and repeatable — running twice with no changes produces no diff
 */

import fs from "fs";
import path from "path";

const LOCALES_DIR = path.resolve(__dirname, "..", "locales");
const SOURCE_LOCALE = "en";
const FILES = ["app.json", "site.json"];

const writeMode = process.argv.includes("--write");

// ── helpers ──────────────────────────────────────────────────────────

type JsonObj = Record<string, unknown>;

function isPlainObject(val: unknown): val is JsonObj {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

/** Collect all dot-path leaf keys from a nested object. */
function leafPaths(obj: JsonObj, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, val] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(val)) {
      for (const [k, v] of leafPaths(val as JsonObj, full)) out.set(k, v);
    } else {
      out.set(full, val);
    }
  }
  return out;
}

/**
 * Deep-merge missing keys from `source` into `target`.
 * Returns a new object — never mutates the inputs.
 * Missing leaves are filled with `placeholder(localeCode, englishValue)`.
 */
function deepMerge(
  source: JsonObj,
  target: JsonObj,
  locale: string,
  parentPath = "",
): { merged: JsonObj; added: string[] } {
  const merged: JsonObj = {};
  const added: string[] = [];

  for (const key of Object.keys(source)) {
    const fullPath = parentPath ? `${parentPath}.${key}` : key;
    const srcVal = source[key];
    const tgtVal = target[key];

    if (isPlainObject(srcVal)) {
      const child = deepMerge(
        srcVal as JsonObj,
        isPlainObject(tgtVal) ? (tgtVal as JsonObj) : {},
        locale,
        fullPath,
      );
      merged[key] = child.merged;
      added.push(...child.added);
    } else if (key in target) {
      merged[key] = tgtVal;
    } else {
      // Key missing — fill with placeholder
      if (typeof srcVal === "string") {
        merged[key] = `[TODO:${locale}] ${srcVal}`;
      } else {
        // Arrays or other primitives: copy the English value as-is
        merged[key] = srcVal;
      }
      added.push(fullPath);
    }
  }

  // Preserve extra keys that exist in target but not in source
  for (const key of Object.keys(target)) {
    if (!(key in merged)) {
      merged[key] = target[key];
    }
  }

  return { merged, added };
}

// ── main ─────────────────────────────────────────────────────────────

interface LocaleFileReport {
  file: string;
  added: string[];
  extra: string[];
  empty: string[];
  untranslated: string[];
}

interface LocaleReport {
  locale: string;
  files: LocaleFileReport[];
}

function run() {
  console.log(
    writeMode
      ? "\n  SYNC LOCALES — WRITE MODE\n"
      : "\n  SYNC LOCALES — DRY RUN (use --write to apply)\n",
  );

  const localeDirs = fs
    .readdirSync(LOCALES_DIR)
    .filter((d) => {
      const full = path.join(LOCALES_DIR, d);
      return fs.statSync(full).isDirectory() && d !== SOURCE_LOCALE;
    })
    .sort();

  const reports: LocaleReport[] = [];
  let totalAdded = 0;
  let totalExtra = 0;
  let totalEmpty = 0;
  let totalUntranslated = 0;

  for (const locale of localeDirs) {
    const localeReport: LocaleReport = { locale, files: [] };

    for (const file of FILES) {
      const enPath = path.join(LOCALES_DIR, SOURCE_LOCALE, file);
      const tgtPath = path.join(LOCALES_DIR, locale, file);

      if (!fs.existsSync(enPath)) continue;

      const enData: JsonObj = JSON.parse(fs.readFileSync(enPath, "utf8"));

      if (!fs.existsSync(tgtPath)) {
        // Entire file is missing — create it from English with placeholders
        const { merged, added } = deepMerge(enData, {}, locale);
        if (writeMode) {
          fs.writeFileSync(tgtPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
        }
        localeReport.files.push({ file, added, extra: [], empty: [], untranslated: [] });
        totalAdded += added.length;
        continue;
      }

      const tgtData: JsonObj = JSON.parse(fs.readFileSync(tgtPath, "utf8"));

      // Detect issues
      const enLeaves = leafPaths(enData);
      const tgtLeaves = leafPaths(tgtData);

      const extra: string[] = [];
      for (const key of tgtLeaves.keys()) {
        if (!enLeaves.has(key)) extra.push(key);
      }

      const empty: string[] = [];
      const untranslated: string[] = [];
      for (const [key, val] of tgtLeaves) {
        if (val === "" || val === null || val === undefined) {
          empty.push(key);
        } else if (typeof val === "string" && /^\[TODO:[a-z-]+\]/i.test(val)) {
          untranslated.push(key);
        }
      }

      // Merge missing keys
      const { merged, added } = deepMerge(enData, tgtData, locale);

      if (writeMode && added.length > 0) {
        fs.writeFileSync(tgtPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
      }

      if (added.length || extra.length || empty.length || untranslated.length) {
        localeReport.files.push({ file, added, extra, empty, untranslated });
      }

      totalAdded += added.length;
      totalExtra += extra.length;
      totalEmpty += empty.length;
      totalUntranslated += untranslated.length;
    }

    if (localeReport.files.length > 0) {
      reports.push(localeReport);
    }
  }

  // ── report ───────────────────────────────────────────────────────

  if (reports.length === 0) {
    console.log("  All locale files are fully in sync with English.\n");
    console.log("  Missing keys:    0");
    console.log("  Extra keys:      0");
    console.log("  Empty values:    0");
    console.log("  Untranslated:    0\n");
    process.exit(0);
  }

  const COL = { reset: "\x1b[0m", red: "\x1b[31m", yellow: "\x1b[33m", green: "\x1b[32m", dim: "\x1b[2m", bold: "\x1b[1m" };

  for (const lr of reports) {
    console.log(`  ${COL.bold}${lr.locale}${COL.reset}`);
    for (const fr of lr.files) {
      console.log(`    ${fr.file}`);
      if (fr.added.length) {
        console.log(`      ${COL.green}+ ${fr.added.length} missing key(s) ${writeMode ? "added" : "to add"}:${COL.reset}`);
        for (const k of fr.added) console.log(`        ${COL.dim}${k}${COL.reset}`);
      }
      if (fr.extra.length) {
        console.log(`      ${COL.yellow}~ ${fr.extra.length} extra key(s) not in English:${COL.reset}`);
        for (const k of fr.extra) console.log(`        ${COL.dim}${k}${COL.reset}`);
      }
      if (fr.empty.length) {
        console.log(`      ${COL.red}! ${fr.empty.length} empty value(s):${COL.reset}`);
        for (const k of fr.empty) console.log(`        ${COL.dim}${k}${COL.reset}`);
      }
      if (fr.untranslated.length) {
        console.log(`      ${COL.yellow}? ${fr.untranslated.length} untranslated [TODO] value(s):${COL.reset}`);
        for (const k of fr.untranslated) console.log(`        ${COL.dim}${k}${COL.reset}`);
      }
    }
    console.log();
  }

  console.log("  ────────────────────────────────────────");
  console.log(`  Locales with issues:  ${reports.length} / ${localeDirs.length}`);
  console.log(`  Missing keys:         ${totalAdded}${writeMode ? " (added)" : ""}`);
  console.log(`  Extra keys:           ${totalExtra}`);
  console.log(`  Empty values:         ${totalEmpty}`);
  console.log(`  Untranslated:         ${totalUntranslated}`);

  if (!writeMode && totalAdded > 0) {
    console.log(`\n  Run with ${COL.bold}--write${COL.reset} to apply missing key additions.\n`);
  } else if (totalUntranslated > 0) {
    console.log(`\n  Replace [TODO:xx] placeholders with proper translations in each locale file.\n`);
  } else {
    console.log();
  }

  process.exit(totalAdded > 0 && !writeMode ? 1 : 0);
}

run();
