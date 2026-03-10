"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useWorkspaceFetch, useActiveWorkspace } from "@/lib/workspace/context";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import {
  CreditCard,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";

interface SubscriptionInfo {
  status: string;
  planName: string | null;
  planKey?: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  currency: string | null;
  billingInterval: "month" | "year" | null;
  amountMinor: number | null;
}

interface WorkspaceSummary {
  id: string;
  name: string;
}

export default function BillingPage() {
  const { t } = useI18n();
  const workspaceFetch = useWorkspaceFetch();
  const activeWorkspaceId = useActiveWorkspace();

  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);

  // Load subscription + workspace summary for the active workspace
  useEffect(() => {
    if (!activeWorkspaceId) {
      setLoading(false);
      setSub(null);
      setWorkspace(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const [statusRes, workspacesRes] = await Promise.allSettled([
          workspaceFetch("/api/v1/billing/status"),
          workspaceFetch("/api/v1/workspaces"),
        ]);

        if (!mounted) return;

        if (statusRes.status === "fulfilled" && statusRes.value.ok) {
          const data = await statusRes.value.json();
          setSub(data);
        } else {
          setSub(null);
        }

        if (workspacesRes.status === "fulfilled" && workspacesRes.value.ok) {
          const body = await workspacesRes.value.json();
          const list: WorkspaceSummary[] = (body.workspaces ?? []).map(
            (w: { id: string; name?: string }) => ({
              id: w.id,
              name: w.name ?? "Workspace",
            })
          );
          const current = list.find((w) => w.id === activeWorkspaceId) ?? null;
          setWorkspace(current);
        } else {
          setWorkspace(null);
        }
      } catch {
        if (!mounted) return;
        setSub(null);
        setWorkspace(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeWorkspaceId, workspaceFetch]);

  const handleManageBilling = useCallback(async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await workspaceFetch("/api/v1/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
      setPortalError(t("billing.errors.portalOpenFailed"));
    } catch {
      setPortalError(t("billing.errors.generic"));
    } finally {
      setPortalLoading(false);
    }
  }, [workspaceFetch, t]);

  const status = sub?.status || "none";

  const statusConfig = useMemo(
    () =>
      ({
        active: {
          chipBg: "bg-green-100 text-green-700",
          iconBg: "bg-green-100",
          iconColor: "text-green-600",
          icon: CheckCircle,
          labelKey: "billing.status.active",
        },
        trialing: {
          chipBg: "bg-blue-100 text-blue-700",
          iconBg: "bg-blue-100",
          iconColor: "text-blue-600",
          icon: CheckCircle,
          labelKey: "billing.status.trialing",
        },
        past_due: {
          chipBg: "bg-amber-100 text-amber-700",
          iconBg: "bg-amber-100",
          iconColor: "text-amber-600",
          icon: AlertCircle,
          labelKey: "billing.status.pastDue",
        },
        canceled: {
          chipBg: "bg-red-100 text-red-700",
          iconBg: "bg-red-100",
          iconColor: "text-red-600",
          icon: AlertCircle,
          labelKey: "billing.status.canceled",
        },
        incomplete: {
          chipBg: "bg-amber-100 text-amber-700",
          iconBg: "bg-amber-100",
          iconColor: "text-amber-600",
          icon: AlertCircle,
          labelKey: "billing.status.incomplete",
        },
        none: {
          chipBg: "bg-gray-100 text-gray-700",
          iconBg: "bg-gray-100",
          iconColor: "text-gray-500",
          icon: AlertCircle,
          labelKey: "billing.status.none",
        },
      }) as const,
    []
  );

  const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.none;
  const StatusIcon = config.icon;

  const hasActiveSubscription = ["active", "trialing", "past_due"].includes(status);

  const formattedNextBilling = useMemo(() => {
    if (!sub?.currentPeriodEnd) return null;
    try {
      const date = new Date(sub.currentPeriodEnd);
      return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return null;
    }
  }, [sub?.currentPeriodEnd]);

  const formattedPrice = useMemo(() => {
    if (!sub?.currency || sub.amountMinor == null) return null;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: sub.currency,
      }).format(sub.amountMinor / 100);
    } catch {
      return null;
    }
  }, [sub?.currency, sub?.amountMinor]);

  const billingIntervalLabel =
    sub?.billingInterval === "year"
      ? t("billing.currentPlan.interval.annual")
      : sub?.billingInterval === "month"
        ? t("billing.currentPlan.interval.monthly")
        : t("billing.currentPlan.interval.unknown");

  const planDisplayName =
    sub?.planName || t("billing.currentPlan.freePlan");

  const currentPlanKey = sub?.planKey ?? undefined;

  const renderPlanFeatureList = () => {
    if (!currentPlanKey) return null;
    if (!["basic", "pro", "advanced", "scale"].includes(currentPlanKey)) return null;

    const featureBase = `billing.features.${currentPlanKey}`;

    return (
      <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
        <li>• {t(`${featureBase}.socialProfiles`)}</li>
        <li>• {t(`${featureBase}.postsPerMonth`)}</li>
        {currentPlanKey === "basic" && <li>• {t(`${featureBase}.emailSupport`)}</li>}
        {currentPlanKey !== "basic" && (
          <li>• {t(`${featureBase}.analytics`, t("billing.currentPlan.defaultFeatureAnalytics"))}</li>
        )}
      </ul>
    );
  };

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <SiteNavbar />

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("billing.page.backToDashboard")}
          </Link>
        </div>

        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t("billing.page.title")}
              </h1>
              <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                {t("billing.page.subtitle")}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" aria-label={t("billing.loading")} />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Subscription status messaging */}
            {!hasActiveSubscription && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-4 h-4 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      {t("billing.statusBanner.noSubscription.title")}
                    </p>
                    <p className="text-xs text-amber-800 mt-0.5">
                      {t("billing.statusBanner.noSubscription.body")}
                    </p>
                  </div>
                </div>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
                >
                  {t("billing.actions.viewPlans")}
                </Link>
              </div>
            )}

            {/* Billing overview + current plan */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Overview card */}
              <section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">
                  {t("billing.overview.title")}
                </h2>

                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div>
                    <dt className="text-gray-500">{t("billing.overview.workspace")}</dt>
                    <dd className="font-medium text-gray-900">
                      {workspace?.name ?? t("billing.overview.unknownWorkspace")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">{t("billing.overview.currentPlan")}</dt>
                    <dd className="font-medium text-gray-900">
                      {planDisplayName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">{t("billing.overview.status")}</dt>
                    <dd className="mt-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.chipBg}`}
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                        {t(config.labelKey)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">{t("billing.overview.billingCycle")}</dt>
                    <dd className="font-medium text-gray-900">
                      {billingIntervalLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">{t("billing.overview.nextBillingDate")}</dt>
                    <dd className="font-medium text-gray-900">
                      {formattedNextBilling ??
                        t("billing.overview.nextBillingDateUnknown")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">
                      {t("billing.overview.pricePerPeriod")}
                    </dt>
                    <dd className="font-medium text-gray-900">
                      {formattedPrice
                        ? `${formattedPrice}${
                            sub?.billingInterval === "year"
                              ? ` / ${t("billing.currentPlan.interval.annualShort")}`
                              : sub?.billingInterval === "month"
                                ? ` / ${t("billing.currentPlan.interval.monthlyShort")}`
                                : ""
                          }`
                        : t("billing.overview.priceUnknown")}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Current plan card */}
              <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">
                  {t("billing.currentPlan.title")}
                </h2>
                <p className="text-xs text-gray-500 mb-4">
                  {t("billing.currentPlan.subtitle")}
                </p>

                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${config.iconBg}`}>
                    <StatusIcon className={`w-5 h-5 ${config.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {planDisplayName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formattedPrice
                        ? t("billing.currentPlan.priceWithInterval", {
                            price: formattedPrice,
                            interval: billingIntervalLabel,
                          })
                        : t("billing.currentPlan.priceUnknown")}
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                    {t("billing.currentPlan.featuresTitle")}
                  </p>
                  {renderPlanFeatureList() || (
                    <p className="text-xs text-gray-500">
                      {t("billing.currentPlan.featuresPlaceholder")}
                    </p>
                  )}
                </div>
              </section>
            </div>

            {/* Billing actions */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">
                {t("billing.actions.title")}
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                {t("billing.actions.subtitle")}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/dashboard/profile"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition-colors"
                >
                  <CreditCard className="w-4 h-4" />
                  {t("billing.actions.changePlan")}
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t("billing.actions.viewPlans")}
                </Link>
                {hasActiveSubscription && (
                  <button
                    type="button"
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-800 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {portalLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    {t("billing.actions.manageSubscription")}
                  </button>
                )}
              </div>

              {portalError && (
                <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {portalError}
                </p>
              )}
            </section>

            {/* Billing history placeholder */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    {t("billing.history.title")}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {t("billing.history.subtitle")}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-6 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-gray-700">
                  {t("billing.history.emptyTitle")}
                </p>
                <p className="mt-1 text-xs text-gray-500 max-w-sm">
                  {t("billing.history.emptyBody")}
                </p>
              </div>
            </section>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
