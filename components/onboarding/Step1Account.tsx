"use client";

import { useI18n } from "@/lib/i18n";
import { Check, User } from "lucide-react";

interface Step1Props {
  userEmail: string;
}

export default function Step1Account({ userEmail }: Step1Props) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center text-center gap-6 py-8">
      {/* Success icon */}
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
        <Check className="w-8 h-8 text-green-600" />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-gray-900">
          {t("onboarding.step1.title")}
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          {t("onboarding.step1.subtitle")}
        </p>
      </div>

      {/* User info card */}
      <div className="w-full max-w-sm bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-white" />
        </div>
        <div className="text-left min-w-0">
          <p className="text-xs text-gray-500">
            {t("onboarding.step1.signedInAs")}
          </p>
          <p className="text-sm font-medium text-gray-900 truncate">
            {userEmail}
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-400">
        {t("onboarding.step1.continue")}
      </p>
    </div>
  );
}
