/**
 * Plan & i18n Sync Validator
 * 
 * Runtime validation to ensure database plans and i18n translations stay in sync.
 * 
 * Checks:
 * 1. DB plans without i18n copy → warning
 * 2. i18n copy without DB plans → warning
 * 
 * Only runs in development mode.
 */

import type { Plan } from "./types";

interface PlanCopy {
  displayName: string;
  shortTagline: string;
  description: string;
  bullets: string[];
  cta?: string;
}

interface I18nTranslations {
  plans?: Record<string, PlanCopy>;
}

/**
 * Validate that DB plans have matching i18n and vice versa
 */
export function validatePlanSync(
  dbPlans: Plan[],
  translations: I18nTranslations
): void {
  // Only run in development
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const planCopies = translations.plans || {};
  const dbPlanKeys = new Set(dbPlans.map((p) => p.plan_key));
  const i18nPlanKeys = new Set(Object.keys(planCopies));

  // Check 1: Plans in DB but missing i18n
  const missingI18n: string[] = [];
  for (const plan of dbPlans) {
    if (!i18nPlanKeys.has(plan.plan_key)) {
      missingI18n.push(plan.plan_key);
    }
  }

  if (missingI18n.length > 0) {
    console.warn(
      `%c⚠️ [v0] PLAN MISMATCH: ${missingI18n.length} plan(s) in DB without i18n copy`,
      "color: #f59e0b; font-weight: bold; font-size: 13px;"
    );
    
    missingI18n.forEach((planKey) => {
      console.warn(
        `%c→ Plan '${planKey}' exists in DB but missing i18n copy`,
        "color: #f59e0b; font-size: 12px;"
      );
      console.warn(
        `%c  Fix: Add billing.plans.${planKey}.{displayName,shortTagline,description,bullets} to locales/en/app.json`,
        "color: #6b7280; font-size: 11px; font-style: italic;"
      );
    });
    
    console.warn(
      `%c  This plan will NOT be visible to users until i18n is added.`,
      "color: #ef4444; font-size: 12px; font-weight: bold;"
    );
  }

  // Check 2: i18n copy without DB plans
  const orphanedI18n: string[] = [];
  for (const planKey of i18nPlanKeys) {
    if (!dbPlanKeys.has(planKey)) {
      orphanedI18n.push(planKey);
    }
  }

  if (orphanedI18n.length > 0) {
    console.warn(
      `%c⚠️ [v0] ORPHANED I18N: ${orphanedI18n.length} translation(s) without DB entry`,
      "color: #f59e0b; font-weight: bold; font-size: 13px;"
    );
    
    orphanedI18n.forEach((planKey) => {
      console.warn(
        `%c→ Translation exists for '${planKey}' but plan not found in database`,
        "color: #f59e0b; font-size: 12px;"
      );
      console.warn(
        `%c  Fix: Either create the plan in DB or remove billing.plans.${planKey} from locales/en/app.json`,
        "color: #6b7280; font-size: 11px; font-style: italic;"
      );
    });
    
    console.warn(
      `%c  This translation is unused and should be cleaned up.`,
      "color: #6b7280; font-size: 12px;"
    );
  }

  // Success message if everything is in sync
  if (missingI18n.length === 0 && orphanedI18n.length === 0) {
    console.log(
      `%c✓ [v0] Plan sync validation passed: ${dbPlans.length} plan(s) have complete i18n`,
      "color: #10b981; font-weight: bold; font-size: 12px;"
    );
  }
}

/**
 * Validate individual plan has complete i18n copy
 */
export function validatePlanCopy(
  planKey: string,
  copy: PlanCopy | undefined
): boolean {
  if (!copy) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `%c⚠️ [v0] Plan '${planKey}' missing i18n copy entirely`,
        "color: #f59e0b; font-size: 12px;"
      );
    }
    return false;
  }

  const required: (keyof PlanCopy)[] = [
    "displayName",
    "shortTagline",
    "description",
    "bullets",
  ];

  const missing: string[] = [];
  
  for (const key of required) {
    if (key === "bullets") {
      if (!Array.isArray(copy.bullets) || copy.bullets.length === 0) {
        missing.push(key);
      }
    } else if (!copy[key] || String(copy[key]).trim() === "") {
      missing.push(key);
    }
  }

  if (missing.length > 0 && process.env.NODE_ENV === "development") {
    console.warn(
      `%c⚠️ [v0] Plan '${planKey}' incomplete i18n - missing: ${missing.join(", ")}`,
      "color: #f59e0b; font-size: 12px;"
    );
    return false;
  }

  return true;
}

/**
 * Validate plan has prices for at least one currency
 * Accepts PlanWithPrices (which includes the prices array)
 */
export function validatePlanPricing(plan: Plan & { prices?: { is_active: boolean }[] }): boolean {
  if (!plan.prices || plan.prices.length === 0) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `%c⚠️ [v0] Plan '${plan.plan_key}' has no prices defined`,
        "color: #f59e0b; font-size: 12px;"
      );
    }
    return false;
  }

  const activePrices = plan.prices.filter((p) => p.is_active);
  if (activePrices.length === 0) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `%c⚠️ [v0] Plan '${plan.plan_key}' has no active prices`,
        "color: #f59e0b; font-size: 12px;"
      );
    }
    return false;
  }

  return true;
}

/**
 * Get comprehensive validation report
 */
export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  planCount: number;
  syncedCount: number;
}

export function getValidationReport(
  dbPlans: Plan[],
  translations: I18nTranslations
): ValidationReport {
  const report: ValidationReport = {
    valid: true,
    errors: [],
    warnings: [],
    planCount: dbPlans.length,
    syncedCount: 0,
  };

  const planCopies = translations.plans || {};
  const dbPlanKeys = new Set(dbPlans.map((p) => p.plan_key));
  const i18nPlanKeys = new Set(Object.keys(planCopies));

  // Check DB plans
  for (const plan of dbPlans) {
    if (!i18nPlanKeys.has(plan.plan_key)) {
      report.errors.push(
        `Plan '${plan.plan_key}' in database but missing i18n copy`
      );
      report.valid = false;
    } else {
      const copy = planCopies[plan.plan_key];
      if (!validatePlanCopy(plan.plan_key, copy)) {
        report.errors.push(
          `Plan '${plan.plan_key}' has incomplete i18n copy`
        );
        report.valid = false;
      } else {
        report.syncedCount++;
      }
    }

    if (!validatePlanPricing(plan)) {
      report.warnings.push(
        `Plan '${plan.plan_key}' has no active prices`
      );
    }
  }

  // Check orphaned i18n
  for (const planKey of i18nPlanKeys) {
    if (!dbPlanKeys.has(planKey)) {
      report.warnings.push(
        `i18n copy exists for '${planKey}' but plan not in database`
      );
    }
  }

  return report;
}
