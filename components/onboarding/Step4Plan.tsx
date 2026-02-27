"use client";

import { useState, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import type { OnboardingUpdate } from "@/lib/validation/onboarding";
import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import type { DisplayablePlan } from "@/lib/pricing";
import { fetchPlans, getDisplayablePlans } from "@/lib/pricing";
import { formatPrice } from "@/lib/billing/format";
import { PricingClient } from "@/components/pricing/PricingClient";
import { PartnerDiscountToggle } from "@/components/pricing/PartnerDiscountToggle";
import { Loader2, AlertCircle } from "lucide-react";

interface Step4Props {
  data: OnboardingUpdate;
  onChange: (patch: Partial<OnboardingUpdate>) => void;
  aiFilledFields?: string[];
}

// Discount settings
const DISCOUNT_PERCENT = 15;
const MAX_ADS_PER_WEEK = 7;

export default function Step4Plan({ data, onChange, aiFilledFields }: Step4Props) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<DisplayablePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [discountEnabled, setDiscountEnabled] = useState(data.discount_opt_in ?? false);
  
  const currency = (data.selected_currency as Currency) || "GBP";
  const interval: BillingInterval = "monthly"; // Always monthly in wizard
  const selectedPlan = data.selected_plan ?? null;

  // Load plans on mount
  useEffect(() => {
    let mounted = true;

    async function loadPlans() {
      try {
        const response = await fetchPlans();
        if (!mounted) return;

        const displayable = getDisplayablePlans(response.plans, t);
        setPlans(displayable);
      } catch (error) {
        console.error("[v0] Failed to load plans:", error);
        if (mounted) setPlans([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadPlans();
    return () => {
      mounted = false;
    };
  }, [t]);

  const handleCurrencyChange = useCallback(
    (newCurrency: Currency) => {
      onChange({ selected_currency: newCurrency });
    },
    [onChange]
  );

  const handleDiscountChange = useCallback(
    (enabled: boolean) => {
      setDiscountEnabled(enabled);
      onChange({ discount_opt_in: enabled });
    },
    [onChange]
  );

  const handleSelectPlan = useCallback(
    (planKey: string, priceId: string) => {
      onChange({
        selected_plan: planKey,
        selected_currency: currency,
        selected_interval: interval,
      });
    },
    [onChange, currency, interval]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {t("onboarding.step4.title")}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {t("onboarding.step4.subtitle")}
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {t("onboarding.step4.title")}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {t("onboarding.step4.subtitle")}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No plans available
          </h3>
          <p className="text-sm text-gray-600">
            Please contact support for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {t("onboarding.step4.title")}
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          {t("onboarding.step4.subtitle")}
        </p>
      </div>

      {/* Discount Toggle */}
      <div className="rounded-lg bg-green-50 border border-green-200 p-4">
        <PartnerDiscountToggle 
          enabled={discountEnabled}
          onChange={handleDiscountChange}
        />
      </div>

      {/* Unified Pricing Client */}
      <PricingClient
        plans={plans}
        defaultCurrency={currency}
        defaultInterval={interval}
        showCurrencyToggle={true}
        showIntervalToggle={false}
        onChoosePlan={handleSelectPlan}
        selectedPlanKey={selectedPlan || undefined}
      />
    </div>
  );
}
