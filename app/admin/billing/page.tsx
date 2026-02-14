"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatPrice } from "@/lib/billing/format";
import type { PlanWithPrices } from "@/lib/billing/types";
import { fetchPlans, archiveExistingPlan, fetchSubscriptionStats } from "./actions";
import Link from "next/link";
import { Plus, Pencil, Archive, CreditCard, Users, TrendingUp, AlertTriangle } from "lucide-react";

export default function AdminBillingPage() {
  const { t } = useI18n();
  const [plans, setPlans] = useState<PlanWithPrices[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [plansResult, statsResult] = await Promise.all([
      fetchPlans(),
      fetchSubscriptionStats(),
    ]);
    if (plansResult.error) setError(plansResult.error);
    setPlans(plansResult.plans);
    setStats(statsResult.stats);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleArchive(id: string, name: string) {
    if (!confirm(`Archive plan "${name}"? It will no longer be available to new subscribers.`)) return;
    const result = await archiveExistingPlan(id);
    if (result.error) {
      setError(result.error);
    } else {
      loadData();
    }
  }

  const totalSubs = Object.values(stats).reduce((a, b) => a + b, 0);

  const statCards = [
    {
      label: t("billing.admin.totalSubscriptions"),
      value: totalSubs,
      icon: Users,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: t("billing.admin.activeSubs"),
      value: (stats.active ?? 0) + (stats.trialing ?? 0),
      icon: TrendingUp,
      color: "bg-green-50 text-green-600",
    },
    {
      label: t("billing.admin.pastDueSubs"),
      value: stats.past_due ?? 0,
      icon: AlertTriangle,
      color: "bg-amber-50 text-amber-600",
    },
    {
      label: t("billing.admin.totalPlans"),
      value: plans.filter((p) => p.status === "active").length,
      icon: CreditCard,
      color: "bg-indigo-50 text-indigo-600",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-sm text-gray-400">Loading billing data...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("billing.admin.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("billing.admin.subtitle")}</p>
        </div>
        <Link
          href="/admin/billing/plans/new"
          className="inline-flex items-center gap-2 bg-green-600 text-white font-bold py-2.5 px-5 rounded-lg hover:bg-green-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          {t("billing.admin.newPlan")}
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white border border-gray-200 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color}`}
              >
                <card.icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium text-gray-500">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Plans Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">{t("billing.admin.plansTitle")}</h2>
        </div>

        {plans.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No plans yet. Create your first plan to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-6 py-3 font-medium text-gray-500">{t("billing.admin.planName")}</th>
                  <th className="px-6 py-3 font-medium text-gray-500">{t("billing.admin.planSlug")}</th>
                  <th className="px-6 py-3 font-medium text-gray-500">{t("billing.admin.planStatus")}</th>
                  <th className="px-6 py-3 font-medium text-gray-500">{t("billing.admin.planPriceGBP")}</th>
                  <th className="px-6 py-3 font-medium text-gray-500">{t("billing.admin.planTrialDays")}</th>
                  <th className="px-6 py-3 font-medium text-gray-500 text-right">{t("billing.admin.planActions")}</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => {
                  const gbpMonthly = plan.plan_prices.find(
                    (p) => p.currency.toUpperCase() === "GBP" && p.interval === "monthly"
                  );
                  return (
                    <tr
                      key={plan.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">{plan.name}</td>
                      <td className="px-6 py-4 text-gray-500 font-mono text-xs">{plan.slug}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            plan.status === "active"
                              ? "bg-green-50 text-green-700"
                              : plan.status === "draft"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {plan.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {gbpMonthly ? formatPrice(gbpMonthly.unit_amount, "GBP") : "N/A"}
                        <span className="text-gray-400 text-xs ml-1">/ mo</span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{plan.trial_days}d</td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/admin/billing/plans/${plan.id}`}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          {plan.status !== "archived" && (
                            <button
                              onClick={() => handleArchive(plan.id, plan.name)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Archive"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
