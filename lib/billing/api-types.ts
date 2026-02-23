/**
 * lib/billing/api-types.ts
 * 
 * TypeScript types for the canonical GET /api/plans endpoint.
 * These types define the public API contract.
 */

import type { Currency, BillingInterval } from "./types";

// Re-export types for convenience - these MUST be exported
export type { Currency, BillingInterval };

/**
 * Price object returned by the API
 */
export interface ApiPlanPrice {
  id: string;
  currency: Currency;
  interval: BillingInterval;
  amountMinor: number;  // Price in minor currency units (pence/cents)
  isActive: boolean;
  billingProviderId: string | null;
}

/**
 * Plan object returned by the API
 */
export interface ApiPlan {
  planKey: string;  // e.g., 'basic', 'pro', 'advanced'
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  entitlements: Record<string, boolean>;  // Feature flags
  quotaPolicy: Record<string, number>;    // Usage limits
  features: string[];  // Feature list for UI
  prices: ApiPlanPrice[];
}

/**
 * Root response from GET /api/plans
 */
export interface GetPlansResponse {
  plans: ApiPlan[];
}

/**
 * Helper to get a specific price from a plan
 */
export function getPlanPrice(
  plan: ApiPlan,
  currency: Currency,
  interval: BillingInterval
): ApiPlanPrice | null {
  return plan.prices.find(
    (p) => p.currency === currency && p.interval === interval && p.isActive
  ) || null;
}

/**
 * Helper to get the monthly price for a plan in a specific currency
 */
export function getMonthlyPrice(
  plan: ApiPlan,
  currency: Currency
): ApiPlanPrice | null {
  return getPlanPrice(plan, currency, "month");
}

/**
 * Helper to get the annual price for a plan in a specific currency
 */
export function getAnnualPrice(
  plan: ApiPlan,
  currency: Currency
): ApiPlanPrice | null {
  return getPlanPrice(plan, currency, "year");
}

/**
 * Calculate savings percentage when going annual
 */
export function calculateAnnualSavings(
  plan: ApiPlan,
  currency: Currency
): number | null {
  const monthly = getMonthlyPrice(plan, currency);
  const annual = getAnnualPrice(plan, currency);

  if (!monthly || !annual) return null;

  const monthlyTotal = monthly.amountMinor * 12;
  const savings = monthlyTotal - annual.amountMinor;
  const savingsPercent = (savings / monthlyTotal) * 100;

  return Math.round(savingsPercent);
}

/**
 * Get all available currencies for a plan
 */
export function getPlanCurrencies(plan: ApiPlan): Currency[] {
  const currencies = new Set<Currency>();
  plan.prices.forEach((p) => {
    if (p.isActive) currencies.add(p.currency);
  });
  return Array.from(currencies);
}

/**
 * Get all available intervals for a plan in a specific currency
 */
export function getPlanIntervals(
  plan: ApiPlan,
  currency: Currency
): BillingInterval[] {
  const intervals = new Set<BillingInterval>();
  plan.prices.forEach((p) => {
    if (p.isActive && p.currency === currency) {
      intervals.add(p.interval);
    }
  });
  return Array.from(intervals);
}

/**
 * Check if a plan has a specific entitlement
 */
export function hasPlanEntitlement(
  plan: ApiPlan,
  entitlementKey: string
): boolean {
  return plan.entitlements[entitlementKey] === true;
}

/**
 * Get a quota value for a plan
 */
export function getPlanQuota(
  plan: ApiPlan,
  quotaKey: string
): number | null {
  return plan.quotaPolicy[quotaKey] ?? null;
}
