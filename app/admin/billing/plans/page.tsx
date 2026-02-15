"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Plus,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Star,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanWithPrices, Currency } from "@/lib/billing/types";
import { formatPrice } from "@/lib/billing/format";

/* ------------------------------------------------------------------ */
/*  Fetcher                                                            */
/* ------------------------------------------------------------------ */

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminBillingPlansPage() {
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");

  const apiUrl =
    statusFilter === "all"
      ? "/api/v1/admin/billing/plans"
      : `/api/v1/admin/billing/plans?status=${statusFilter}`;

  const { data, error, isLoading } = useSWR<{ plans: PlanWithPrices[] }>(
    apiUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  const plans = data?.plans ?? [];

  const getActivePriceDisplay = useCallback(
    (plan: PlanWithPrices, currency: Currency = "GBP") => {
      const monthly = plan.plan_prices.find(
        (p) => p.currency === currency && p.interval === "monthly" && p.is_active
      );
      if (monthly) return `${formatPrice(monthly.unit_amount, currency)}/mo`;

      const annual = plan.plan_prices.find(
        (p) => p.currency === currency && p.interval === "annual" && p.is_active
      );
      if (annual) return `${formatPrice(annual.unit_amount, currency)}/yr`;

      return "No price set";
    },
    []
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Billing Plans
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage subscription plans, pricing, and quota policies.
          </p>
        </div>
        <Link
          href="/admin/billing/plans/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          New Plan
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="mt-6 flex gap-1 rounded-lg bg-zinc-100 p-1">
        {(["all", "active", "archived"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatusFilter(tab)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors",
              statusFilter === tab
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="mt-12 flex items-center justify-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading plans...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load plans. Please try again.
        </div>
      )}

      {/* Plans table */}
      {!isLoading && !error && (
        <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {plans.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-zinc-500">
              No plans found. Create one to get started.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Price (GBP)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Order
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Prices
                  </th>
                  <th className="px-4 py-3" aria-label="Actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {plans.map((plan) => (
                  <tr
                    key={plan.id}
                    className="transition-colors hover:bg-zinc-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-zinc-900">
                              {plan.name}
                            </span>
                            {plan.highlight && (
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            )}
                          </div>
                          <span className="font-mono text-xs text-zinc-400">
                            {plan.slug}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {plan.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                          <XCircle className="h-3 w-3" />
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-700">
                      {getActivePriceDisplay(plan)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {plan.display_order}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {plan.plan_prices.filter((p) => p.is_active).length} active
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/billing/plans/${plan.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                      >
                        Edit
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
