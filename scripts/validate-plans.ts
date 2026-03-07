#!/usr/bin/env tsx

/**
 * Plan Validation Script
 * 
 * Validates that database plans and i18n translations are in sync.
 * 
 * Usage:
 *   npm run validate:plans
 * 
 * Exit codes:
 *   0 - All validations passed
 *   1 - Validation errors found
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface Plan {
  id: string;
  plan_key: string;
  name: string;
  is_active: boolean;
}

interface PlanCopy {
  displayName?: string;
  shortTagline?: string;
  description?: string;
  bullets?: string[];
  cta?: string;
}

async function main() {
  console.log("\n🔍 Validating Plan & i18n Sync\n");
  console.log("=" .repeat(60));
  
  // 1. Fetch plans from database
  console.log("\n📊 Fetching plans from database...");
  const { data: plans, error } = await supabase
    .from("plans")
    .select("id, plan_key, name, is_active")
    .order("sort_order", { ascending: true });
  
  if (error) {
    console.error("❌ Database error:", error.message);
    process.exit(1);
  }
  
  if (!plans || plans.length === 0) {
    console.warn("⚠️  No plans found in database");
    process.exit(0);
  }
  
  console.log(`✓ Found ${plans.length} plan(s) in database`);
  
  // 2. Load i18n translations (billing.plans in locale app.json)
  console.log("\n📝 Loading i18n translations...");
  const localesDir = path.join(process.cwd(), "locales");
  const enAppPath = path.join(localesDir, "en", "app.json");
  
  if (!fs.existsSync(enAppPath)) {
    console.error("❌ locales/en/app.json not found at:", enAppPath);
    process.exit(1);
  }
  
  const enAppContent = fs.readFileSync(enAppPath, "utf-8");
  const translations = JSON.parse(enAppContent);
  const planCopies: Record<string, PlanCopy> = translations.billing?.plans || {};
  
  console.log(`✓ Loaded translations for ${Object.keys(planCopies).length} plan(s)`);
  
  // 3. Validate sync
  console.log("\n🔎 Checking for mismatches...\n");
  
  let hasErrors = false;
  const dbPlanKeys = new Set(plans.map((p: Plan) => p.plan_key));
  const i18nPlanKeys = new Set(Object.keys(planCopies));
  
  // Check: Plans in DB without i18n
  const missingI18n: string[] = [];
  for (const plan of plans) {
    if (!i18nPlanKeys.has(plan.plan_key)) {
      missingI18n.push(plan.plan_key);
      hasErrors = true;
    }
  }
  
  if (missingI18n.length > 0) {
    console.error("❌ Plans in database WITHOUT i18n copy:");
    missingI18n.forEach((key) => {
      console.error(`   • ${key}`);
      console.error(`     → Add billing.plans.${key}.{displayName,shortTagline,description,bullets} to locales/en/app.json`);
    });
    console.error("");
  }
  
  // Check: i18n copy without DB entries
  const orphanedI18n: string[] = [];
  for (const planKey of i18nPlanKeys) {
    if (!dbPlanKeys.has(planKey)) {
      orphanedI18n.push(planKey);
    }
  }
  
  if (orphanedI18n.length > 0) {
    console.warn("⚠️  i18n translations WITHOUT database entry:");
    orphanedI18n.forEach((key) => {
      console.warn(`   • ${key}`);
      console.warn(`     → Either create plan in DB or remove billing.plans.${key} from locales/en/app.json`);
    });
    console.warn("");
  }
  
  // Check: Incomplete i18n copy
  const incompleteCopy: Array<{ key: string; missing: string[] }> = [];
  const required = ["displayName", "shortTagline", "description", "bullets"];
  
  for (const plan of plans) {
    if (i18nPlanKeys.has(plan.plan_key)) {
      const copy = planCopies[plan.plan_key];
      const missing: string[] = [];
      
      for (const field of required) {
        if (field === "bullets") {
          if (!Array.isArray(copy.bullets) || copy.bullets.length === 0) {
            missing.push(field);
          }
        } else if (!copy[field as keyof PlanCopy] || String(copy[field as keyof PlanCopy]).trim() === "") {
          missing.push(field);
        }
      }
      
      if (missing.length > 0) {
        incompleteCopy.push({ key: plan.plan_key, missing });
        hasErrors = true;
      }
    }
  }
  
  if (incompleteCopy.length > 0) {
    console.error("❌ Plans with INCOMPLETE i18n copy:");
    incompleteCopy.forEach(({ key, missing }) => {
      console.error(`   • ${key} missing: ${missing.join(", ")}`);
      console.error(`     → Add missing fields to billing.plans.${key} in locales/en/app.json`);
    });
    console.error("");
  }
  
  // Check: Active plans visibility
  const activePlans = plans.filter((p: Plan) => p.is_active);
  const visiblePlans = activePlans.filter((p: Plan) => 
    i18nPlanKeys.has(p.plan_key) && 
    !incompleteCopy.some(ic => ic.key === p.plan_key)
  );
  
  console.log("📈 Summary:");
  console.log(`   Total plans:        ${plans.length}`);
  console.log(`   Active plans:       ${activePlans.length}`);
  console.log(`   Visible to users:   ${visiblePlans.length}`);
  console.log(`   Hidden (no i18n):   ${activePlans.length - visiblePlans.length}`);
  
  // Final result
  console.log("\n" + "=".repeat(60));
  
  if (hasErrors) {
    console.error("\n❌ Validation FAILED\n");
    console.error("Fix the errors above before deploying.\n");
    process.exit(1);
  } else if (orphanedI18n.length > 0) {
    console.warn("\n⚠️  Validation passed with warnings\n");
    console.warn("Consider cleaning up orphaned i18n entries.\n");
    process.exit(0);
  } else {
    console.log("\n✅ Validation PASSED\n");
    console.log("All plans have complete i18n copy and are ready to display.\n");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
