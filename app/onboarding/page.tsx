"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { ACTIVE_WORKSPACE_COOKIE, getActiveWorkspaceIdFromCookie } from "@/lib/workspace/active";
import type { OnboardingUpdate } from "@/lib/validation/onboarding";

/**
 * Build headers for onboarding API calls.
 * Accepts an explicit workspaceId override so callers don't rely on the cookie
 * (which may not be set yet during the initial load after workspace creation).
 */
function onboardingHeaders(extra?: HeadersInit, explicitWorkspaceId?: string | null): HeadersInit {
  const tenantId = explicitWorkspaceId ?? (typeof document !== "undefined" ? getActiveWorkspaceIdFromCookie() : null);
  return {
    ...(typeof extra === "object" && extra !== null ? extra : {}),
    ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
  } as HeadersInit;
}

import Stepper from "@/components/onboarding/Stepper";
import Step1Account from "@/components/onboarding/Step1Account";
import Step2Brand from "@/components/onboarding/Step2Brand";
import Step3Goals from "@/components/onboarding/Step3Goals";
import Step4Plan from "@/components/onboarding/Step4Plan";
import Step5Connect from "@/components/onboarding/Step5Connect";

import { ArrowLeft, ArrowRight, Rocket, LogOut, Loader2, CheckCircle, X } from "lucide-react";
import { useUploadPostSuccess } from "@/hooks/use-upload-post-success";
import UploadPostSuccessBanner from "@/components/ui/UploadPostSuccessBanner";

const TOTAL_STEPS = 5;

