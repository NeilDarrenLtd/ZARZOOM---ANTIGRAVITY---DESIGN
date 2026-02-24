"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { GetPlansResponse, Currency, BillingInterval } from "@/lib/billing/api-types";
import type { DisplayablePlan } from "@/lib/pricing";

interface PricingDiagnosticsProps {
  plans?: DisplayablePlan[];
  currency?: Currency;
  interval?: BillingInterval;
  selectedPlanKey?: string;
}

interface DiagnosticData {
  route: string;
  locale: string;
  fetchStatus: {
    status: number | null;
    responseTime: number | null;
    rawResponse: string;
    error: string | null;
  };
  parsedPlans: {
    totalPlansFromApi: number;
    currenciesDetected: string[];
    intervalsDetected: string[];
  };
  gating: {
    displayablePlansCount: number;
    hiddenPlansCount: number;
    hiddenPlans: Array<{ planKey: string; reason: string }>;
  };
  priceSelection: {
    selectedCurrency: string;
    selectedInterval: string;
    planPrices: Array<{
      planKey: string;
      priceFound: boolean;
      availableCurrencies: string[];
      availableIntervals: string[];
    }>;
  };
  runtimeErrors: string[];
}

export function PricingDiagnostics({
  plans = [],
  currency = "GBP",
  interval = "monthly",
  selectedPlanKey,
}: PricingDiagnosticsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debugParam = searchParams?.get("debugPricing");

  const [isVisible, setIsVisible] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null);

  useEffect(() => {
    // Only show when explicitly requested with ?debugPricing=1 query param
    const shouldShow = debugParam === "1";
    setIsVisible(shouldShow);

    if (!shouldShow) return;

    // Fetch diagnostics data
    const fetchDiagnostics = async () => {
      const startTime = performance.now();
      let fetchStatus = {
        status: null as number | null,
        responseTime: null as number | null,
        rawResponse: "",
        error: null as string | null,
      };
      let apiPlans: GetPlansResponse = { plans: [] };

      try {
        const response = await fetch("/api/v1/billing/plans");
        const endTime = performance.now();
        fetchStatus.status = response.status;
        fetchStatus.responseTime = endTime - startTime;

        if (response.ok) {
          const data = await response.json();
          apiPlans = data;
          const rawJson = JSON.stringify(data, null, 2);
          fetchStatus.rawResponse = rawJson.slice(0, 500);
          if (rawJson.length > 500) {
            fetchStatus.rawResponse += "... (truncated)";
          }
        } else {
          fetchStatus.error = `HTTP ${response.status}: ${response.statusText}`;
        }
      } catch (error) {
        fetchStatus.error =
          error instanceof Error ? error.message : String(error);
      }

      // Parse currencies and intervals from API data
      const currencies = new Set<string>();
      const intervals = new Set<string>();
      apiPlans.plans.forEach((plan) => {
        plan.prices.forEach((price) => {
          currencies.add(price.currency);
          intervals.add(price.interval);
        });
      });

      // Determine hidden plans
      const displayableKeys = new Set(plans.map((p) => p.planKey));
      const hiddenPlans = apiPlans.plans
        .filter((p) => !displayableKeys.has(p.planKey))
        .map((p) => {
          let reason = "unknown";
          const hasActivePrices = p.prices.some((price) => price.isActive);
          if (!hasActivePrices) {
            reason = "no active prices";
          } else {
            reason = "missing i18n keys";
          }
          return { planKey: p.planKey, reason };
        });

      // Price selection details
      const planPrices = plans.map((plan) => {
        const availableCurrencies = [
          ...new Set(plan.prices.map((p) => p.currency)),
        ];
        const availableIntervals = [
          ...new Set(plan.prices.map((p) => p.interval)),
        ];
        const priceFound = plan.prices.some(
          (p) =>
            p.currency === currency &&
            p.interval === interval &&
            p.isActive
        );

        return {
          planKey: plan.planKey,
          priceFound,
          availableCurrencies,
          availableIntervals,
        };
      });

      const data: DiagnosticData = {
        route: pathname || "unknown",
        locale: "en", // TODO: Get from i18n context
        fetchStatus,
        parsedPlans: {
          totalPlansFromApi: apiPlans.plans.length,
          currenciesDetected: Array.from(currencies),
          intervalsDetected: Array.from(intervals),
        },
        gating: {
          displayablePlansCount: plans.length,
          hiddenPlansCount: hiddenPlans.length,
          hiddenPlans,
        },
        priceSelection: {
          selectedCurrency: currency,
          selectedInterval: interval,
          planPrices,
        },
        runtimeErrors: [],
      };

      setDiagnostics(data);

      // Console logging
      console.group("[PRICING DEBUG]");
      console.log("Route:", data.route);
      console.log("Locale:", data.locale);
      console.log("Fetch Status:", data.fetchStatus);
      console.log("Parsed Plans:", data.parsedPlans);
      console.log("Gating:", data.gating);
      console.log("Price Selection:", data.priceSelection);
      console.groupEnd();
    };

    fetchDiagnostics();
  }, [pathname, debugParam, plans, currency, interval, selectedPlanKey]);

  if (!isVisible || !diagnostics) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh] overflow-auto rounded-lg border border-red-500 bg-zinc-900 text-white shadow-2xl"
      style={{ fontFamily: "monospace", fontSize: "11px" }}
    >
      <div className="sticky top-0 flex items-center justify-between border-b border-red-500 bg-red-600 px-3 py-2">
        <span className="font-bold">PRICING DIAGNOSTICS</span>
        <div className="flex gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-xs hover:underline"
          >
            {isCollapsed ? "Expand" : "Collapse"}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="text-xs hover:underline"
          >
            Close
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-3 space-y-3">
          {/* Route & Locale */}
          <div>
            <div className="font-bold text-yellow-400">1. ROUTE & LOCALE</div>
            <div>Route: {diagnostics.route}</div>
            <div>Locale: {diagnostics.locale}</div>
          </div>

          {/* Fetch Status */}
          <div>
            <div className="font-bold text-yellow-400">
              2. /api/plans FETCH STATUS
            </div>
            <div>
              HTTP Status:{" "}
              <span
                className={
                  diagnostics.fetchStatus.status === 200
                    ? "text-green-400"
                    : "text-red-400"
                }
              >
                {diagnostics.fetchStatus.status || "ERROR"}
              </span>
            </div>
            <div>
              Response Time:{" "}
              {diagnostics.fetchStatus.responseTime?.toFixed(2)}ms
            </div>
            {diagnostics.fetchStatus.error && (
              <div className="text-red-400">
                Error: {diagnostics.fetchStatus.error}
              </div>
            )}
            <div className="mt-1 max-h-24 overflow-auto rounded bg-zinc-800 p-2 text-xs">
              <pre>{diagnostics.fetchStatus.rawResponse}</pre>
            </div>
          </div>

          {/* Parsed Plans Summary */}
          <div>
            <div className="font-bold text-yellow-400">
              3. PARSED PLANS SUMMARY
            </div>
            <div>
              Total Plans from API:{" "}
              {diagnostics.parsedPlans.totalPlansFromApi}
            </div>
            <div>
              Currencies Detected:{" "}
              {diagnostics.parsedPlans.currenciesDetected.join(", ")}
            </div>
            <div>
              Intervals Detected:{" "}
              {diagnostics.parsedPlans.intervalsDetected.join(", ")}
            </div>
          </div>

          {/* Gating Summary */}
          <div>
            <div className="font-bold text-yellow-400">4. GATING SUMMARY</div>
            <div className="text-green-400">
              Displayable Plans: {diagnostics.gating.displayablePlansCount}
            </div>
            <div className="text-red-400">
              Hidden Plans: {diagnostics.gating.hiddenPlansCount}
            </div>
            {diagnostics.gating.hiddenPlans.length > 0 && (
              <div className="mt-1 space-y-1">
                {diagnostics.gating.hiddenPlans.map((hp) => (
                  <div key={hp.planKey} className="text-xs text-orange-400">
                    - {hp.planKey}: {hp.reason}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Price Selection */}
          <div>
            <div className="font-bold text-yellow-400">5. PRICE SELECTION</div>
            <div>Selected Currency: {diagnostics.priceSelection.selectedCurrency}</div>
            <div>Selected Interval: {diagnostics.priceSelection.selectedInterval}</div>
            <div className="mt-1 space-y-1">
              {diagnostics.priceSelection.planPrices.map((pp) => (
                <div key={pp.planKey} className="text-xs">
                  <span className="font-semibold">{pp.planKey}:</span>{" "}
                  <span
                    className={
                      pp.priceFound ? "text-green-400" : "text-red-400"
                    }
                  >
                    {pp.priceFound ? "PRICE FOUND" : "NO PRICE"}
                  </span>
                  {!pp.priceFound && (
                    <div className="ml-4 text-zinc-400">
                      Available: {pp.availableCurrencies.join(", ")} /{" "}
                      {pp.availableIntervals.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Runtime Errors */}
          {diagnostics.runtimeErrors.length > 0 && (
            <div>
              <div className="font-bold text-red-400">6. RUNTIME ERRORS</div>
              {diagnostics.runtimeErrors.map((err, i) => (
                <pre key={i} className="text-xs text-red-300 whitespace-pre-wrap">
                  {err}
                </pre>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
