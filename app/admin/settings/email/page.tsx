"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getSettings, saveSettings, sendTestEmail } from "@/app/admin/actions";
import { Mail, Send, Check, AlertCircle, Eye, EyeOff, Info } from "lucide-react";

const SMTP_KEYS = [
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_pass",
  "smtp_from_email",
  "smtp_from_name",
  "smtp_encryption",
] as const;

const SECRET_KEYS = new Set(["smtp_pass"]);

export default function EmailSettingsPage() {
  const { t } = useI18n();
  const [form, setForm] = useState<Record<string, string>>({
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_pass: "",
    smtp_from_email: "",
    smtp_from_name: "ZARZOOM",
    smtp_encryption: "tls",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "sent" | "error">("idle");
  const [hasExistingSecrets, setHasExistingSecrets] = useState(false);

  useEffect(() => {
    async function load() {
      const result = await getSettings("smtp_");
      if (result.settings) {
        const loaded = { ...form };
        let hasSecrets = false;
        for (const [key, val] of Object.entries(result.settings)) {
          if (key in loaded) {
            loaded[key] = val;
          }
          if (SECRET_KEYS.has(key) && val === "") {
            // Empty string for encrypted means there IS a saved secret
            // We check if the key existed at all
            hasSecrets = true;
          }
        }
        // If smtp_host exists, assume secrets might be saved
        if ("smtp_host" in result.settings && result.settings["smtp_host"]) {
          hasSecrets = true;
        }
        setHasExistingSecrets(hasSecrets);
        setForm(loaded);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    const entries = SMTP_KEYS.map((key) => ({
      key,
      value: form[key],
      encrypted: SECRET_KEYS.has(key),
    }));

    const result = await saveSettings(entries);
    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setHasExistingSecrets(true);
      // Clear the password field after save to show it's masked
      setForm((prev) => ({ ...prev, smtp_pass: "" }));
    }
  }

  const [testError, setTestError] = useState("");

  async function handleTestEmail() {
    if (!testEmail) return;
    setTestStatus("idle");
    setTestError("");
    const result = await sendTestEmail(testEmail);
    if (result.success) {
      setTestStatus("sent");
    } else {
      setTestStatus("error");
      setTestError(result.error || "Failed to send test email.");
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors text-sm bg-white";

  const labelClass = "block text-xs font-semibold text-gray-700 mb-1.5";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
          <Mail className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {t("admin.emailSettings")}
          </h1>
          <p className="text-xs text-gray-500">{t("admin.emailSettingsDesc")}</p>
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-6">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Configure your SMTP server to send emails from ZARZOOM. After saving,
          use the test button below to verify your settings are correct.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex flex-col gap-4">
          {/* Host */}
          <div>
            <label htmlFor="smtp_host" className={labelClass}>
              {t("admin.smtpHost")}
            </label>
            <input
              id="smtp_host"
              type="text"
              value={form.smtp_host}
              onChange={(e) => updateField("smtp_host", e.target.value)}
              className={inputClass}
              placeholder="smtp.example.com"
            />
          </div>

          {/* Port + Encryption */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="smtp_port" className={labelClass}>
                {t("admin.smtpPort")}
              </label>
              <input
                id="smtp_port"
                type="text"
                value={form.smtp_port}
                onChange={(e) => updateField("smtp_port", e.target.value)}
                className={inputClass}
                placeholder="587"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="smtp_encryption" className={labelClass}>
                {t("admin.smtpEncryption")}
              </label>
              <select
                id="smtp_encryption"
                value={form.smtp_encryption}
                onChange={(e) => updateField("smtp_encryption", e.target.value)}
                className={inputClass}
              >
                <option value="tls">{t("admin.smtpEncryptionTLS")}</option>
                <option value="ssl">{t("admin.smtpEncryptionSSL")}</option>
                <option value="none">{t("admin.smtpEncryptionNone")}</option>
              </select>
            </div>
          </div>

          {/* Username */}
          <div>
            <label htmlFor="smtp_user" className={labelClass}>
              {t("admin.smtpUser")}
            </label>
            <input
              id="smtp_user"
              type="text"
              value={form.smtp_user}
              onChange={(e) => updateField("smtp_user", e.target.value)}
              className={inputClass}
              placeholder="user@example.com"
            />
          </div>

          {/* Password (masked) */}
          <div>
            <label htmlFor="smtp_pass" className={labelClass}>
              {t("admin.smtpPass")}
            </label>
            <div className="relative">
              <input
                id="smtp_pass"
                type={showPassword ? "text" : "password"}
                value={form.smtp_pass}
                onChange={(e) => updateField("smtp_pass", e.target.value)}
                className={inputClass}
                placeholder={
                  hasExistingSecrets
                    ? "********  (leave blank to keep current)"
                    : "Enter SMTP password"
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {hasExistingSecrets && (
              <p className="text-xs text-gray-400 mt-1">
                {t("admin.secretsHidden")}
              </p>
            )}
          </div>

          {/* From Email */}
          <div>
            <label htmlFor="smtp_from_email" className={labelClass}>
              {t("admin.smtpFrom")}
            </label>
            <input
              id="smtp_from_email"
              type="email"
              value={form.smtp_from_email}
              onChange={(e) => updateField("smtp_from_email", e.target.value)}
              className={inputClass}
              placeholder="noreply@zarzoom.com"
            />
          </div>

          {/* From Name */}
          <div>
            <label htmlFor="smtp_from_name" className={labelClass}>
              {t("admin.smtpFromName")}
            </label>
            <input
              id="smtp_from_name"
              type="text"
              value={form.smtp_from_name}
              onChange={(e) => updateField("smtp_from_name", e.target.value)}
              className={inputClass}
              placeholder="ZARZOOM"
            />
          </div>
        </div>

        {/* Error / Success */}
        {error && (
          <div className="flex items-center gap-2 mt-4 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 mt-4 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
            <Check className="w-3.5 h-3.5" />
            {t("admin.saved")}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
        >
          {saving ? t("admin.settingsSaving") : t("admin.save")}
        </button>
      </div>

      {/* Test email section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mt-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">
          {t("admin.sendTestEmail")}
        </h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => {
                setTestEmail(e.target.value);
                setTestStatus("idle");
              }}
              className={inputClass}
              placeholder={t("admin.testEmailRecipient")}
            />
          </div>
          <button
            onClick={handleTestEmail}
            disabled={!testEmail}
            className="flex items-center gap-2 bg-gray-900 text-white font-medium py-2.5 px-4 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            {t("admin.sendTestEmail")}
          </button>
        </div>
        {testStatus === "sent" && (
          <p className="text-xs text-green-700 mt-2">
            {t("admin.testEmailSent")}
          </p>
        )}
        {testStatus === "error" && (
          <p className="text-xs text-red-600 mt-2">
            {testError || t("admin.testEmailFailed")}
          </p>
        )}
      </div>
    </div>
  );
}
