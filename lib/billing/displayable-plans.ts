/**
 * Displayable Plans Utility
 *
 * This module now delegates all database + i18n gating to the
 * canonical pricing pipeline in `lib/pricing`. It then enriches
 * those plans with the structured `PlanCopy` object used by
 * marketing/landing surfaces.
 */

import { getPlanCopy, type PlanCopy } from "@/lib/i18n/plan-copy";
import type { GetPlansResponse, ApiPlanPrice } from "@/lib/billing/api-types";
import {
  fetchPlans,
  getDisplayablePlans as getPricingDisplayablePlans,
} from "@/lib/pricing";

/**
 * Displayable plan combines database data with i18n copy
 */
export interface DisplayablePlan {
  // From database
  planKey: string;
  name: string;
  description: string | null;
  sortOrder: number;
  entitlements: Record<string, boolean>;
  quotaPolicy: Record<string, number>;
  features: string[];
  prices: ApiPlanPrice[];
  
  // From i18n
  copy: PlanCopy;
}

/**
 * Get all displayable plans (passes both DB and i18n gates)
 * 
 * @param t - Translation function from useI18n
 * @returns Array of displayable plans, sorted by sortOrder
 */
export async function getDisplayablePlans(
  t: (key: string, fallback?: string) => string
): Promise<DisplayablePlan[]> {
  try {
    // Use the canonical pricing pipeline for DB + i18n gating
    const response = await fetchPlans();
    const pricingPlans = getPricingDisplayablePlans(response.plans, t);

    const displayable: DisplayablePlan[] = [];

    for (const plan of pricingPlans) {
      try {
        const copy = getPlanCopy(plan.planKey, t);
        displayable.push({
          planKey: plan.planKey,
          name: plan.name,
          description: plan.description,
          sortOrder: plan.sortOrder,
          entitlements: plan.entitlements,
          quotaPolicy: plan.quotaPolicy,
          features: plan.features,
          prices: plan.prices as ApiPlanPrice[],
          copy,
        });
      } catch {
        // If structured copy cannot be constructed, skip this plan
        continue;
      }
    }

    // Sort by sortOrder for predictable display
    displayable.sort((a, b) => a.sortOrder - b.sortOrder);
    return displayable;

  } catch (error) {
    throw error;
  }
}

/**
 * Client-side version (uses fetch directly, works in client components)
 */
export async function getDisplayablePlansClient(
  t: (key: string, fallback?: string) => string
): Promise<DisplayablePlan[]> {
  // Client-side: reuse the same canonical pipeline and projection
  const response = await fetchPlans();
  const pricingPlans = getPricingDisplayablePlans(response.plans, t);

  const displayable: DisplayablePlan[] = [];

  for (const plan of pricingPlans) {
    try {
      const copy = getPlanCopy(plan.planKey, t);
      displayable.push({
        planKey: plan.planKey,
        name: plan.name,
        description: plan.description,
        sortOrder: plan.sortOrder,
        entitlements: plan.entitlements,
        quotaPolicy: plan.quotaPolicy,
        features: plan.features,
        prices: plan.prices as ApiPlanPrice[],
        copy,
      });
    } catch {
      continue;
    }
  }

  displayable.sort((a, b) => a.sortOrder - b.sortOrder);
  return displayable;
}

/**
 * Check if any plans are displayable (useful for fallback logic)
 */
export async function hasDisplayablePlans(
  t: (key: string, fallback?: string) => string
): Promise<boolean> {
  try {
    const plans = await getDisplayablePlans(t);
    return plans.length > 0;
  } catch {
    return false;
  }
}
