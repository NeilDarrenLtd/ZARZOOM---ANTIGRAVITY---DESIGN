"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Check, Loader2 } from "lucide-react";
import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import { fetchPlans } from "@/lib/pricing/fetchPlans";
import { getDisplayablePlans } from "@/lib/pricing/getDisplayablePlans";
import { getPriceForSelection } from "@/lib/pricing/getPriceForSelection";
import { formatPrice } from "@/lib/billing/format";
import { PartnerDiscountToggle } from "@/components/pricing/PartnerDiscountToggle";
import type { DisplayablePlan } from "@/lib/pricing";

interface ProfilePricingClientProps {
  selectedPlan: string | null;
  onPlanSelect: (planKey: string) => void;
  isAnnual: boolean;
  onAnnualToggle: (isAnnual: boolean) => void;
}

export function ProfilePricingClient({
  selectedPlan,
  onPlanSelect,
  isAnnual,
  onAnnualToggle,
}: ProfilePricingClientProps) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<DisplayablePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currency: Currency = "GBP";
  const interval: BillingInterval = isAnnual ? "annual" : "monthly";

  useEffect(() => {
    async function loadPlans() {
      try {
        if (process.env.NODE_ENV === "development") {
          console.group("[PRICING DEBUG][PROFILE]");
          console.log("[v0] Loading pricing data for profile page...");
        }

        const response = await fetchPlans();
        
        if (process.env.NODE_ENV === "development") {
          console.log("[v0] API Response:", {
            totalPlans: response.plans.length,
            planKeys: response.plans.map(p => p.planKey),
          });
        }

        const displayable = getDisplayablePlans(response.plans, t);
        
        if (process.env.NODE_ENV === "development") {
          console.log("[v0] Displayable Plans:", {
            count: displayable.length,
            keys: displayable.map(p => p.planKey),
          });
          console.log("[v0] Selected currency:", currency);
          console.log("[v0] Selected interval:", interval);
          console.log("[v0] Array checks before render:");
          displayable.forEach(plan => {
            const features = plan.displayFeatures || [];
            console.log(`[v0]   - Plan "${plan.planKey}": ${features.length} features`);
          });
          console.groupEnd();
        }

        setPlans(displayable);
        setError(null);
      } catch (err) {
        console.error("[v0] Failed to load pricing:", err);
        setError(err instanceof Error ? err.message : "Failed to load pricing");
      } finally {
        setLoading(false);
      }
    }

    loadPlans();
  }, [t, currency, interval, isAnnual]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading pricing plans...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-sm text-red-700 font-medium">Failed to load pricing</p>
          {process.env.NODE_ENV === "development" && (
            <p className="text-xs text-red-600 mt-2">{error}</p>
          )}
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="py-12">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-700 font-medium">No pricing plans available</p>
          <p className="text-xs text-gray-500 mt-1">Please contact support for assistance.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Current Plan Display */}
      {selectedPlan && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-900">
                {t("profile.plan.current")}
              </p>
              <p className="text-lg font-bold text-green-800">
                {plans.find(p => p.planKey === selectedPlan)?.displayName || selectedPlan}
              </p>
            </div>
            <div className="text-right">
              {(() => {
                const plan = plans.find(p => p.planKey === selectedPlan);
                if (!plan) return <p className="text-2xl font-bold text-green-800">—</p>;
                
                const price = getPriceForSelection(plan, currency, interval);
                if (!price) return <p className="text-2xl font-bold text-green-800">—</p>;

                // Always show monthly price
                let displayAmount = Math.round(price.amountMinor / 100);
                
                // Apply 50% discount only if enabled (isAnnual toggle is on)
                if (isAnnual) {
                  displayAmount = Math.round(displayAmount / 2);
                }

                return (
                  <>
                    <p className="text-2xl font-bold text-green-800">
                      {formatPrice(displayAmount * 100, currency)}
                    </p>
                    <p className="text-xs text-green-600">
                      {t("onboarding.step4.perMonth")}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {!selectedPlan && (
        <p className="text-sm text-gray-500 mb-5">{t("profile.plan.noPlan")}</p>
      )}

      {/* Partner Discount Toggle */}
      <div className="mb-5 rounded-lg bg-green-50 border border-green-200 p-4">
        <PartnerDiscountToggle 
          enabled={isAnnual}
          onChange={onAnnualToggle}
        />
      </div>

      {/* Plan Cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan, index) => {
          const isSelected = selectedPlan === plan.planKey;
          const isPopular = index === 1; // Middle plan is popular
          const price = getPriceForSelection(plan, currency, interval);
          
          // If no price for this currency/interval, hide the plan
          if (!price) return null;

          const displayAmount = isAnnual 
            ? Math.round(price.amountMinor / 100 / 2)
            : Math.round(price.amountMinor / 100);
          
          // Apply 50% discount only if enabled (isAnnual toggle is on)
          const finalAmount = isAnnual ? Math.round(displayAmount / 2) : displayAmount;

          const features = Array.isArray(plan.displayFeatures) ? plan.displayFeatures : [];

          return (
            <div
              key={plan.planKey}
              className={`relative flex flex-col rounded-2xl border p-5 transition-all cursor-pointer ${
                isSelected
                  ? "border-green-500 bg-white shadow-lg ring-1 ring-green-500/20"
                  : isPopular
                    ? "border-green-300 bg-white shadow-md"
                    : "border-gray-200 bg-white hover:border-green-300"
              }`}
              onClick={() => onPlanSelect(plan.planKey)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onPlanSelect(plan.planKey)}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-green-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {t("onboarding.step4.popular")}
                  </span>
                </div>
              )}

              <h3 className="text-base font-bold text-gray-900">
                {plan.displayName}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {plan.displayDescription || ""}
              </p>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900">
                  {formatPrice(finalAmount * 100, currency)}
                </span>
                <span className="text-xs text-gray-400">
                  {t("onboarding.step4.perMonth")}
                </span>
              </div>

              <button
                type="button"
                className={`mt-3 w-full py-2 rounded-lg text-xs font-bold transition-colors ${
                  isSelected
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {isSelected
                  ? t("onboarding.step4.selected")
                  : t("onboarding.step4.selectPlan")}
              </button>

              <ul className="mt-4 flex flex-col gap-2 flex-1">
                {features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check
                      className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                        isSelected || isPopular ? "text-green-600" : "text-gray-400"
                      }`}
                    />
                    <span className="text-xs text-gray-600 leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