export default function OnboardingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const showSuccessBanner = useUploadPostSuccess();
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<OnboardingUpdate>({
    content_language: "en",
    article_styles: ["let_zarzoom_decide"],
    discount_opt_in: true,
    approval_preference: "auto",
  });
  const [aiFilledFields, setAiFilledFields] = useState<string[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);

  const resolvedWorkspaceRef = useRef<string | null>(null);

  // Load user + existing onboarding data
  useEffect(() => {
    // Redirect to pricing to resume pending checkout from pre-auth plan selection
    const pending = sessionStorage.getItem("pendingCheckout");
    if (pending) {
      window.location.href = "/pricing?resumeCheckout=1";
      return;
    }

    let cancelled = false;

    async function load() {
      const workspaceFromUrl = searchParams.get("workspace")?.trim() || null;
      const stepFromUrl = searchParams.get("step");
      const checkoutResult = searchParams.get("checkout");
      const workspaceId = workspaceFromUrl ?? getActiveWorkspaceIdFromCookie();

      if (workspaceId && typeof document !== "undefined") {
        document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${encodeURIComponent(workspaceId)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      }
      resolvedWorkspaceRef.current = workspaceId;

      if (checkoutResult === "success") {
        setShowCheckoutSuccess(true);
      }

      const hasUrlOverrides = workspaceFromUrl || stepFromUrl || checkoutResult;
      if (hasUrlOverrides) {
        router.replace("/onboarding", { scroll: false });
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }
      if (cancelled) return;

      setUserEmail(user.email ?? "");

      try {
        // Use explicit workspaceId so we never accidentally load the old workspace's profile
        const res = await fetch("/api/v1/onboarding", {
          headers: onboardingHeaders(undefined, workspaceId),
        });
        if (cancelled) return;
        if (res.ok) {
          const body = await res.json();
          const profile = body.data;

          if (profile) {
            if (profile.onboarding_status === "completed") {
              router.push("/dashboard");
              return;
            }

            const merged: OnboardingUpdate = { ...data };

            if (profile.business_name) merged.business_name = profile.business_name;
            if (profile.business_description) merged.business_description = profile.business_description;
            if (profile.website_url) merged.website_url = profile.website_url;
            if (profile.content_language) merged.content_language = profile.content_language;
            if (profile.article_styles) merged.article_styles = profile.article_styles;
            if (profile.article_style_links) merged.article_style_links = profile.article_style_links;
            if (profile.brand_color_hex) merged.brand_color_hex = profile.brand_color_hex;
            if (profile.logo_url) merged.logo_url = profile.logo_url;
            if (profile.goals) merged.goals = profile.goals;
            if (profile.website_or_landing_url) merged.website_or_landing_url = profile.website_or_landing_url;
            if (profile.product_or_sales_url) merged.product_or_sales_url = profile.product_or_sales_url;
            if (profile.selected_plan) merged.selected_plan = profile.selected_plan;
            if (profile.discount_opt_in !== undefined) merged.discount_opt_in = profile.discount_opt_in;
            if (profile.approval_preference) merged.approval_preference = profile.approval_preference;
            if (profile.uploadpost_profile_username) merged.uploadpost_profile_username = profile.uploadpost_profile_username;
            if (profile.socials_connected) merged.socials_connected = profile.socials_connected;
            if (profile.additional_notes) merged.additional_notes = profile.additional_notes;

            setData(merged);

            if (profile.autofill_fields_filled && Array.isArray(profile.autofill_fields_filled)) {
              setAiFilledFields(profile.autofill_fields_filled);
            }

            const urlStep = stepFromUrl ? parseInt(stepFromUrl, 10) : NaN;
            if (!isNaN(urlStep) && urlStep >= 1 && urlStep <= TOTAL_STEPS) {
              setStep(urlStep);
            } else if (profile.onboarding_step && profile.onboarding_step >= 1 && profile.onboarding_step <= 5) {
              setStep(profile.onboarding_step);
            }
          }
        }
      } catch {
        if (!cancelled) setError(t("onboarding.errors.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback((patch: Partial<OnboardingUpdate>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  // Reload wizard data from DB (used after autofill)
  const reloadWizardData = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/onboarding", {
        headers: onboardingHeaders(undefined, resolvedWorkspaceRef.current),
      });
      if (res.ok) {
        const body = await res.json();
        const profile = body.data;

        if (profile) {
          const merged: OnboardingUpdate = { ...data };

          if (profile.business_name) merged.business_name = profile.business_name;
          if (profile.business_description) merged.business_description = profile.business_description;
          if (profile.website_url) merged.website_url = profile.website_url;
          if (profile.content_language) merged.content_language = profile.content_language;
          if (profile.article_styles) merged.article_styles = profile.article_styles;
          if (profile.article_style_links) merged.article_style_links = profile.article_style_links;
          if (profile.brand_color_hex) merged.brand_color_hex = profile.brand_color_hex;
          if (profile.logo_url) merged.logo_url = profile.logo_url;
          if (profile.goals) merged.goals = profile.goals;
          if (profile.website_or_landing_url) merged.website_or_landing_url = profile.website_or_landing_url;
          if (profile.product_or_sales_url) merged.product_or_sales_url = profile.product_or_sales_url;
          if (profile.selected_plan) merged.selected_plan = profile.selected_plan;
          if (profile.discount_opt_in !== undefined) merged.discount_opt_in = profile.discount_opt_in;
          if (profile.approval_preference) merged.approval_preference = profile.approval_preference;
          if (profile.uploadpost_profile_username) merged.uploadpost_profile_username = profile.uploadpost_profile_username;
          if (profile.socials_connected) merged.socials_connected = profile.socials_connected;
          if (profile.additional_notes) merged.additional_notes = profile.additional_notes;

          setData(merged);

          if (profile.autofill_fields_filled && Array.isArray(profile.autofill_fields_filled)) {
            setAiFilledFields(profile.autofill_fields_filled);
          }
        }
      }
    } catch (error) {
      console.error("[v0] Failed to reload wizard data:", error);
    }
  }, [data]);

  async function saveProgress(nextStep?: number) {
    setSaving(true);
    setError("");

    try {
      const payload: OnboardingUpdate = {
        ...data,
        onboarding_step: nextStep ?? step,
      };

      const res = await fetch("/api/v1/onboarding", {
        method: "PUT",
        headers: onboardingHeaders({ "Content-Type": "application/json" }, resolvedWorkspaceRef.current),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        // Don't show validation errors as blocking errors for partial saves
        if (res.status !== 422) {
          setError(body.error ?? t("onboarding.errors.saveFailed"));
        }
      }
    } catch {
      setError(t("onboarding.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    if (step >= TOTAL_STEPS) return;

    if (step === 4 && data.selected_plan) {
      await saveProgress(4);
      setCheckoutLoading(true);
      setError("");
      try {
        const tenantId = resolvedWorkspaceRef.current ?? getActiveWorkspaceIdFromCookie();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (tenantId) headers["X-Tenant-Id"] = tenantId;

        const res = await fetch("/api/v1/billing/checkout", {
          method: "POST",
          headers,
          body: JSON.stringify({
            plan_code: data.selected_plan,
            currency: data.selected_currency || "GBP",
            interval: "month",
            success_path: "/onboarding?step=5&checkout=success",
            cancel_path: "/onboarding?step=4",
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError((body as { error?: { message?: string } })?.error?.message || "Failed to start checkout. Please try again.");
          setCheckoutLoading(false);
          return;
        }

        const body = await res.json();
        if (body.url) {
          window.location.href = body.url;
          return;
        }
        setError("Failed to create checkout session.");
        setCheckoutLoading(false);
      } catch {
        setError("An error occurred starting checkout. Please try again.");
        setCheckoutLoading(false);
      }
      return;
    }

    const nextStep = step + 1;
    await saveProgress(nextStep);
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleBack() {
    if (step > 1) {
      const prevStep = step - 1;
      setStep(prevStep);
      // Persist the step so resume works even after browser close
      await saveProgress(prevStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleSaveAndExit() {
    setSaving(true);
    saveProgress(step).catch(() => {});
    fetch("/api/v1/onboarding/skip", {
      method: "POST",
      credentials: "include",
      headers: onboardingHeaders({ "Content-Type": "application/json" }, resolvedWorkspaceRef.current),
      body: JSON.stringify({ onboarding_step: step }),
    }).catch((e) => console.warn("[onboarding] Skip request failed:", e));
    // Dashboard is always reachable (middleware no longer redirects back to onboarding)
    window.location.href = "/dashboard";
  }

  async function handleFinish() {
    setSaving(true);
    setError("");

    // First save all data
    await saveProgress(5);

    // Then complete
    try {
      const res = await fetch("/api/v1/onboarding/complete", {
        method: "POST",
        headers: onboardingHeaders(undefined, resolvedWorkspaceRef.current),
      });

      if (res.ok) {
        router.push("/dashboard");
      } else {
        const body = await res.json();
        setError(body.error ?? t("onboarding.errors.completeFailed"));
        setSaving(false);
      }
    } catch {
      setError(t("onboarding.errors.completeFailed"));
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <UploadPostSuccessBanner show={showSuccessBanner} />
      {showCheckoutSuccess && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-md">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span>Payment successful! Complete your setup below.</span>
          <button
            type="button"
            onClick={() => setShowCheckoutSuccess(false)}
            className="ml-2 rounded-lg p-1 hover:bg-green-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/images/zarzoom-logo-v4.png"
              alt="ZARZOOM"
              className="h-8 w-auto rounded"
            />
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-gray-900">
                {t("onboarding.title")}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveAndExit}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            {t("onboarding.nav.skipForNow")}
          </button>
        </div>
      </header>

      <div className={`mx-auto px-4 py-8 flex flex-col gap-8 w-full ${step === 4 ? "max-w-6xl" : "max-w-3xl"}`}>
        {/* Stepper */}
        <Stepper currentStep={step} totalSteps={TOTAL_STEPS} />

        {/* Step content card */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 lg:p-8">
          {step === 1 && <Step1Account userEmail={userEmail} />}
          {step === 2 && (
            <Step2Brand 
              data={data} 
              onChange={handleChange} 
              aiFilledFields={aiFilledFields}
              onReload={reloadWizardData}
            />
          )}
          {step === 3 && (
            <Step3Goals 
              data={data} 
              onChange={handleChange}
              aiFilledFields={aiFilledFields}
            />
          )}
          {step === 4 && (
            <Step4Plan 
              data={data} 
              onChange={handleChange}
              aiFilledFields={aiFilledFields}
            />
          )}
          {step === 5 && (
            <Step5Connect 
              data={data} 
              onChange={handleChange}
              aiFilledFields={aiFilledFields}
            />
          )}
        </section>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("onboarding.nav.back")}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={saving || checkoutLoading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50 uppercase tracking-wide"
              >
                {saving || checkoutLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : step === 4 && data.selected_plan ? (
                  <>
                    {t("onboarding.nav.subscribe", "Subscribe & Continue")}
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    {t("onboarding.nav.next")}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50 uppercase tracking-wide"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    {t("onboarding.nav.finish")}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
