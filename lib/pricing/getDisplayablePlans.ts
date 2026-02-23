import type { ApiPlan } from "@/lib/billing/api-types";

/**
 * Type for i18n translation function
 */
type TranslateFn = (key: string) => string;

/**
 * Enriched plan with i18n copy
 */
export interface DisplayablePlan extends ApiPlan {
  displayName: string;
  displayDescription: string;
  displayFeatures: string[];
}

/**
 * Check if a plan has i18n translations defined.
 * Both DB data AND i18n translations must exist for a plan to be displayable.
 */
function hasPlanCopy(planKey: string, t: TranslateFn): boolean {
  const nameKey = `plans.${planKey}.name`;
  const translation = t(nameKey);
  
  // If translation returns the key itself, it means no translation exists
  return translation !== nameKey && translation !== "";
}

/**
 * Get displayable plans by enforcing DB + i18n gating.
 * Only plans that exist in BOTH the database AND i18n files will be returned.
 * 
 * This is the single source of truth for which plans should be displayed.
 * 
 * @param plans - Plans from API
 * @param t - i18n translation function
 * @returns Sorted array of displayable plans with i18n copy injected
 */
export function getDisplayablePlans(
  plans: ApiPlan[],
  t: TranslateFn
): DisplayablePlan[] {
  // Development-only logging
  if (process.env.NODE_ENV === "development") {
    console.log("[v0] 🎯 getDisplayablePlans() - Processing plans:");
    console.log(`[v0]   - Input plans count: ${plans.length}`);
    console.log(`[v0]   - Plan keys: [${plans.map(p => p.planKey).join(", ")}]`);
  }

  const displayable: DisplayablePlan[] = [];

  for (const plan of plans) {
    // GATING: Skip plans without i18n translations
    if (!hasPlanCopy(plan.planKey, t)) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[v0] Plan "${plan.planKey}" exists in DB but has no i18n translations. Skipping.`
        );
      }
      continue;
    }

    // GATING: Skip plans with no active prices
    const hasActivePrices = plan.prices.some((p) => p.isActive);
    if (!hasActivePrices) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[v0] Plan "${plan.planKey}" has no active prices. Skipping.`
        );
      }
      continue;
    }

    // Enrich plan with i18n translations
    const displayName = t(`plans.${plan.planKey}.name`);
    const displayDescription = t(`plans.${plan.planKey}.description`);
    
    // Get feature translations
    const displayFeatures: string[] = [];
    let featureIndex = 0;
    while (true) {
      const featureKey = `plans.${plan.planKey}.features.${featureIndex}`;
      const feature = t(featureKey);
      
      // Stop when we hit a missing translation
      if (feature === featureKey) break;
      
      displayFeatures.push(feature);
      featureIndex++;
    }

    displayable.push({
      ...plan,
      displayName,
      displayDescription,
      displayFeatures,
    });
  }

  // Sort by sortOrder ascending
  const sorted = displayable.sort((a, b) => a.sortOrder - b.sortOrder);

  // Development-only logging
  if (process.env.NODE_ENV === "development") {
    console.log("[v0] ✅ getDisplayablePlans() - Result:");
    console.log(`[v0]   - Displayable plans count: ${sorted.length}`);
    console.log(`[v0]   - Displayable plan keys: [${sorted.map(p => p.planKey).join(", ")}]`);
    sorted.forEach(plan => {
      console.log(`[v0]   - Plan "${plan.planKey}":`);
      console.log(`[v0]     - Display Name: "${plan.displayName}"`);
      console.log(`[v0]     - Active Prices: ${plan.prices.filter(p => p.isActive).length}`);
      console.log(`[v0]     - Features: ${plan.displayFeatures.length}`);
    });
  }

  return sorted;
}

/**
 * Check if any displayable plans exist.
 * Useful for showing fallback UI.
 */
export function hasDisplayablePlans(plans: ApiPlan[], t: TranslateFn): boolean {
  return getDisplayablePlans(plans, t).length > 0;
}
