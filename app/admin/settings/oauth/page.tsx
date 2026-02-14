"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  getSettings,
  saveSettings,
  configureSupabaseOAuthProvider,
  getSupabaseOAuthStatus,
} from "@/app/admin/actions";
import {
  KeyRound,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  Copy,
  CheckCheck,
  Loader2,
} from "lucide-react";

interface ProviderConfig {
  id: string;
  name: string;
  color: string;
  bgColor: string;
  consoleUrl: string;
}

// The callback URL for ALL providers is Supabase's auth callback, NOT the app's.
// The OAuth flow is: App -> Provider (Google etc.) -> Supabase callback -> App callback
const SUPABASE_CALLBACK_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`;

const PROVIDERS: ProviderConfig[] = [
  {
    id: "google",
    name: "Google",
    color: "text-red-600",
    bgColor: "bg-red-50",
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
  },
  {
    id: "facebook",
    name: "Facebook",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    consoleUrl: "https://developers.facebook.com/apps",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    color: "text-sky-700",
    bgColor: "bg-sky-50",
    consoleUrl: "https://www.linkedin.com/developers/apps",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    color: "text-gray-900",
    bgColor: "bg-gray-100",
    consoleUrl: "https://developer.twitter.com/en/portal/dashboard",
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
  const [supabaseStatus, setSupabaseStatus] = useState<
    Record<string, { enabled: boolean; hasClientId: boolean }>
  >({});
  const [hasAccessToken, setHasAccessToken] = useState(true);

  const supabaseCallbackUrl = SUPABASE_CALLBACK_URL;

  useEffect(() => {
    async function load() {
      // Load saved settings from site_settings DB
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
          const parts = key.replace("oauth_", "").split("_");
          const provider = parts[0];
          const field = parts.slice(1).join("_");
          if (loaded[provider] && field in loaded[provider]) {
            (loaded[provider] as Record<string, string>)[field] = val;
          }
        }
      }

      setForms(loaded);

      // Also load actual Supabase provider status
      const statusResult = await getSupabaseOAuthStatus();
      if (statusResult.error) {
        setHasAccessToken(false);
      } else {
        const providerStatus = (statusResult.providers ?? {}) as Record<string, { enabled: boolean; hasClientId: boolean }>;
        setSupabaseStatus(providerStatus);
        // Sync enabled state from Supabase if available
        for (const p of PROVIDERS) {
          const status = providerStatus[p.id];
          if (status) {
            loaded[p.id].enabled = status.enabled ? "true" : "false";
          }
        }
        setForms({ ...loaded });
      }
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
    const isEnabled = form.enabled === "true";

    // 1. Save to site_settings DB (backup/reference)
    const entries = [
      { key: `oauth_${providerId}_client_id`, value: form.client_id, encrypted: false },
      {
        key: `oauth_${providerId}_client_secret`,
        value: form.client_secret,
        encrypted: true,
      },
      { key: `oauth_${providerId}_enabled`, value: form.enabled, encrypted: false },
    ];

    const dbResult = await saveSettings(entries);
    if (dbResult.error) {
      setSaving(null);
      setError(dbResult.error);
      return;
    }

    // 2. Configure the provider in Supabase Auth (this is what actually matters)
    const supabaseResult = await configureSupabaseOAuthProvider(
      providerId,
      form.client_id,
      form.client_secret,
      isEnabled
    );

    setSaving(null);

    if (supabaseResult.error) {
      setError(supabaseResult.error);
    } else {
      setSavedProvider(providerId);
      // Update local Supabase status
      setSupabaseStatus((prev) => ({
        ...prev,
        [providerId]: { enabled: isEnabled, hasClientId: !!form.client_id },
      }));
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

      {/* Info note */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-6">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-700 leading-relaxed space-y-1">
          <p>
            Enter your OAuth credentials and enable the provider. Saving will
            configure the provider directly in Supabase Auth so users can sign in
            immediately.
          </p>
          <p className="font-semibold">
            Important: In each provider&apos;s developer console, you must set the
            Authorized Redirect URI to your Supabase callback URL shown below each
            provider -- NOT your website URL.
          </p>
        </div>
      </div>

      {!hasAccessToken && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 leading-relaxed">
            The SUPABASE_ACCESS_TOKEN environment variable is not set. Please add
            a Supabase Personal Access Token to enable OAuth provider
            configuration. You can generate one from your{" "}
            <a
              href="https://supabase.com/dashboard/account/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              Supabase account settings
            </a>
            .
          </p>
        </div>
      )}

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

              {/* Supabase Callback URL (read-only) - this is what goes in the provider console */}
              <div className="mb-4">
                <label className={labelClass}>
                  Authorized Redirect URI{" "}
                  <span className="font-normal text-gray-400">
                    (paste this into your{" "}
                    <a
                      href={provider.consoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-500 hover:text-blue-600"
                    >
                      {provider.name} developer console
                    </a>
                    )
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={supabaseCallbackUrl}
                    className={`${inputClass} bg-gray-50 text-gray-500 cursor-default font-mono text-xs`}
                  />
                  <button
                    onClick={() => handleCopyUrl(supabaseCallbackUrl, provider.id)}
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
                <p className="text-xs text-amber-600 mt-1">
                  Important: This Supabase URL must be used as the redirect URI in your {provider.name} app settings, not your website URL.
                </p>
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
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      isEnabled
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {isEnabled ? t("admin.oauthEnabled") : t("admin.oauthDisabled")}
                  </span>
                  {supabaseStatus[provider.id] && (
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        supabaseStatus[provider.id].enabled
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-orange-50 text-orange-600"
                      }`}
                    >
                      {supabaseStatus[provider.id].enabled
                        ? "Supabase: Active"
                        : "Supabase: Inactive"}
                    </span>
                  )}
                </div>

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
                    className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-xs flex items-center gap-2"
                  >
                    {saving === provider.id ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t("admin.settingsSaving")}
                      </>
                    ) : (
                      t("admin.saveProvider")
                    )}
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
