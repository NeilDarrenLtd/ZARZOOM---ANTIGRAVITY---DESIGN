"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Save,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SettingsData {
  hasApiKey: boolean;
  logoUrl: string;
  connectTitle: string;
  connectDescription: string;
  redirectButtonText: string;
  defaultPlatforms: string;
  updatedAt: string | null;
}

interface SaveState {
  status: "idle" | "saving" | "success" | "error";
  message?: string;
}

interface TestState {
  status: "idle" | "testing" | "success" | "error";
  message?: string;
}

/* ------------------------------------------------------------------ */
/*  SWR fetcher                                                        */
/* ------------------------------------------------------------------ */

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function UploadPostSettingsForm() {
  const { data, error, isLoading, mutate } = useSWR<{ data: SettingsData }>(
    "/api/admin/settings/upload-post",
    fetcher
  );

  /* -- Form state -------------------------------------------------- */
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [connectTitle, setConnectTitle] = useState("");
  const [connectDescription, setConnectDescription] = useState("");
  const [redirectButtonText, setRedirectButtonText] = useState("");
  const [defaultPlatforms, setDefaultPlatforms] = useState("");

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [testState, setTestState] = useState<TestState>({ status: "idle" });

  /* -- Sync from server -------------------------------------------- */
  useEffect(() => {
    if (data?.data) {
      const d = data.data;
      setApiKey("");
      setLogoUrl(d.logoUrl ?? "");
      setConnectTitle(d.connectTitle ?? "");
      setConnectDescription(d.connectDescription ?? "");
      setRedirectButtonText(d.redirectButtonText ?? "");
      setDefaultPlatforms(d.defaultPlatforms ?? "");
      setHasUnsavedChanges(false);
    }
  }, [data]);

  /* -- Track changes ----------------------------------------------- */
  useEffect(() => {
    if (!data?.data) return;
    const d = data.data;
    const changed =
      apiKey !== "" ||
      logoUrl !== (d.logoUrl ?? "") ||
      connectTitle !== (d.connectTitle ?? "") ||
      connectDescription !== (d.connectDescription ?? "") ||
      redirectButtonText !== (d.redirectButtonText ?? "") ||
      defaultPlatforms !== (d.defaultPlatforms ?? "");
    setHasUnsavedChanges(changed);
  }, [apiKey, logoUrl, connectTitle, connectDescription, redirectButtonText, defaultPlatforms, data]);

  /* -- Save -------------------------------------------------------- */
  const handleSave = useCallback(async () => {
    setSaveState({ status: "saving" });
    try {
      const payload: Record<string, unknown> = {
        logoUrl: logoUrl || null,
        connectTitle: connectTitle || null,
        connectDescription: connectDescription || null,
        redirectButtonText: redirectButtonText || null,
        defaultPlatforms: defaultPlatforms || null,
      };
      if (apiKey.trim()) {
        payload.apiKey = apiKey.trim();
      }

      const res = await fetch("/api/admin/settings/upload-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `Save failed (${res.status})`);
      }

      await mutate();
      setSaveState({ status: "success", message: "Settings saved" });
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveState({ status: "idle" }), 3000);
    } catch (err) {
      setSaveState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to save",
      });
    }
  }, [apiKey, logoUrl, connectTitle, connectDescription, redirectButtonText, defaultPlatforms, mutate]);

  /* -- Test connection ---------------------------------------------- */
  const handleTest = useCallback(async () => {
    setTestState({ status: "testing" });
    try {
      const res = await fetch("/api/admin/upload-post/smoke", {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));

      if (body.ok) {
        setTestState({ status: "success", message: body.message ?? "Connection successful." });
      } else {
        const detail = body.hint ? ` (${body.hint})` : "";
        setTestState({
          status: "error",
          message: (body.message ?? `HTTP ${res.status}`) + detail,
        });
      }
      setTimeout(() => setTestState({ status: "idle" }), 6000);
    } catch (err) {
      setTestState({
        status: "error",
        message: err instanceof Error ? err.message : "Test failed",
      });
      setTimeout(() => setTestState({ status: "idle" }), 6000);
    }
  }, []);

  /* -- Keyboard shortcut ------------------------------------------- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges && saveState.status !== "saving") {
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasUnsavedChanges, saveState.status, handleSave]);

  /* -- Input helper ------------------------------------------------ */
  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";

  /* -- Render ------------------------------------------------------ */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        <span className="ml-2 text-sm text-zinc-500">Loading settings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        <div className="text-sm text-red-700">
          <strong>Failed to load:</strong> {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info notice */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <div className="text-xs leading-relaxed text-blue-800">
          <strong>About this integration:</strong> Configure the connection to
          the social account connector. The API key is stored securely in the
          database and is never exposed to the client. Branding fields control
          how the connect page appears to users.
        </div>
      </div>

      {/* ── API Key card ─────────────────────────────────────────── */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900">
          API Connection
        </h3>

        {/* API Key */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1.5">
            API Key
          </label>
          <div className="flex gap-2">
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className={`${inputClass} flex-1 font-mono`}
              placeholder={
                data?.data.hasApiKey
                  ? "Key saved — enter new key to replace"
                  : "Enter your API key"
              }
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="px-3 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors shrink-0"
              aria-label={showApiKey ? "Hide API key" : "Show API key"}
            >
              {showApiKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {data?.data.hasApiKey && !apiKey && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>API key is saved. Leave blank to keep current key.</span>
            </div>
          )}
          {!data?.data.hasApiKey && !apiKey && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                No API key configured. Social account connection will not work.
              </span>
            </div>
          )}
        </div>

        {/* Test Connection */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={testState.status === "testing"}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            {testState.status === "testing" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                Test Connection
              </>
            )}
          </button>

          {testState.status === "success" && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {testState.message}
            </span>
          )}
          {testState.status === "error" && (
            <span className="flex items-center gap-1.5 text-xs text-red-600">
              <WifiOff className="w-3.5 h-3.5" />
              {testState.message}
            </span>
          )}
        </div>
      </div>

      {/* ── Branding fields ──────────────────────────────────────── */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-900">
          Connect Page Branding
        </h3>

        {/* Logo URL */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1.5">
            Logo URL
          </label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className={inputClass}
            placeholder="https://example.com/logo.png"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Displayed on the social connect page. Leave blank for default.
          </p>
        </div>

        {/* Connect Title */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1.5">
            Connect Title
          </label>
          <input
            type="text"
            value={connectTitle}
            onChange={(e) => setConnectTitle(e.target.value)}
            className={inputClass}
            placeholder="Connect Social Accounts"
          />
        </div>

        {/* Connect Description */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1.5">
            Connect Description
          </label>
          <textarea
            value={connectDescription}
            onChange={(e) => setConnectDescription(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y`}
            placeholder="Link your social media accounts to enable publishing."
          />
        </div>

        {/* Redirect Button Text */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1.5">
            Redirect Button Text
          </label>
          <input
            type="text"
            value={redirectButtonText}
            onChange={(e) => setRedirectButtonText(e.target.value)}
            className={inputClass}
            placeholder="Connect Accounts"
          />
        </div>

        {/* Default Platforms */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1.5">
            Default Platforms
          </label>
          <input
            type="text"
            value={defaultPlatforms}
            onChange={(e) => setDefaultPlatforms(e.target.value)}
            className={inputClass}
            placeholder="instagram, facebook, tiktok"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Comma-separated list of platforms to pre-select for users.
          </p>
        </div>
      </div>

      {/* ── Action bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-zinc-200">
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && saveState.status === "idle" && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              Unsaved changes
            </span>
          )}
          {saveState.status === "success" && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              {saveState.message}
            </span>
          )}
          {saveState.status === "error" && (
            <span className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle className="w-4 h-4" />
              {saveState.message}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!hasUnsavedChanges || saveState.status === "saving"}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveState.status === "saving" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Settings
            </>
          )}
        </button>
      </div>

      {/* Keyboard shortcut hint */}
      <div className="flex items-center gap-2 text-xs text-zinc-400 pt-2">
        <kbd className="px-2 py-1 rounded bg-zinc-100 border border-zinc-200 font-mono text-zinc-600">
          Ctrl + S
        </kbd>
        <span>to save</span>
      </div>
    </div>
  );
}
