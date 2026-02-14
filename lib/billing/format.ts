import type { Currency, BillingInterval, PlanPriceRow } from "./types";

/* ------------------------------------------------------------------ */
/*  Currency Formatting                                                */
/* ------------------------------------------------------------------ */

const CURRENCY_CONFIG: Record<Currency, { symbol: string; locale: string }> = {
  GBP: { symbol: "\u00A3", locale: "en-GB" },
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "\u20AC", locale: "de-DE" },
};

/**
 * Format a unit_amount (integer cents/pence) into a display string.
 * e.g. 2999 GBP -> "\u00A329.99"
 */
export function formatPrice(
  unitAmount: number,
  currency: Currency
): string {
  const config = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.GBP;
  const amount = unitAmount / 100;

  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get the display label for an interval.
 */
export function formatInterval(interval: BillingInterval): string {
  return interval === "monthly" ? "/ month" : "/ year";
}

/**
 * Format a price row into a complete display string.
 * e.g. "\u00A329.99 / month"
 */
export function formatPriceWithInterval(price: PlanPriceRow): string {
  return `${formatPrice(price.unit_amount, price.currency)} ${formatInterval(price.interval)}`;
}

/**
 * Find a specific price from a list of prices.
 */
export function findPrice(
  prices: PlanPriceRow[],
  currency: Currency,
  interval: BillingInterval
): PlanPriceRow | undefined {
  return prices.find(
    (p) =>
      p.currency.toUpperCase() === currency.toUpperCase() &&
      p.interval === interval
  );
}

/**
 * Calculate annual savings percentage compared to monthly billing.
 */
export function annualSavingsPercent(
  monthlyAmount: number,
  annualAmount: number
): number {
  const monthlyTotal = monthlyAmount * 12;
  if (monthlyTotal === 0) return 0;
  return Math.round(((monthlyTotal - annualAmount) / monthlyTotal) * 100);
}
