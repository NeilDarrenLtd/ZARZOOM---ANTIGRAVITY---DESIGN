import type { ApiPlan, ApiPlanPrice, Currency, BillingInterval } from "@/lib/billing/api-types";

/**
 * Get the price for a specific plan, currency, and interval selection.
 * Returns null if no matching active price exists.
 * 
 * This is the single source of truth for price selection logic.
 * 
 * @param plan - The plan to get price for
 * @param currency - The selected currency (GBP, USD, EUR)
 * @param interval - The selected billing interval (monthly, annual)
 * @returns The matching price or null
 */
export function getPriceForSelection(
  plan: ApiPlan,
  currency: Currency,
  interval: BillingInterval
): ApiPlanPrice | null {
  const matchingPrice = plan.prices.find(
    (p) =>
      p.currency === currency &&
      p.interval === interval &&
      p.isActive === true
  );

  return matchingPrice || null;
}

/**
 * Check if a plan has a price for the given selection.
 */
export function hasPriceForSelection(
  plan: ApiPlan,
  currency: Currency,
  interval: BillingInterval
): boolean {
  return getPriceForSelection(plan, currency, interval) !== null;
}

/**
 * Get all available currencies for a plan across all intervals.
 */
export function getAvailableCurrencies(plan: ApiPlan): Currency[] {
  const currencies = new Set<Currency>();
  
  for (const price of plan.prices) {
    if (price.isActive) {
      currencies.add(price.currency);
    }
  }
  
  return Array.from(currencies);
}

/**
 * Get all available intervals for a plan and currency.
 */
export function getAvailableIntervals(
  plan: ApiPlan,
  currency: Currency
): BillingInterval[] {
  const intervals = new Set<BillingInterval>();
  
  for (const price of plan.prices) {
    if (price.isActive && price.currency === currency) {
      intervals.add(price.interval);
    }
  }
  
  return Array.from(intervals);
}
