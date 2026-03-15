"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getSettings, saveSettings, resetAnalyzerAnonymousLimits } from "@/app/admin/actions";
import { Settings, AlertCircle, Check, BarChart2, RotateCcw, Loader2 } from "lucide-react";

const USAGE_KEYS = [
  "usage_daily_autofill_default",
  "usage_total_autofill_default",
  "usage_analyzer_default",
] as const;

type UsageKey = (typeof USAGE_KEYS)[number];

export default function UsageLimitsSettingsPage() {
  const { t } = useI18n();
  const [form, setForm] = useState<Record<UsageKey, string>>({
    usage_daily_autofill_default: "2",
    usage_total_autofill_default: "10",
    usage_analyzer_default: "3",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [resettingAnon, setResettingAnon] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  useEffect(() => {
    async function load() {
      const result = await getSettings("usage_");
      if (result.settings) {
        const settings = result.settings as Record<string, string>;
        setForm((prev) => {
          const next = { ...prev };
          for (const key of USAGE_KEYS) {
            if (settings[key]) {
              next[key] = settings[key];
            }
          }
          return next;
        });
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(key: UsageKey, value: string) {
    // only allow digits
    const cleaned = value.replace(/[^0-9]/g, "");
    setForm((prev) => ({ ...prev, [key]: cleaned }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    // basic validation
    for (const key of USAGE_KEYS) {
      const v = form[key].trim();
      if (!v) {
        setSaving(false);
        setError("All limits must be numeric and greater than 0.");
        return;
      }
      const n = parseInt(v, 10);
      if (!Number.isFinite(n) || n <= 0 || n > 99999) {
        setSaving(false);
        setError("Limits must be between 1 and 99999.");
        return;
      }
    }

    const entries = USAGE_KEYS.map((key) => ({
      key,
      value: form[key].trim(),
      encrypted: false,
    }));

    const result = await saveSettings(entries);
    if (result.error) {
      setSaving(false);
      setError(result.error);
      return;
    }

    setSaving(false);
    setSaved(true);
  }

  async function handleResetAnonymous() {
    setResettingAnon(true);
    setResetMessage("");
    setError("");
    const result = await resetAnalyzerAnonymousLimits();
    setResettingAnon(false);
    if ((result as any).error) {
      setError((result as any).error || "Failed to reset anonymous limits.");
      return;
    }
    setResetMessage("Anonymous analyzer limits have been reset. New anonymous sessions can run again.");
  }

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors text-sm bg-white";
  const labelClass = "block text-xs font-semibold text-gray-700 mb-1.5";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
          <Settings className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Usage Limits (Defaults)
          </h1>
          <p className="text-xs text-gray-500">
            Configure site-wide default limits for auto-fill and the Social Analyzer.
            Per-user overrides in the Users panel take precedence.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-5">
          <BarChart2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 leading-relaxed">
            These values act as global defaults. You can override them for specific
            users from the Users page. Changes apply immediately to new requests.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Daily auto-fill limit (default)</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.usage_daily_autofill_default}
              onChange={(e) =>
                updateField("usage_daily_autofill_default", e.target.value)
              }
              className={inputClass}
              placeholder="2"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Number of auto-fill runs allowed per user per day when no per-user override is set.
            </p>
          </div>

          <div>
            <label className={labelClass}>Total auto-fill limit (default)</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.usage_total_autofill_default}
              onChange={(e) =>
                updateField("usage_total_autofill_default", e.target.value)
              }
              className={inputClass}
              placeholder="10"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Lifetime auto-fill usage before degrading to basic mode when no per-user override is set.
            </p>
          </div>

          <div>
            <label className={labelClass}>Analyzer usage limit (default)</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.usage_analyzer_default}
              onChange={(e) =>
                updateField("usage_analyzer_default", e.target.value)
              }
              className={inputClass}
              placeholder="3"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Default maximum number of Social Analyzer uses per user when no per-user override is set.
            </p>
          </div>
        </div>

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
        {resetMessage && !error && (
          <div className="flex items-center gap-2 mt-4 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
            <Check className="w-3.5 h-3.5" />
            {resetMessage}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
          >
            {saving ? t("admin.settingsSaving") : t("admin.save")}
          </button>

          <button
            type="button"
            onClick={handleResetAnonymous}
            disabled={resettingAnon}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {resettingAnon ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            Reset anonymous analyzer limits
          </button>
        </div>
      </div>
    </div>
  );
}

