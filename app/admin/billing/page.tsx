"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatPrice } from "@/lib/billing/format";
import type { PlanWithPrices } from "@/lib/billing/types";
import { fetchPlans, archiveExistingPlan, fetchSubscriptionStats } from "./actions";
import Link from "next/link";
import { Plus, Pencil, Archive, CreditCard, Users, TrendingUp, AlertTriangle, BookOpen, Copy } from "lucide-react";

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
      value: plans.filter((p) => p.is_active).length,
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
                  const gbpMonthly = plan.prices.find(
                    (p) => p.currency.toUpperCase() === "GBP" && p.interval === "monthly"
                  );
                  return (
                    <tr
                      key={plan.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">{plan.name}</td>
                      <td className="px-6 py-4 text-gray-500 font-mono text-xs">{plan.plan_key}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            plan.is_active
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {plan.is_active ? "active" : "archived"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {gbpMonthly ? formatPrice(gbpMonthly.amount_minor, "GBP") : "N/A"}
                        <span className="text-gray-400 text-xs ml-1">/ mo</span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">0d</td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/admin/billing/plans/${plan.id}`}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          {plan.is_active && (
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
      {/* i18n Translation Guide */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-bold text-gray-900">How to Add Plan Translations</h2>
        </div>
        <div className="px-6 py-5 space-y-4 text-sm text-gray-700">
          <p>
            For a plan to appear on the pricing page, it must exist in <strong>both</strong> the
            database <strong>and</strong> the language file. This is the DB + i18n gating rule.
          </p>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Step 1: Note the plan_key</h3>
            <p className="text-gray-600">
              Each plan has a <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">plan_key</code> (shown
              in the Slug column above). You need this value to create the translation entry.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Step 2: Add to language file</h3>
            <p className="text-gray-600 mb-2">
              Open <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">locales/en.json</code> and
              add an entry under <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">billing.plans</code> using the plan_key:
            </p>
            <div className="relative">
              <pre className="bg-gray-900 text-green-400 rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">
{`// Inside locales/en.json, under "billing" > "plans":

"your_plan_key": {
  "displayName": "Your Plan Name",
  "shortTagline": "A short tagline for the plan",
  "description": "A longer description of what the plan includes.",
  "bullets": [
    "Feature 1",
    "Feature 2",
    "Feature 3"
  ],
  "cta": "Get Started"
}`}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
`"your_plan_key": {
  "displayName": "Your Plan Name",
  "shortTagline": "A short tagline for the plan",
  "description": "A longer description of what the plan includes.",
  "bullets": [
    "Feature 1",
    "Feature 2",
    "Feature 3"
  ],
  "cta": "Get Started"
}`
                  );
                }}
                className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
                title="Copy template"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Step 3: Verify</h3>
            <p className="text-gray-600">
              After adding the translation, the plan will automatically appear on:
            </p>
            <ul className="list-disc list-inside text-gray-600 mt-1 space-y-1">
              <li>Public pricing page (<code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">/pricing</code>)</li>
              <li>Onboarding wizard (Step 4 - Plan Selection)</li>
              <li>Profile page plan section</li>
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-amber-800 text-xs">
              <strong>Important:</strong> If a plan exists in the database but has no translation entry,
              it will be hidden from all user-facing pages. This is by design, so you can add plans
              to the database first and only make them visible when translations are ready.
            </p>
          </div>

          {/* Current i18n status per plan */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Current Translation Status</h3>
            <div className="space-y-2">
              {plans.map((plan) => {
                const nameKey = `billing.plans.${plan.plan_key}.displayName`;
                const hasTranslation = t(nameKey) !== nameKey;
                return (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">{plan.name}</span>
                      <code className="text-xs font-mono text-gray-400">{plan.plan_key}</code>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                        hasTranslation
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          hasTranslation ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      {hasTranslation ? "Translation found" : "Missing translation"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
