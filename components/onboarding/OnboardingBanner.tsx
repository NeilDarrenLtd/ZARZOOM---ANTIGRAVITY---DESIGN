"use client";

import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { useState } from "react";

/**
 * Persistent banner shown on /dashboard when onboarding is
 * skipped or in_progress. Dismissible for the session but
 * re-appears on next page load.
 */
export default function OnboardingBanner() {
  const { needsBanner, status, isLoading } = useOnboarding();
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || !needsBanner || dismissed) return null;

  const isSkipped = status === "skipped";

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-sm text-amber-800 font-medium truncate">
            {isSkipped
              ? t(
                  "onboarding.banner.skipped",
                  "You skipped setup. Complete it to unlock all features."
                )
              : t(
                  "onboarding.banner.inProgress",
                  "Your setup is incomplete. Finish it to get started."
                )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/onboarding?resume=1"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors uppercase tracking-wide"
          >
            {t("onboarding.banner.cta", "Complete Setup")}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-100 transition-colors"
            aria-label={t("onboarding.a11y.dismissBanner")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
