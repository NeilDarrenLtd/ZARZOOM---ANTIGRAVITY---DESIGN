"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { AlertCircle, Check } from "lucide-react";

export default function AdminSupportSettingsPage() {
  const { t } = useI18n();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/v1/admin/support/settings");
      if (!response.ok) throw new Error("Failed to load settings");

      const { data } = await response.json();
      setRecipientEmail(data?.support_recipient_email || "");
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError(t("adminSupport.settings.loadError"));
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setSuccess(false);
      setError(null);

      const response = await fetch("/api/v1/admin/support/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ support_recipient_email: recipientEmail }),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError(t("adminSupport.settings.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("adminSupport.settings.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("adminSupport.settings.subtitle")}
        </p>
      </div>

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="animate-pulse text-gray-400 text-sm">
            {t("adminSupport.settings.loading")}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <form onSubmit={saveSettings} className="max-w-xl">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {t("adminSupport.settings.recipientEmail.label")}
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder={t("adminSupport.settings.recipientEmail.placeholder")}
                required
                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-2">
                {t("adminSupport.settings.recipientEmail.help")}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">{error}</p>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">
                    {t("adminSupport.settings.saveSuccess")}
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t("adminSupport.settings.saving") : t("adminSupport.settings.save")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
