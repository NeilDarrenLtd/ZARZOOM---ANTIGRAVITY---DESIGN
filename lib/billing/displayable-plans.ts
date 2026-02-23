/**
 * Displayable Plans Utility
 * 
 * Implements strict gating rules: a plan is displayable only if:
 * 1. It exists in the database (via GET /api/plans)
 * 2. It has complete i18n copy (via hasPlanCopy)
 * 
 * This ensures we never show plans without proper translations or
 * show translations for plans that don't exist in the database.
 */

import { hasPlanCopy, getPlanCopy, type PlanCopy } from "@/lib/i18n/plan-copy";
import type { GetPlansResponse, ApiPlan, ApiPlanPrice } from "@/lib/billing/api-types";
import { validatePlanSync } from "./validate-plan-sync";
import type { Plan } from "./types";

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
 * Fetch plans from the canonical API endpoint
 */
async function fetchPlansFromApi(): Promise<ApiPlan[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${baseUrl}/api/v1/billing/plans`;
  
  console.log("[v0] Fetching plans from:", url);
  
  const response = await fetch(url, {
    next: { revalidate: 120 }, // Cache for 2 minutes
  });
  
  if (!response.ok) {
    console.error("[v0] Failed to fetch plans:", response.status, response.statusText);
    throw new Error(`Failed to fetch plans: ${response.status}`);
  }
  
  const data: GetPlansResponse = await response.json();
  console.log("[v0] Fetched", data.plans.length, "plans from API");
  
  return data.plans;
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
    // 1. Fetch from database
    const apiPlans = await fetchPlansFromApi();
    console.log("[v0] Checking", apiPlans.length, "plans for i18n completeness");
    
    // DEV: Validate DB/i18n sync
    if (process.env.NODE_ENV === "development") {
      // Convert API plans to Plan type for validation
      const dbPlans: Plan[] = apiPlans.map((p) => ({
        id: p.planKey,
        plan_key: p.planKey,
        name: p.name,
        description: p.description,
        is_active: p.isActive,
        sort_order: p.sortOrder,
        entitlements: p.entitlements,
        quota_policy: p.quotaPolicy,
        features: p.features,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      
      // Get i18n translations
      const translations = {
        plans: {} as Record<string, any>,
      };
      
      // Extract plan keys from translation function
      apiPlans.forEach((plan) => {
        const testKey = `plans.${plan.planKey}.displayName`;
        const result = t(testKey, "__MISSING__");
        if (result !== "__MISSING__") {
          translations.plans[plan.planKey] = {
            displayName: t(`plans.${plan.planKey}.displayName`),
            shortTagline: t(`plans.${plan.planKey}.shortTagline`),
            description: t(`plans.${plan.planKey}.description`),
            bullets: [],
          };
        }
      });
      
      validatePlanSync(dbPlans, translations);
    }
    
    // 2. Filter by i18n availability
    const displayable: DisplayablePlan[] = [];
    
    for (const plan of apiPlans) {
      const hasCompleteCopy = hasPlanCopy(plan.planKey, t);
      
      if (hasCompleteCopy) {
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
            prices: plan.prices,
            copy,
          });
          console.log("[v0] Plan displayable:", plan.planKey);
        } catch (err) {
          console.warn(`[v0] Plan NOT displayable: ${plan.planKey} - error getting copy:`, err);
        }
      } else {
        console.warn(
          `[v0] Plan NOT displayable: ${plan.planKey} - missing i18n keys`
        );
      }
    }
    
    // 3. Sort by sortOrder
    displayable.sort((a, b) => a.sortOrder - b.sortOrder);
    
    console.log("[v0] Final displayable plans:", displayable.length);
    return displayable;
    
  } catch (error) {
    console.error("[v0] Error in getDisplayablePlans:", error);
    throw error;
  }
}

/**
 * Client-side version (uses fetch directly, works in client components)
 */
export async function getDisplayablePlansClient(
  t: (key: string, fallback?: string) => string
): Promise<DisplayablePlan[]> {
  try {
    console.log("[v0] [CLIENT] Fetching plans from /api/v1/billing/plans");
    
    const response = await fetch("/api/v1/billing/plans");
    
    if (!response.ok) {
      throw new Error(`Failed to fetch plans: ${response.status}`);
    }
    
    const data: GetPlansResponse = await response.json();
    console.log("[v0] [CLIENT] Fetched", data.plans.length, "plans");
    
    const displayable: DisplayablePlan[] = [];
    
    for (const plan of data.plans) {
      const hasCompleteCopy = hasPlanCopy(plan.planKey, t);
      
      if (hasCompleteCopy) {
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
            prices: plan.prices,
            copy,
          });
        } catch (err) {
          console.warn(`[v0] [CLIENT] Plan NOT displayable: ${plan.planKey}`, err);
        }
      } else {
        console.warn(
          `[v0] [CLIENT] Plan NOT displayable: ${plan.planKey} - missing i18n keys`
        );
      }
    }
    
    displayable.sort((a, b) => a.sortOrder - b.sortOrder);
    
    console.log("[v0] [CLIENT] Displayable plans:", displayable.length);
    return displayable;
    
  } catch (error) {
    console.error("[v0] [CLIENT] Error fetching displayable plans:", error);
    throw error;
  }
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
