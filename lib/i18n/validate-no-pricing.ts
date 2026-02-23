/**
 * I18N PRICING VALIDATOR
 * 
 * Validates that no numeric pricing appears in i18n translation files.
 * Pricing should ONLY come from the database via GET /api/v1/billing/plans.
 * 
 * Run this during development to catch accidental hardcoded pricing.
 */

interface ValidationIssue {
  file: string;
  key: string;
  value: string;
  issue: string;
}

const PRICING_PATTERNS = [
  // Currency symbols with numbers
  /\$\d+/,
  /£\d+/,
  /€\d+/,
  /¥\d+/,
  /₹\d+/,
  
  // Pricing-related phrases with numbers
  /\d+\s*\/\s*month/i,
  /\d+\s*\/\s*year/i,
  /\d+\s*per\s+month/i,
  /\d+\s*per\s+year/i,
  
  // Decimal prices
  /\d+\.\d{2}/,
  
  // Words followed by numbers (cost, price, etc.)
  /price.*\d+/i,
  /cost.*\d+/i,
  /\d+.*price/i,
  /\d+.*cost/i,
];

/**
 * Recursively scan translation object for pricing values
 */
function scanObject(
  obj: any,
  path: string[] = [],
  issues: ValidationIssue[] = []
): ValidationIssue[] {
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = [...path, key];
    const pathString = currentPath.join(".");

    if (typeof value === "string") {
      // Check if value matches any pricing pattern
      for (const pattern of PRICING_PATTERNS) {
        if (pattern.test(value)) {
          issues.push({
            file: "translations",
            key: pathString,
            value,
            issue: `Contains numeric pricing (pattern: ${pattern})`,
          });
          break; // Only report first match per value
        }
      }
    } else if (typeof value === "object" && value !== null) {
      scanObject(value, currentPath, issues);
    }
  }

  return issues;
}

/**
 * Validate translations object for hardcoded pricing
 */
export function validateNoPricing(translations: any, filename: string = "translations"): ValidationIssue[] {
  const issues = scanObject(translations);
  
  if (issues.length > 0) {
    console.warn(
      `\n⚠️  PRICING IN I18N DETECTED (${filename}) ⚠️\n` +
      `Found ${issues.length} issue(s):\n` +
      issues.map(i => `  - ${i.key}: "${i.value}"\n    ${i.issue}`).join("\n") +
      `\n\n❌ DO NOT hardcode pricing in translation files!\n` +
      `✅ Pricing must come from: GET /api/v1/billing/plans\n`
    );
  }

  return issues;
}

/**
 * Validate all locale files
 */
export async function validateAllLocales(): Promise<{
  valid: boolean;
  issues: Record<string, ValidationIssue[]>;
}> {
  const locales = ["en", "es", "fr", "de", "it", "pt", "ja", "zh", "ko", "ar"];
  const allIssues: Record<string, ValidationIssue[]> = {};
  
  for (const locale of locales) {
    try {
      const translations = await import(`@/locales/${locale}.json`);
      const issues = validateNoPricing(translations.default || translations, `${locale}.json`);
      
      if (issues.length > 0) {
        allIssues[locale] = issues;
      }
    } catch (err) {
      // Locale file doesn't exist, skip
      continue;
    }
  }

  const valid = Object.keys(allIssues).length === 0;
  
  if (!valid) {
    console.error(
      `\n❌ VALIDATION FAILED: Pricing found in i18n files\n` +
      `Files with issues: ${Object.keys(allIssues).join(", ")}\n` +
      `\nREMEDIATION:\n` +
      `1. Remove ALL numeric pricing from i18n files\n` +
      `2. Fetch pricing from GET /api/v1/billing/plans\n` +
      `3. Re-run validation: npm run validate:i18n\n`
    );
  }

  return { valid, issues: allIssues };
}

/**
 * Development-only check (runs in dev mode)
 */
export function devCheckPricing(translations: any, locale: string): void {
  if (process.env.NODE_ENV !== "development") return;
  
  const issues = validateNoPricing(translations, `${locale}.json`);
  
  if (issues.length > 0) {
    // Warn but don't crash the app
    console.warn(
      `\n🚨 DEV WARNING: Pricing detected in ${locale}.json\n` +
      `This will fail in CI/CD. Remove pricing from i18n files.\n`
    );
  }
}
