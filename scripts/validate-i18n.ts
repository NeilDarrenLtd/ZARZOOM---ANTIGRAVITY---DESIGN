#!/usr/bin/env tsx
/**
 * Validate i18n files for hardcoded pricing
 * 
 * Usage: npm run validate:i18n
 * 
 * This script ensures no numeric pricing exists in translation files.
 * All pricing MUST come from the database via GET /api/v1/billing/plans.
 */

import { validateAllLocales } from "../lib/i18n/validate-no-pricing";

async function main() {
  console.log("🔍 Validating i18n files for hardcoded pricing...\n");

  const { valid, issues } = await validateAllLocales();

  if (valid) {
    console.log("✅ SUCCESS: No pricing found in i18n files\n");
    console.log("All translation files are clean. Pricing comes from the database.\n");
    process.exit(0);
  } else {
    console.error("\n❌ VALIDATION FAILED\n");
    console.error(`Found pricing in ${Object.keys(issues).length} locale file(s):\n`);
    
    for (const [locale, localeIssues] of Object.entries(issues)) {
      console.error(`\n📁 ${locale}.json (${localeIssues.length} issue(s)):`);
      localeIssues.forEach((issue) => {
        console.error(`  ❌ ${issue.key}`);
        console.error(`     Value: "${issue.value}"`);
        console.error(`     Issue: ${issue.issue}\n`);
      });
    }

    console.error("\n🔧 HOW TO FIX:\n");
    console.error("1. Remove ALL numeric pricing from translation files");
    console.error("2. Fetch pricing dynamically from: GET /api/v1/billing/plans");
    console.error("3. Store pricing ONLY in the database (plans & plan_prices tables)");
    console.error("4. Re-run: npm run validate:i18n\n");
    
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error running validation:", err);
  process.exit(1);
});
