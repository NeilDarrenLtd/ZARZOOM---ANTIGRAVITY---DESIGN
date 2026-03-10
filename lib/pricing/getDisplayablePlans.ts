import type { ApiPlan } from "@/lib/billing/api-types";
import { hasPlanCopy as hasI18nPlanCopy } from "@/lib/i18n/plan-copy";

/**
 * Type for i18n translation function
 * Matches the useI18n / plan-copy helpers signature.
 */
type TranslateFn = (key: string, fallback?: string) => string;

/**
 * Enriched plan with i18n copy
 */
export interface DisplayablePlan extends ApiPlan {
  displayName: string;
  displayDescription: string;
  displayFeatures: string[];
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
    // GATING: Skip plans without complete i18n translations.
    // Uses shared plan-copy helper to enforce displayName, shortTagline,
    // description, and at least one bullet.
    if (!hasI18nPlanCopy(plan.planKey, t)) {
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
    // Translations live at billing.plans.<planKey>.displayName / description / bullets
    const displayName = t(`billing.plans.${plan.planKey}.displayName`);
    const displayDescription = t(`billing.plans.${plan.planKey}.description`);
    
    // FALLBACK: If translations are missing (i18n broken in production),
    // use humanized plan key and plan data description
    const finalDisplayName = displayName !== `billing.plans.${plan.planKey}.displayName` 
      ? displayName 
      : plan.name || plan.planKey.charAt(0).toUpperCase() + plan.planKey.slice(1);
    
    const finalDisplayDescription = displayDescription !== `billing.plans.${plan.planKey}.description`
      ? displayDescription
      : plan.description || "";
    
    // Get feature bullet translations (billing.plans.<planKey>.bullets is an array)
    const displayFeatures: string[] = [];
    let featureIndex = 0;
    while (true) {
      const featureKey = `billing.plans.${plan.planKey}.bullets.${featureIndex}`;
      const feature = t(featureKey);
      
      // Stop when we hit a missing translation
      if (feature === featureKey) break;
      
      displayFeatures.push(feature);
      featureIndex++;
    }
    
    // FALLBACK: If no translated features, use plan features from API
    const finalDisplayFeatures = displayFeatures.length > 0 
      ? displayFeatures 
      : (plan.features || []);

    displayable.push({
      ...plan,
      displayName: finalDisplayName,
      displayDescription: finalDisplayDescription,
      displayFeatures: finalDisplayFeatures,
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
