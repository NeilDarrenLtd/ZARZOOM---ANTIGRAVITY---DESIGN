"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingUpdate } from "@/lib/validation/onboarding";

import Stepper from "@/components/onboarding/Stepper";
import Step1Account from "@/components/onboarding/Step1Account";
import Step2Brand from "@/components/onboarding/Step2Brand";
import Step3Goals from "@/components/onboarding/Step3Goals";
import Step4Plan from "@/components/onboarding/Step4Plan";
import Step5Connect from "@/components/onboarding/Step5Connect";

import { ArrowLeft, ArrowRight, Rocket, LogOut, Loader2 } from "lucide-react";

const TOTAL_STEPS = 5;

export default function OnboardingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
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

  // Load user + existing onboarding data
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      setUserEmail(user.email ?? "");

      try {
        const res = await fetch("/api/v1/onboarding");
        if (res.ok) {
          const body = await res.json();
          const profile = body.data;

          if (profile) {
            // If already completed, redirect to dashboard
            if (profile.onboarding_status === "completed") {
              router.push("/dashboard");
              return;
            }

            // Merge persisted data into local state
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

            // Resume at the saved step
            if (profile.onboarding_step && profile.onboarding_step >= 1 && profile.onboarding_step <= 5) {
              setStep(profile.onboarding_step);
            }
          }
        }
      } catch {
        setError(t("onboarding.errors.loadFailed"));
      } finally {
        setLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback((patch: Partial<OnboardingUpdate>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

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
        headers: { "Content-Type": "application/json" },
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
    if (step < TOTAL_STEPS) {
      const nextStep = step + 1;
      await saveProgress(nextStep);
      setStep(nextStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleBack() {
    if (step > 1) {
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleSaveAndExit() {
    await saveProgress(step);
    // Skip onboarding
    try {
      await fetch("/api/v1/onboarding/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_step: step }),
      });
    } catch {
      // Silently ignore skip errors
    }
    router.push("/dashboard");
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
      {/* Header */}
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

          {step > 1 && (
            <button
              type="button"
              onClick={handleSaveAndExit}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t("onboarding.nav.skipForNow")}
            </button>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Stepper */}
        <Stepper currentStep={step} totalSteps={TOTAL_STEPS} />

        {/* Step content card */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
          {step === 1 && <Step1Account userEmail={userEmail} />}
          {step === 2 && <Step2Brand data={data} onChange={handleChange} />}
          {step === 3 && <Step3Goals data={data} onChange={handleChange} />}
          {step === 4 && <Step4Plan data={data} onChange={handleChange} />}
          {step === 5 && <Step5Connect data={data} onChange={handleChange} />}
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
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50 uppercase tracking-wide"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
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
