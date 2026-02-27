"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Check, X, Globe, AlertTriangle, Edit, DollarSign } from "lucide-react";
import { formatPrice } from "@/lib/billing/format";
import { fetchPlans } from "../billing/actions";

interface PlanWithI18n {
  id: string;
  plan_key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  quota_policy: Record<string, any>;
  features: string[];
  hasI18nCopy?: boolean;
  prices: Array<{
    id: string;
    currency: string;
    interval: string;
    amount_minor: number;
    is_active: boolean;
  }>;
}

export default function AdminBillingV2Page() {
  const [plans, setPlans] = useState<PlanWithI18n[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPlans() {
    setLoading(true);
    const result = await fetchPlans();
    if (result.error) {
      setError(result.error);
    } else {
      setPlans(result.plans as PlanWithI18n[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadPlans();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-sm text-gray-400">
          Loading billing data...
        </div>
      </div>
    );
  }

  const activePlans = plans.filter((p) => p.is_active);
  const inactivePlans = plans.filter((p) => !p.is_active);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pricing Plans</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage subscription plans, pricing, and discounts
          </p>
        </div>
        <Link
          href="/admin/billing-v2/plans/new"
          className="inline-flex items-center gap-2 bg-green-600 text-white font-semibold py-3 px-5 rounded-lg hover:bg-green-700 transition-colors text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Plan
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">
              Active Plans
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{activePlans.length}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <X className="w-5 h-5 text-gray-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">
              Inactive Plans
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {inactivePlans.length}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">
              Total Currencies
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {
              new Set(
                plans.flatMap((p) => p.prices.map((pr) => pr.currency))
              ).size
            }
          </p>
        </div>
      </div>

      {/* Plans List */}
      <div className="space-y-4">
        {plans.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <p className="text-gray-500 mb-4">No plans created yet</p>
            <Link
              href="/admin/billing-v2/plans/new"
              className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              Create your first plan
            </Link>
          </div>
        ) : (
          plans.map((plan) => {
            const discountPercent =
              plan.quota_policy?.advertising_discount_percent;
            const maxAdsPerWeek = plan.quota_policy?.max_ads_per_week;

            // Group prices by currency
            const pricesByCurrency = plan.prices.reduce((acc, price) => {
              if (!acc[price.currency]) acc[price.currency] = [];
              acc[price.currency].push(price);
              return acc;
            }, {} as Record<string, typeof plan.prices>);

            return (
              <div
                key={plan.id}
                className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">
                        {plan.name}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          plan.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {plan.is_active ? (
                          <>
                            <Check className="w-3 h-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3" />
                            Inactive
                          </>
                        )}
                      </span>
                      {!plan.hasI18nCopy && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          <AlertTriangle className="w-3 h-3" />
                          No i18n copy
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-gray-500 mb-1">
                      plan_key: {plan.plan_key}
                    </p>
                    {plan.description && (
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {plan.description}
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/admin/billing-v2/plans/${plan.id}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-green-600 px-3 py-2 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </Link>
                </div>

                {/* Discount Info */}
                {discountPercent && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="font-semibold text-green-900">
                        {discountPercent}% advertising discount
                      </span>
                      <span className="text-green-700">
                        (max {maxAdsPerWeek || 7} ads/week)
                      </span>
                    </div>
                  </div>
                )}

                {/* Prices by Currency */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(pricesByCurrency).map(([currency, prices]) => (
                    <div
                      key={currency}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                    >
                      <p className="text-xs font-semibold text-gray-500 mb-2">
                        {currency}
                      </p>
                      <div className="space-y-1">
                        {prices
                          .filter((p) => p.is_active)
                          .map((price) => (
                            <div
                              key={price.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-gray-600 capitalize">
                                {price.interval}
                              </span>
                              <span className="font-semibold text-gray-900">
                                {formatPrice(price.amount_minor, currency as any)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Warning for missing i18n */}
                {!plan.hasI18nCopy && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-800 leading-relaxed">
                      <AlertTriangle className="w-4 h-4 inline mr-1" />
                      This plan will not be visible to users until i18n copy is
                      added to{" "}
                      <code className="bg-amber-100 px-1 rounded">
                        plans.{plan.plan_key}.*
                      </code>{" "}
                      in locale files.
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
