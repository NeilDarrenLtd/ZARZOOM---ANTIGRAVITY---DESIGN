"use client";

import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { Rocket, Lock, Loader2 } from "lucide-react";

/**
 * Wraps any content that requires onboarding to be completed.
 * Use this inside engine pages (or any feature-gated section).
 *
 * - While loading: shows a spinner
 * - If not completed: shows a full-screen gate with a CTA to /onboarding
 * - If completed: renders children normally
 */
export default function OnboardingGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isComplete, isLoading } = useOnboarding();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!isComplete) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center flex flex-col items-center gap-6">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>

          {/* Copy */}
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-gray-900">
              {t("onboarding.gate.title", "Setup Required")}
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              {t(
                "onboarding.gate.description",
                "Complete your onboarding setup to unlock this feature. It only takes a few minutes."
              )}
            </p>
          </div>

          {/* CTA */}
          <Link
            href="/onboarding?resume=1"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors uppercase tracking-wide"
          >
            <Rocket className="w-4 h-4" />
            {t("onboarding.gate.cta", "Complete Setup")}
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
