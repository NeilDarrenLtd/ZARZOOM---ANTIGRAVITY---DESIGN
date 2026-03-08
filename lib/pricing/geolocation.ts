import type { Currency } from "@/lib/billing/types";

/**
 * Geolocation-based currency detection
 * Uses multiple fallback strategies to determine user's preferred currency
 */

const CURRENCY_MAP: Record<string, Currency> = {
  // USD countries
  US: "USD",
  CA: "USD",
  MX: "USD",
  // GBP countries
  GB: "GBP",
  // EUR countries
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  PT: "EUR",
  IE: "EUR",
  FI: "EUR",
  GR: "EUR",
  LU: "EUR",
  SI: "EUR",
  SK: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  CY: "EUR",
  MT: "EUR",
};

/**
 * Detect currency from browser timezone
 */
function getCurrencyFromTimezone(): Currency | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // European timezones → EUR
    if (timezone.startsWith("Europe/")) {
      const euroZones = [
        "Europe/London", // UK → GBP (exception)
      ];
      if (euroZones.includes(timezone)) {
        return "GBP";
      }
      return "EUR";
    }
    
    // American timezones → USD
    if (timezone.startsWith("America/") || timezone.startsWith("US/")) {
      return "USD";
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Detect currency from browser locale
 */
function getCurrencyFromLocale(): Currency | null {
  try {
    const locale = navigator.language || navigator.languages?.[0];
    if (!locale) return null;
    
    // Extract country code from locale (e.g., "en-GB" → "GB")
    const countryCode = locale.split("-")[1]?.toUpperCase();
    if (countryCode && CURRENCY_MAP[countryCode]) {
      return CURRENCY_MAP[countryCode];
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Detect currency using Intl.NumberFormat
 */
function getCurrencyFromNumberFormat(): Currency | null {
  try {
    const formatter = new Intl.NumberFormat(navigator.language, {
      style: "currency",
      currency: "USD", // dummy
    });
    
    const parts = formatter.formatToParts(0);
    const currencyPart = parts.find((p) => p.type === "currency");
    
    if (currencyPart?.value === "£" || currencyPart?.value === "GBP") {
      return "GBP";
    }
    if (currencyPart?.value === "€" || currencyPart?.value === "EUR") {
      return "EUR";
    }
    if (currencyPart?.value === "$" || currencyPart?.value === "USD") {
      return "USD";
    }
    
    return null;
  } catch {
    return null;
  }
}

function storageKey(base: string, workspaceId?: string | null): string {
  if (workspaceId) return `workspace:${workspaceId}:${base}`;
  return base;
}

/**
 * Main geolocation detection function
 * Tries multiple strategies and returns USD as final fallback.
 * When workspaceId is provided, currency preference is read from workspace-scoped localStorage.
 */
export async function detectUserCurrency(
  availableCurrencies: Currency[],
  workspaceId?: string | null
): Promise<Currency> {
  console.log("[v0] Detecting user currency...");
  const key = storageKey("zarzoom_currency", workspaceId);

  // Strategy 1: Check localStorage first (user preference)
  try {
    const saved = localStorage.getItem(key) as Currency | null;
    if (saved && availableCurrencies.includes(saved)) {
      console.log("[v0] Using saved currency from localStorage:", saved);
      return saved;
    }
  } catch {
    // localStorage unavailable
  }
  
  // Strategy 2: Try timezone detection
  const timezoneCurrency = getCurrencyFromTimezone();
  if (timezoneCurrency && availableCurrencies.includes(timezoneCurrency)) {
    console.log("[v0] Detected currency from timezone:", timezoneCurrency);
    return timezoneCurrency;
  }
  
  // Strategy 3: Try locale detection
  const localeCurrency = getCurrencyFromLocale();
  if (localeCurrency && availableCurrencies.includes(localeCurrency)) {
    console.log("[v0] Detected currency from locale:", localeCurrency);
    return localeCurrency;
  }
  
  // Strategy 4: Try number format detection
  const formatCurrency = getCurrencyFromNumberFormat();
  if (formatCurrency && availableCurrencies.includes(formatCurrency)) {
    console.log("[v0] Detected currency from number format:", formatCurrency);
    return formatCurrency;
  }
  
  // Strategy 5: Use USD as fallback (if available)
  if (availableCurrencies.includes("USD")) {
    console.log("[v0] Using USD as fallback currency");
    return "USD";
  }
  
  // Strategy 6: Use first available currency
  const fallback = availableCurrencies[0] || "USD";
  console.log("[v0] Using first available currency as fallback:", fallback);
  return fallback;
}

/**
 * Save currency preference to localStorage.
 * When workspaceId is provided, key is workspace-scoped: workspace:${workspaceId}:zarzoom_currency
 */
export function saveCurrencyPreference(currency: Currency, workspaceId?: string | null): void {
  try {
    const key = storageKey("zarzoom_currency", workspaceId);
    localStorage.setItem(key, currency);
    console.log("[v0] Saved currency preference:", currency);
  } catch (error) {
    console.error("[v0] Failed to save currency preference:", error);
  }
}

/**
 * Save discount preference to localStorage.
 * When workspaceId is provided, key is workspace-scoped: workspace:${workspaceId}:zarzoom_discount_enabled
 */
export function saveDiscountPreference(enabled: boolean, workspaceId?: string | null): void {
  try {
    const key = storageKey("zarzoom_discount_enabled", workspaceId);
    localStorage.setItem(key, String(enabled));
    console.log("[v0] Saved discount preference:", enabled);
  } catch (error) {
    console.error("[v0] Failed to save discount preference:", error);
  }
}

/**
 * Get discount preference from localStorage.
 * When workspaceId is provided, reads from workspace-scoped key.
 */
export function getDiscountPreference(workspaceId?: string | null): boolean {
  try {
    const key = storageKey("zarzoom_discount_enabled", workspaceId);
    const saved = localStorage.getItem(key);
    return saved === "true";
  } catch {
    return false;
  }
}
