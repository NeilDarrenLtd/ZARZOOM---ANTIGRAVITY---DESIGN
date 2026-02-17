"use client";

import { useI18n } from "@/lib/i18n";
import { PLAN_OPTIONS } from "@/lib/validation/onboarding";
import type { OnboardingUpdate, Plan } from "@/lib/validation/onboarding";
import { Check } from "lucide-react";

interface Step4Props {
  data: OnboardingUpdate;
  onChange: (patch: Partial<OnboardingUpdate>) => void;
}

const PLAN_PRICES: Record<Plan, { monthly: number; annual: number }> = {
  basic: { monthly: 29, annual: 290 },
  pro: { monthly: 79, annual: 790 },
  scale: { monthly: 199, annual: 1990 },
};

const PLAN_FEATURES: Record<Plan, string[]> = {
  basic: [
    "onboarding.step4.features.basic.socialProfiles",
    "onboarding.step4.features.basic.postsPerMonth",
    "onboarding.step4.features.basic.aiGeneration",
    "onboarding.step4.features.basic.scheduling",
    "onboarding.step4.features.basic.emailSupport",
  ],
  pro: [
    "onboarding.step4.features.pro.socialProfiles",
    "onboarding.step4.features.pro.postsPerMonth",
    "onboarding.step4.features.pro.aiGeneration",
    "onboarding.step4.features.pro.scheduling",
    "onboarding.step4.features.pro.analytics",
    "onboarding.step4.features.pro.prioritySupport",
  ],
  scale: [
    "onboarding.step4.features.scale.socialProfiles",
    "onboarding.step4.features.scale.postsPerMonth",
    "onboarding.step4.features.scale.aiGeneration",
    "onboarding.step4.features.scale.scheduling",
    "onboarding.step4.features.scale.analytics",
    "onboarding.step4.features.scale.customBranding",
    "onboarding.step4.features.scale.dedicatedSupport",
    "onboarding.step4.features.scale.apiAccess",
  ],
};

export default function Step4Plan({ data, onChange }: Step4Props) {
  const { t } = useI18n();

  const isAnnual = data.discount_opt_in !== false; // default ON
  const selectedPlan = data.selected_plan ?? null;

  function selectPlan(plan: Plan) {
    onChange({ selected_plan: plan });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {t("onboarding.step4.title")}
        </h2>
        <p className="text-gray-500 text-sm mt-1 leading-relaxed">
          {t("onboarding.step4.subtitle")}
        </p>
      </div>

      {/* Discount toggle */}
      <div className="flex items-center justify-center gap-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isAnnual}
            onChange={(e) => onChange({ discount_opt_in: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
        </label>
        <span className="text-sm font-medium text-gray-700">
          {t("onboarding.step4.discount.label")}
        </span>
        {isAnnual && (
          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            {t("onboarding.step4.discount.save").replace("{percent}", "17")}
          </span>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_OPTIONS.map((plan) => {
          const isSelected = selectedPlan === plan;
          const isPopular = plan === "pro";
          const price = isAnnual
            ? PLAN_PRICES[plan].annual
            : PLAN_PRICES[plan].monthly;
          const displayPrice = isAnnual
            ? Math.round(price / 12)
            : price;
          const features = PLAN_FEATURES[plan];

          return (
            <div
              key={plan}
              className={`relative flex flex-col rounded-2xl border p-6 transition-all cursor-pointer ${
                isSelected
                  ? "border-green-500 bg-white shadow-lg ring-1 ring-green-500/20"
                  : isPopular
                    ? "border-green-300 bg-white shadow-md"
                    : "border-gray-200 bg-white hover:border-green-300"
              }`}
              onClick={() => selectPlan(plan)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && selectPlan(plan)}
            >
              {/* Popular badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {t("onboarding.step4.popular")}
                  </span>
                </div>
              )}

              <h3 className="text-lg font-bold text-gray-900">
                {t(`onboarding.step4.planNames.${plan}`)}
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {t(`onboarding.step4.planDescriptions.${plan}`)}
              </p>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">
                  {t("onboarding.a11y.currency")}{displayPrice}
                </span>
                <span className="text-sm text-gray-400">
                  {t("onboarding.step4.perMonth")}
                </span>
              </div>

              <button
                type="button"
                className={`mt-4 w-full py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  isSelected
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {isSelected
                  ? t("onboarding.step4.selected")
                  : t("onboarding.step4.selectPlan")}
              </button>

              <ul className="mt-5 flex flex-col gap-2.5 flex-1">
                {features.map((fKey) => (
                  <li key={fKey} className="flex items-start gap-2">
                    <Check
                      className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        isSelected || isPopular
                          ? "text-green-600"
                          : "text-gray-400"
                      }`}
                    />
                    <span className="text-xs text-gray-600 leading-relaxed">
                      {t(fKey)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
