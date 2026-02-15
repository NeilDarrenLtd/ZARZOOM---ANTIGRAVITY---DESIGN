"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  formatPrice,
  formatInterval,
  findPrice,
  annualSavingsPercent,
} from "@/lib/billing/format";
import type {
  PlanWithPrices,
  Currency,
  BillingInterval,
} from "@/lib/billing/types";
import { CURRENCIES } from "@/lib/billing/types";
import { Check } from "lucide-react";
import Link from "next/link";

const CURRENCY_LABELS: Record<Currency, string> = {
  GBP: "\u00A3 GBP",
  USD: "$ USD",
  EUR: "\u20AC EUR",
};

// Feature lists per plan slug (static for now; could come from feature_flags later)
const PLAN_FEATURES: Record<string, string[]> = {
  basic: [
    "billing.features.basic.socialProfiles",
    "billing.features.basic.postsPerMonth",
    "billing.features.basic.aiGeneration",
    "billing.features.basic.scheduling",
    "billing.features.basic.emailSupport",
  ],
  pro: [
    "billing.features.pro.socialProfiles",
    "billing.features.pro.postsPerMonth",
    "billing.features.pro.aiGeneration",
    "billing.features.pro.scheduling",
    "billing.features.pro.analytics",
    "billing.features.pro.prioritySupport",
  ],
  advanced: [
    "billing.features.advanced.socialProfiles",
    "billing.features.advanced.postsPerMonth",
    "billing.features.advanced.aiGeneration",
    "billing.features.advanced.scheduling",
    "billing.features.advanced.analytics",
    "billing.features.advanced.customBranding",
    "billing.features.advanced.dedicatedSupport",
    "billing.features.advanced.apiAccess",
  ],
};

export default function PricingSection({
  plans,
}: {
  plans: PlanWithPrices[];
}) {
  const { t } = useI18n();
  const [currency, setCurrency] = useState<Currency>("GBP");
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  // Determine which plan to highlight (middle plan or "pro")
  const highlightSlug = plans.length === 3 ? plans[1].slug : "pro";

  return (
    <section id="pricing" className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl text-balance">
            {t("billing.pricing.title")}
          </h2>
          <p className="mt-3 text-gray-500 text-base max-w-xl mx-auto leading-relaxed text-pretty">
            {t("billing.pricing.subtitle")}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          {/* Interval Toggle */}
          <div className="bg-gray-100 rounded-full p-1 flex">
            <button
              onClick={() => setInterval("monthly")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                interval === "monthly"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t("billing.pricing.monthly")}
            </button>
            <button
              onClick={() => setInterval("annual")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                interval === "annual"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t("billing.pricing.annual")}
            </button>
          </div>

          {/* Currency Selector */}
          <div className="bg-gray-100 rounded-full p-1 flex">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  currency === c
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {CURRENCY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const isHighlight = plan.slug === highlightSlug;
            const price = findPrice(plan.plan_prices, currency, interval);
            const monthlyPrice = findPrice(plan.plan_prices, currency, "monthly");
            const annualPrice = findPrice(plan.plan_prices, currency, "annual");
            const savings =
              monthlyPrice && annualPrice
                ? annualSavingsPercent(monthlyPrice.unit_amount, annualPrice.unit_amount)
                : 0;

            const features = PLAN_FEATURES[plan.slug] ?? [];

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-8 flex flex-col ${
                  isHighlight
                    ? "border-green-500 bg-white shadow-lg ring-1 ring-green-500/20"
                    : "border-gray-200 bg-white"
                }`}
              >
                {/* Badge */}
                {isHighlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-green-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                      {t("billing.pricing.popular")}
                    </span>
                  </div>
                )}

                {/* Plan Name */}
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                {plan.description && (
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                    {plan.description}
                  </p>
                )}

                {/* Price */}
                <div className="mt-6 mb-1">
                  {price ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-gray-900">
                        {formatPrice(price.unit_amount, currency)}
                      </span>
                      <span className="text-sm text-gray-400">
                        {formatInterval(interval)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-2xl font-bold text-gray-400">--</span>
                  )}
                </div>

                {/* Savings Badge */}
                {interval === "annual" && savings > 0 && (
                  <p className="text-xs font-medium text-green-600 mb-4">
                    {t("billing.pricing.savePercent").replace("{percent}", String(savings))}
                  </p>
                )}
                {interval !== "annual" && <div className="mb-4" />}

                {/* Trial */}
                {plan.trial_days && plan.trial_days > 0 && (
                  <p className="text-xs text-gray-400 mb-4">
                    {t("billing.pricing.trialDays").replace("{days}", String(plan.trial_days))}
                  </p>
                )}

                {/* CTA */}
                <Link
                  href="/auth"
                  className={`w-full py-3 rounded-lg text-sm font-bold text-center transition-colors ${
                    isHighlight
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
                >
                  {t("billing.pricing.getStarted")}
                </Link>

                {/* Features */}
                <ul className="mt-8 flex flex-col gap-3 flex-1">
                  {features.map((featureKey) => (
                    <li key={featureKey} className="flex items-start gap-2.5">
                      <Check
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          isHighlight ? "text-green-600" : "text-gray-400"
                        }`}
                      />
                      <span className="text-sm text-gray-600 leading-relaxed">
                        {t(featureKey)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
