"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getSettings, saveSettings } from "@/app/admin/actions";
import {
  KeyRound,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  Copy,
  CheckCheck,
} from "lucide-react";

interface ProviderConfig {
  id: string;
  name: string;
  color: string;
  bgColor: string;
  callbackPath: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "google",
    name: "Google",
    color: "text-red-600",
    bgColor: "bg-red-50",
    callbackPath: "/auth/callback",
  },
  {
    id: "facebook",
    name: "Facebook",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    callbackPath: "/auth/callback",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    color: "text-sky-700",
    bgColor: "bg-sky-50",
    callbackPath: "/auth/callback",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    color: "text-gray-900",
    bgColor: "bg-gray-100",
    callbackPath: "/auth/callback",
  },
];

export default function OAuthSettingsPage() {
  const { t } = useI18n();
  const [forms, setForms] = useState<
    Record<string, { client_id: string; client_secret: string; enabled: string }>
  >({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedProvider, setSavedProvider] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const siteUrl =
    typeof window !== "undefined" ? window.location.origin : "https://yoursite.com";

  useEffect(() => {
    async function load() {
      const result = await getSettings("oauth_");
      const loaded: typeof forms = {};

      for (const p of PROVIDERS) {
        loaded[p.id] = {
          client_id: "",
          client_secret: "",
          enabled: "false",
        };
      }

      if (result.settings) {
        for (const [key, val] of Object.entries(result.settings)) {
          // key format: oauth_google_client_id
          const parts = key.replace("oauth_", "").split("_");
          const provider = parts[0];
          const field = parts.slice(1).join("_");
          if (loaded[provider] && field in loaded[provider]) {
            (loaded[provider] as Record<string, string>)[field] = val;
          }
        }
      }

      setForms(loaded);
    }
    load();
  }, []);

  function updateField(provider: string, field: string, value: string) {
    setForms((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value },
    }));
    setSavedProvider(null);
  }

  async function handleSaveProvider(providerId: string) {
    setSaving(providerId);
    setError("");
    setSavedProvider(null);

    const form = forms[providerId];
    const entries = [
      { key: `oauth_${providerId}_client_id`, value: form.client_id, encrypted: false },
      {
        key: `oauth_${providerId}_client_secret`,
        value: form.client_secret,
        encrypted: true,
      },
      { key: `oauth_${providerId}_enabled`, value: form.enabled, encrypted: false },
    ];

    const result = await saveSettings(entries);
    setSaving(null);

    if (result.error) {
      setError(result.error);
    } else {
      setSavedProvider(providerId);
      // Clear secret field after save
      setForms((prev) => ({
        ...prev,
        [providerId]: { ...prev[providerId], client_secret: "" },
      }));
    }
  }

  function handleCopyUrl(url: string, providerId: string) {
    navigator.clipboard.writeText(url);
    setCopiedUrl(providerId);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors text-sm bg-white";

  const labelClass = "block text-xs font-semibold text-gray-700 mb-1.5";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {t("admin.oauthKeys")}
          </h1>
          <p className="text-xs text-gray-500">{t("admin.oauthSettingsDesc")}</p>
        </div>
      </div>

      {/* Stub note */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-6">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">
          {t("admin.oauthStubNote")}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-4 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {PROVIDERS.map((provider) => {
          const form = forms[provider.id];
          if (!form) return null;

          const callbackUrl = `${siteUrl}${provider.callbackPath}`;
          const isEnabled = form.enabled === "true";

          return (
            <div
              key={provider.id}
              className="bg-white border border-gray-200 rounded-xl p-6"
            >
              {/* Provider header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${provider.bgColor}`}
                  >
                    <span className={`text-xs font-bold ${provider.color}`}>
                      {provider.name[0]}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {provider.name}
                  </h3>
                </div>

                {/* Enable toggle */}
                <button
                  onClick={() =>
                    updateField(
                      provider.id,
                      "enabled",
                      isEnabled ? "false" : "true"
                    )
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isEnabled ? "bg-green-600" : "bg-gray-200"
                  }`}
                  role="switch"
                  aria-checked={isEnabled}
                  aria-label={`${isEnabled ? t("admin.oauthEnabled") : t("admin.oauthDisabled")} ${provider.name}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Callback URL (read-only) */}
              <div className="mb-4">
                <label className={labelClass}>{t("admin.oauthCallbackUrl")}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={callbackUrl}
                    className={`${inputClass} bg-gray-50 text-gray-500 cursor-default`}
                  />
                  <button
                    onClick={() => handleCopyUrl(callbackUrl, provider.id)}
                    className="flex-shrink-0 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    aria-label="Copy URL"
                  >
                    {copiedUrl === provider.id ? (
                      <CheckCheck className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Client ID */}
              <div className="mb-4">
                <label
                  htmlFor={`${provider.id}_client_id`}
                  className={labelClass}
                >
                  {t("admin.oauthClientId")}
                </label>
                <input
                  id={`${provider.id}_client_id`}
                  type="text"
                  value={form.client_id}
                  onChange={(e) =>
                    updateField(provider.id, "client_id", e.target.value)
                  }
                  className={inputClass}
                  placeholder={`${provider.name} Client ID`}
                />
              </div>

              {/* Client Secret (masked) */}
              <div className="mb-4">
                <label
                  htmlFor={`${provider.id}_client_secret`}
                  className={labelClass}
                >
                  {t("admin.oauthClientSecret")}
                </label>
                <div className="relative">
                  <input
                    id={`${provider.id}_client_secret`}
                    type={showSecrets[provider.id] ? "text" : "password"}
                    value={form.client_secret}
                    onChange={(e) =>
                      updateField(provider.id, "client_secret", e.target.value)
                    }
                    className={inputClass}
                    placeholder="********  (leave blank to keep current)"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowSecrets((prev) => ({
                        ...prev,
                        [provider.id]: !prev[provider.id],
                      }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Toggle secret visibility"
                  >
                    {showSecrets[provider.id] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {t("admin.secretsHidden")}
                </p>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    isEnabled
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isEnabled ? t("admin.oauthEnabled") : t("admin.oauthDisabled")}
                </span>

                <div className="flex items-center gap-2">
                  {savedProvider === provider.id && (
                    <span className="text-xs text-green-700 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      {t("admin.saved")}
                    </span>
                  )}
                  <button
                    onClick={() => handleSaveProvider(provider.id)}
                    disabled={saving === provider.id}
                    className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-xs"
                  >
                    {saving === provider.id
                      ? t("admin.settingsSaving")
                      : t("admin.saveProvider")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
