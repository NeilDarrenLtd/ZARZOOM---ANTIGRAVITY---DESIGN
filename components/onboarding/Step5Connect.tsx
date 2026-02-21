"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import type { OnboardingUpdate } from "@/lib/validation/onboarding";
import { ExternalLink, CheckCircle2, Circle, Loader2 } from "lucide-react";
import UploadPostConnectModal from "@/components/social/UploadPostConnectModal";

interface Step5Props {
  data: OnboardingUpdate;
  onChange: (patch: Partial<OnboardingUpdate>) => void;
  aiFilledFields?: string[];
}

export default function Step5Connect({ data, onChange, aiFilledFields = [] }: Step5Props) {
  const { t } = useI18n();
  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const inputClass =
    "w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors text-sm";

  const handleModalClose = useCallback(
    async (connected: boolean) => {
      setShowModal(false);

      if (connected) {
        onChange({ socials_connected: true });
        return;
      }

      // Even if modal said not connected, do a final status check
      setRefreshing(true);
      try {
        const res = await fetch("/api/v1/onboarding/social-connect/status");
        if (res.ok) {
          const body = await res.json();
          if (body.data?.connected) {
            onChange({ socials_connected: true });
          }
        }
      } catch {
        // silently ignore
      } finally {
        setRefreshing(false);
      }
    },
    [onChange]
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {t("onboarding.step5.title")}
        </h2>
        <p className="text-gray-500 text-sm mt-1 leading-relaxed">
          {t("onboarding.step5.subtitle")}
        </p>
      </div>

      {/* Connect socials */}
      <div className="p-5 rounded-xl border border-gray-200 bg-white">
        <label className="block text-xs font-medium text-gray-700 mb-2">
          {t("onboarding.step5.connectSocials.label")}
        </label>
        <p className="text-xs text-gray-400 mb-3">
          {t("onboarding.step5.connectSocials.help")}
        </p>

        <div className="flex items-center gap-3 mb-3">
          {refreshing ? (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          ) : data.socials_connected ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <Circle className="w-5 h-5 text-gray-300" />
          )}
          <span
            className={`text-sm ${
              data.socials_connected
                ? "text-green-700 font-medium"
                : "text-gray-500"
            }`}
          >
            {refreshing
              ? t("onboarding.modal.checking")
              : data.socials_connected
                ? t("onboarding.step5.connectSocials.connected")
                : t("onboarding.step5.connectSocials.notConnected")}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <ExternalLink className="w-4 h-4" />
          {data.socials_connected
            ? t("onboarding.step5.connectSocials.manage")
            : t("onboarding.step5.connectSocials.button")}
        </button>
      </div>

      {/* Approval preference */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          {t("onboarding.step5.approval.label")}
        </label>
        <p className="text-xs text-gray-400 mb-3">
          {t("onboarding.step5.approval.help")}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Auto */}
          <button
            type="button"
            onClick={() => onChange({ approval_preference: "auto" })}
            className={`p-4 rounded-xl border text-left transition-all ${
              data.approval_preference === "auto"
                ? "border-green-500 bg-green-50 ring-1 ring-green-500/20"
                : "border-gray-200 bg-white hover:border-green-300"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                data.approval_preference === "auto"
                  ? "text-green-700"
                  : "text-gray-700"
              }`}
            >
              {t("onboarding.step5.approval.auto")}
            </p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {t("onboarding.step5.approval.autoHelp")}
            </p>
          </button>

          {/* Manual */}
          <button
            type="button"
            onClick={() => onChange({ approval_preference: "manual" })}
            className={`p-4 rounded-xl border text-left transition-all ${
              data.approval_preference === "manual"
                ? "border-green-500 bg-green-50 ring-1 ring-green-500/20"
                : "border-gray-200 bg-white hover:border-green-300"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                data.approval_preference === "manual"
                  ? "text-green-700"
                  : "text-gray-700"
              }`}
            >
              {t("onboarding.step5.approval.manual")}
            </p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {t("onboarding.step5.approval.manualHelp")}
            </p>
          </button>
        </div>
      </div>

      {/* Additional notes */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("onboarding.step5.notes.label")}
        </label>
        <textarea
          value={data.additional_notes ?? ""}
          onChange={(e) =>
            onChange({ additional_notes: e.target.value || null })
          }
          className={`${inputClass} resize-none`}
          rows={4}
          placeholder={t("onboarding.step5.notes.placeholder")}
        />
        <p className="text-xs text-gray-400 mt-1">
          {t("onboarding.step5.notes.help")}
        </p>
      </div>

      {/* Upload-Post connect modal */}
      <UploadPostConnectModal open={showModal} onClose={handleModalClose} />
    </div>
  );
}
