"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Globe,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Play,
  Terminal,
  RefreshCw,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PromptSettings {
  website_prompt: string | null;
  file_prompt: string | null;
  social_profile_prompt: string | null;
  feature_enabled: boolean;
  openrouter_api_key: string | null;
  openrouter_api_key_set: boolean;
  openrouter_model: string | null;
  website_model: string | null;
  file_model: string | null;
  social_profile_model: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

const FALLBACK_MODEL = "openai/gpt-4.1-mini";

const MODELS_CACHE_KEY = "zarzoom_openrouter_models";
const MODELS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedModelEntry {
  id: string;
  name: string;
}

function loadCachedModels(): CachedModelEntry[] | null {
  try {
    const raw = localStorage.getItem(MODELS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > MODELS_CACHE_TTL_MS) {
      localStorage.removeItem(MODELS_CACHE_KEY);
      return null;
    }
    return parsed.models as CachedModelEntry[];
  } catch {
    return null;
  }
}

function saveCachedModels(models: CachedModelEntry[]) {
  try {
    localStorage.setItem(
      MODELS_CACHE_KEY,
      JSON.stringify({ models, ts: Date.now() })
    );
  } catch {
    // localStorage full or unavailable
  }
}

interface SaveState {
  status: "idle" | "saving" | "success" | "error";
  message?: string;
}

interface AuditEntry {
  id: string;
  user_id: string;
  user_email?: string | null;
  source_type: "website" | "file" | "social_profile";
  source_identifier: string;
  status: string;
  error_message: string | null;
  fields_populated: number;
  confidence_scores: Record<string, number> | null;
  debug_data: Record<string, unknown> | null;
  created_at: string;
}

interface AuditPagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
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
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function OpenRouterPromptsPage() {
  const { data, error, isLoading, mutate } = useSWR<{ data: PromptSettings }>(
    "/api/v1/admin/settings/openrouter-prompts",
    fetcher
  );

  const [websitePrompt, setWebsitePrompt] = useState("");
  const [filePrompt, setFilePrompt] = useState("");
  const [socialProfilePrompt, setSocialProfilePrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [model, setModel] = useState(FALLBACK_MODEL);
  const [websiteModel, setWebsiteModel] = useState("");
  const [fileModel, setFileModel] = useState("");
  const [socialProfileModel, setSocialProfileModel] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [resetState, setResetState] = useState<"idle" | "confirming">("idle");
  const [isResetting, setIsResetting] = useState(false);

  // Model list state
  const [modelList, setModelList] = useState<CachedModelEntry[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelListError, setModelListError] = useState<string | null>(null);

  // Load cached models on mount
  useEffect(() => {
    const cached = loadCachedModels();
    if (cached) setModelList(cached);
  }, []);

  const handleRefreshModels = useCallback(async () => {
    setIsLoadingModels(true);
    setModelListError(null);
    try {
      const res = await fetch("/api/v1/admin/openrouter/models");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `Failed to fetch models (${res.status})`);
      }
      const body = await res.json();
      const models: CachedModelEntry[] = (body.data ?? []).map(
        (m: { id: string; name: string }) => ({ id: m.id, name: m.name })
      );
      setModelList(models);
      saveCachedModels(models);
    } catch (err) {
      setModelListError(
        err instanceof Error ? err.message : "Failed to fetch models"
      );
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  // Sync form state when data loads
  useEffect(() => {
    if (data?.data) {
      setWebsitePrompt(data.data.website_prompt ?? "");
      setFilePrompt(data.data.file_prompt ?? "");
      setSocialProfilePrompt(data.data.social_profile_prompt ?? "");
      setApiKey("");
      setApiKeySet(data.data.openrouter_api_key_set ?? false);
      setModel(data.data.openrouter_model ?? FALLBACK_MODEL);
      setWebsiteModel(data.data.website_model ?? "");
      setFileModel(data.data.file_model ?? "");
      setSocialProfileModel(data.data.social_profile_model ?? "");
      setHasUnsavedChanges(false);
    }
  }, [data]);

  // Track unsaved changes
  useEffect(() => {
    if (!data?.data) return;
    const changed =
      websitePrompt !== (data.data.website_prompt ?? "") ||
      filePrompt !== (data.data.file_prompt ?? "") ||
      socialProfilePrompt !== (data.data.social_profile_prompt ?? "") ||
      apiKey !== "" ||
      model !== (data.data.openrouter_model ?? FALLBACK_MODEL) ||
      websiteModel !== (data.data.website_model ?? "") ||
      fileModel !== (data.data.file_model ?? "") ||
      socialProfileModel !== (data.data.social_profile_model ?? "");
    setHasUnsavedChanges(changed);
  }, [websitePrompt, filePrompt, socialProfilePrompt, apiKey, model, websiteModel, fileModel, socialProfileModel, data]);

  /* -- Save handler ---------------------------------------------- */
  const handleSave = useCallback(async () => {
    setSaveState({ status: "saving" });
    try {
      const payload: Record<string, unknown> = {
        website_prompt: websitePrompt || null,
        file_prompt: filePrompt || null,
        social_profile_prompt: socialProfilePrompt || null,
        openrouter_model: model || null,
        website_model: websiteModel || null,
        file_model: fileModel || null,
        social_profile_model: socialProfileModel || null,
      };
      if (apiKey.trim()) {
        payload.openrouter_api_key = apiKey.trim();
      }

      const res = await fetch("/api/v1/admin/settings/openrouter-prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `Save failed (${res.status})`);
      }

      await mutate();
      setSaveState({ status: "success", message: "Settings saved successfully" });
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveState({ status: "idle" }), 3000);
    } catch (err) {
      setSaveState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to save settings",
      });
    }
  }, [websitePrompt, filePrompt, socialProfilePrompt, apiKey, model, websiteModel, fileModel, socialProfileModel, mutate]);

  /* -- Reset handler --------------------------------------------- */
  const handleReset = useCallback(async () => {
    if (resetState === "idle") {
      setResetState("confirming");
      return;
    }
    setIsResetting(true);
    try {
      const res = await fetch("/api/v1/admin/settings/openrouter-prompts/reset", {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `Reset failed (${res.status})`);
      }
      await mutate();
      setResetState("idle");
      setSaveState({ status: "success", message: "Prompts reset to defaults" });
      setTimeout(() => setSaveState({ status: "idle" }), 3000);
    } catch (err) {
      setResetState("idle");
      setSaveState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to reset prompts",
      });
    } finally {
      setIsResetting(false);
    }
  }, [resetState, mutate]);

  const handleCancelReset = useCallback(() => setResetState("idle"), []);

  /* -- Keyboard shortcut ----------------------------------------- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges && saveState.status !== "saving") handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasUnsavedChanges, saveState.status, handleSave]);

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));
  };

  /* -- Render ---------------------------------------------------- */
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">OpenRouter Prompts</h1>
            <p className="text-sm text-zinc-500">
              Configure AI prompts for wizard auto-fill feature
            </p>
          </div>
        </div>
      </div>

      {/* Info notice */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <div className="text-xs leading-relaxed text-blue-800">
          <strong>About these prompts:</strong> These prompts are sent to OpenRouter when users click
          "Auto-fill from website", "Analyse file", or "Investigate social profile" in the onboarding
          wizard. Use <code className="bg-blue-100 px-1 rounded">[WEBSITE-URL]</code>,{" "}
          <code className="bg-blue-100 px-1 rounded">[FILE-NAME]</code>, and{" "}
          <code className="bg-blue-100 px-1 rounded">[PROFILE-URL]</code> as variable placeholders.
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          <span className="ml-2 text-sm text-zinc-500">Loading prompts...</span>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="text-sm text-red-700">
            <strong>Failed to load:</strong> {error.message}
          </div>
        </div>
      )}

      {/* Form */}
      {data && !isLoading && (
        <div className="space-y-6">
          {/* Last updated info */}
          {data.data.updated_at && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Last updated: {formatTimestamp(data.data.updated_at)}</span>
              {data.data.updated_by && (
                <span className="text-zinc-400">
                  • User ID: {data.data.updated_by.slice(0, 8)}...
                </span>
              )}
            </div>
          )}

          {/* Refresh Models Button — top-level */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefreshModels}
              disabled={isLoadingModels}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isLoadingModels ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh Models
            </button>
            {modelList.length > 0 && (
              <span className="text-xs text-green-600">
                {modelList.length} models loaded
              </span>
            )}
            {modelList.length === 0 && !isLoadingModels && (
              <span className="text-xs text-zinc-500">
                Click to fetch available models from OpenRouter
              </span>
            )}
            {modelListError && (
              <span className="text-xs text-red-600">{modelListError}</span>
            )}
          </div>

          {/* OpenRouter Configuration Card */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900">OpenRouter Configuration</h3>

            {/* API Key */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                OpenRouter API Key
              </label>
              <div className="flex gap-2">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder={apiKeySet ? "Key is saved — enter new key to replace" : "sk-or-v1-..."}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-3 py-2 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors shrink-0"
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
              </div>
              {apiKeySet && !apiKey && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>API key is saved and active. Leave blank to keep current key.</span>
                </div>
              )}
              {!apiKeySet && !apiKey && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>No API key configured. Auto-fill features will not work until a key is saved.</span>
                </div>
              )}
              <p className="text-xs text-zinc-500 mt-1.5">
                Your OpenRouter API key. Get one at{" "}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-700 underline"
                >
                  openrouter.ai/keys
                </a>
                . Stored securely in the database and used server-side only.
              </p>
            </div>

            {/* Default / Fallback Model */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Default Model (fallback)
              </label>
              <ModelSelect
                value={model}
                onChange={setModel}
                modelList={modelList}
                placeholder={`Global default (${FALLBACK_MODEL})`}
              />
              <p className="text-xs text-zinc-500 mt-1.5">
                Used when no per-prompt model override is set. Falls back to <code className="bg-zinc-100 px-1 rounded">{FALLBACK_MODEL}</code> if empty.
              </p>
            </div>
          </div>

          {/* ── Prompt Slots ──────────────────────────────────────────── */}

          {/* Website Prompt */}
          <PromptSlot
            icon={<Globe className="w-4 h-4" />}
            label="Website Investigation Prompt"
            promptKey="WEBSITE_INVESTIGATION"
            description={
              <>
                Used when users provide a website URL. Use{" "}
                <code className="bg-zinc-100 px-1 rounded text-[11px]">[WEBSITE-URL]</code> as a
                placeholder for the URL.
              </>
            }
            value={websitePrompt}
            onChange={setWebsitePrompt}
            placeholder="Enter the prompt for website analysis..."
            modelValue={websiteModel}
            onModelChange={setWebsiteModel}
            modelList={modelList}
            defaultModel={model}
          />

          {/* File Prompt */}
          <PromptSlot
            icon={<FileText className="w-4 h-4" />}
            label="File Investigation Prompt"
            promptKey="FILE_INVESTIGATION"
            description={
              <>
                Used when users upload a PDF or Word document. Use{" "}
                <code className="bg-zinc-100 px-1 rounded text-[11px]">[FILE-NAME]</code> as a
                placeholder for the filename.
              </>
            }
            value={filePrompt}
            onChange={setFilePrompt}
            placeholder="Enter the prompt for file analysis..."
            modelValue={fileModel}
            onModelChange={setFileModel}
            modelList={modelList}
            defaultModel={model}
          />

          {/* Social Profile Prompt */}
          <PromptSlot
            icon={<Search className="w-4 h-4" />}
            label="Social Profile Investigation Prompt"
            promptKey="SOCIAL_PROFILE_ANALYZER"
            description={
              <>
                Used when users provide a social media profile URL. Use{" "}
                <code className="bg-zinc-100 px-1 rounded text-[11px]">[PROFILE-URL]</code> as a
                placeholder for the profile URL.
              </>
            }
            value={socialProfilePrompt}
            onChange={setSocialProfilePrompt}
            placeholder="Enter the prompt for social profile analysis..."
            modelValue={socialProfileModel}
            onModelChange={setSocialProfileModel}
            modelList={modelList}
            defaultModel={model}
          />

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-zinc-200">
            <div className="flex items-center gap-3">
              {resetState === "idle" && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to defaults
                </button>
              )}
              {resetState === "confirming" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    disabled={isResetting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isResetting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        Confirm reset
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancelReset}
                    disabled={isResetting}
                    className="px-4 py-2.5 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {hasUnsavedChanges && saveState.status === "idle" && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                  Unsaved changes
                </span>
              )}
              {saveState.status === "success" && (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  {saveState.message}
                </div>
              )}
              {saveState.status === "error" && (
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  {saveState.message}
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges || saveState.status === "saving"}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveState.status === "saving" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save prompts
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Keyboard shortcut hint */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 pt-2">
            <kbd className="px-2 py-1 rounded bg-zinc-100 border border-zinc-200 font-mono text-zinc-600">
              ⌘/Ctrl + S
            </kbd>
            <span>to save</span>
          </div>
        </div>
      )}

      {/* Test Prompt */}
      <TestPromptPanel modelList={modelList} defaultModel={model} />

      {/* Audit Log */}
      <AuditLogViewer />
    </div>
  );
}

/* ================================================================== */
/*  Test Prompt Panel                                                   */
/* ================================================================== */

interface TestResult {
  output: unknown;
  model: string;
  tokensUsed: number;
  durationMs: number;
  success: boolean;
}

interface TestError {
  message: string;
  code?: string;
  statusCode?: number;
}

function TestPromptPanel({
  modelList,
  defaultModel,
}: {
  modelList: CachedModelEntry[];
  defaultModel: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [testModel, setTestModel] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<TestError | null>(null);

  const handleRun = useCallback(async () => {
    if (!prompt.trim()) {
      setError({ message: "Prompt cannot be empty." });
      return;
    }

    setIsRunning(true);
    setResult(null);
    setError(null);

    const resolvedModel = testModel || defaultModel || FALLBACK_MODEL;

    try {
      const res = await fetch("/api/v1/admin/settings/openrouter-prompts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), model: resolvedModel }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError({
          message: body?.error?.message ?? `Request failed (${res.status})`,
          code: body?.error?.code,
          statusCode: body?.error?.statusCode ?? res.status,
        });
        return;
      }

      setResult(body.data as TestResult);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Network error — could not reach the server.",
      });
    } finally {
      setIsRunning(false);
    }
  }, [prompt, testModel, defaultModel]);

  const formatOutput = (data: unknown): string => {
    if (typeof data === "string") return data;
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="mt-8 p-6 rounded-xl bg-white border border-zinc-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <Terminal className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-zinc-900">Test Prompt</h3>
          <p className="text-sm text-zinc-500">
            Send a free-form prompt through the real OpenRouter pipeline and inspect the raw response.
          </p>
        </div>
      </div>

      {/* Model selector */}
      <div className="mb-3">
        <label className="block text-xs text-zinc-500 mb-1">Model</label>
        <ModelSelect
          value={testModel}
          onChange={setTestModel}
          modelList={modelList}
          placeholder={`Use default (${defaultModel || FALLBACK_MODEL})`}
        />
      </div>

      {/* Prompt input */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={10}
        disabled={isRunning}
        className="w-full px-4 py-3 rounded-lg border border-zinc-200 bg-white text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-y disabled:opacity-50 disabled:cursor-not-allowed"
        placeholder="Enter your prompt here... This will be sent as the user message to OpenRouter using the selected model."
      />

      {/* Run button */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleRun}
          disabled={isRunning || !prompt.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run
            </>
          )}
        </button>
        {isRunning && (
          <span className="text-xs text-zinc-500">
            Waiting for OpenRouter response...
          </span>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-4 p-4 rounded-lg border border-red-200 bg-red-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700">Request failed</p>
              <p className="text-sm text-red-600 mt-1">{error.message}</p>
              {(error.code || error.statusCode) && (
                <p className="text-xs text-red-500 mt-1 font-mono">
                  {error.code && <>Code: {error.code}</>}
                  {error.code && error.statusCode && <> &middot; </>}
                  {error.statusCode && <>HTTP {error.statusCode}</>}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Result display */}
      {result && (
        <div className="mt-4 space-y-3">
          {/* Metadata bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              <span className="font-medium text-green-700">Success</span>
            </span>
            <span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
              {result.model}
            </span>
            <span>{result.tokensUsed.toLocaleString()} tokens</span>
            <span>{(result.durationMs / 1000).toFixed(1)}s</span>
          </div>

          {/* Output */}
          <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50">
            <p className="text-xs font-medium text-zinc-500 mb-2">Raw Output</p>
            <pre className="text-sm font-mono text-zinc-800 whitespace-pre-wrap break-words max-h-[600px] overflow-y-auto leading-relaxed">
              {formatOutput(result.output)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  ModelSelect Component                                               */
/* ================================================================== */

interface ModelSelectProps {
  value: string;
  onChange: (v: string) => void;
  modelList: CachedModelEntry[];
  placeholder?: string;
}

function ModelSelect({ value, onChange, modelList, placeholder }: ModelSelectProps) {
  const hasModels = modelList.length > 0;
  const currentInList = hasModels && modelList.some((m) => m.id === value);
  const showSavedCustom = !!value && !currentInList;

  const selectValue = currentInList ? value : showSavedCustom ? "__saved__" : "";

  return (
    <div className="flex-1 flex gap-2">
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__saved__") return;
          onChange(v);
        }}
        className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        <option value="">{placeholder ?? `-- Use default (${FALLBACK_MODEL}) --`}</option>
        {showSavedCustom && (
          <option value="__saved__">{value} (saved)</option>
        )}
        {hasModels ? (
          modelList.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))
        ) : (
          <option disabled>Click Refresh Models to load options</option>
        )}
      </select>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="px-2 py-1 rounded border border-zinc-200 bg-white text-xs text-zinc-500 hover:bg-zinc-50 transition-colors shrink-0"
          title="Clear model selection"
        >
          Clear
        </button>
      )}
    </div>
  );
}

/* ================================================================== */
/*  PromptSlot Component                                               */
/* ================================================================== */

interface PromptSlotProps {
  icon: React.ReactNode;
  label: string;
  promptKey: string;
  description: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  modelValue: string;
  onModelChange: (v: string) => void;
  modelList: CachedModelEntry[];
  defaultModel: string;
}

function PromptSlot({
  icon,
  label,
  promptKey,
  description,
  value,
  onChange,
  placeholder,
  modelValue,
  onModelChange,
  modelList,
  defaultModel,
}: PromptSlotProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-zinc-400">{icon}</span>
        <label className="text-sm font-medium text-zinc-900">{label}</label>
        <code className="text-[10px] font-mono bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200">
          {promptKey}
        </code>
        {modelValue ? (
          <span className="text-[10px] font-mono bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-200">
            {modelValue}
          </span>
        ) : (
          <span className="text-[10px] font-mono bg-zinc-50 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-200">
            default: {defaultModel || FALLBACK_MODEL}
          </span>
        )}
      </div>

      {/* Model selector */}
      <div className="mb-2">
        <label className="block text-xs text-zinc-500 mb-1">Model override</label>
        <ModelSelect
          value={modelValue}
          onChange={onModelChange}
          modelList={modelList}
          placeholder={`Use default (${defaultModel || FALLBACK_MODEL})`}
        />
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={12}
        className="w-full px-4 py-3 rounded-lg border border-zinc-200 bg-white text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
        placeholder={placeholder}
      />
      <p className="text-xs text-zinc-500 mt-2">{description}</p>
    </div>
  );
}

/* ================================================================== */
/*  Audit Log Viewer Component                                         */
/* ================================================================== */

const LIMIT_OPTIONS = [50, 100, 500] as const;
type LimitOption = (typeof LIMIT_OPTIONS)[number];

function AuditLogViewer() {
  const [limit, setLimit] = useState<LimitOption>(50);
  const [offset, setOffset] = useState(0);

  const auditUrl = `/api/v1/admin/settings/openrouter-prompts/audit-log?limit=${limit}&offset=${offset}`;

  const { data, error, isLoading } = useSWR<{
    data: AuditEntry[];
    pagination: AuditPagination;
  }>(auditUrl, (url: string) =>
    fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Failed to load (${r.status})`);
      return r.json();
    })
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reset to first page when limit changes
  const handleLimitChange = (newLimit: LimitOption) => {
    setLimit(newLimit);
    setOffset(0);
    setExpandedId(null);
  };

  const pagination = data?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 0;
  const currentPage = pagination ? Math.floor(pagination.offset / pagination.limit) + 1 : 1;

  const handlePrev = () => {
    setOffset(Math.max(0, offset - limit));
    setExpandedId(null);
  };

  const handleNext = () => {
    if (pagination?.has_more) {
      setOffset(offset + limit);
      setExpandedId(null);
    }
  };

  const sourceIcon = (type: string) => {
    if (type === "website") return <Globe className="w-4 h-4 text-zinc-400 shrink-0" />;
    if (type === "social_profile") return <Search className="w-4 h-4 text-zinc-400 shrink-0" />;
    return <FileText className="w-4 h-4 text-zinc-400 shrink-0" />;
  };

  return (
    <div className="mt-8 p-6 rounded-xl bg-white border border-zinc-200">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900">Auto-fill Audit Log</h3>
          <p className="text-sm text-zinc-500 mt-0.5">
            Auto-fill queries, responses, and usage tracking. Click a row to expand.
          </p>
        </div>

        {/* Row limit dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs text-zinc-500 font-medium whitespace-nowrap">Rows per page</label>
          <select
            value={limit}
            onChange={(e) => handleLimitChange(Number(e.target.value) as LimitOption)}
            className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading audit logs...
        </div>
      )}

      {error && !isLoading && (
        <p className="text-sm text-red-600 py-4">Failed to load audit logs: {error.message}</p>
      )}

      {!isLoading && !error && (
        <>
          {(data?.data ?? []).length === 0 ? (
            <p className="text-sm text-zinc-400 py-4 text-center">No auto-fill runs yet.</p>
          ) : (
            <div className="space-y-2">
              {(data?.data ?? []).map((entry) => {
                const isExpanded = expandedId === entry.id;
                let debugParsed: {
                  promptSent?: string;
                  responseReceived?: string;
                  fieldsExtracted?: Record<string, unknown>;
                } | null = null;
                if (entry.debug_data) {
                  try {
                    debugParsed =
                      typeof entry.debug_data === "string"
                        ? JSON.parse(entry.debug_data)
                        : (entry.debug_data as unknown as typeof debugParsed);
                  } catch {
                    // ignore
                  }
                }

                return (
                  <div key={entry.id} className="border border-zinc-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
                    >
                      {/* Status dot */}
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          entry.status === "success"
                            ? "bg-green-500"
                            : entry.status === "partial"
                            ? "bg-amber-500"
                            : "bg-red-500"
                        }`}
                      />

                      {sourceIcon(entry.source_type)}

                      <span className="text-sm text-zinc-700 truncate flex-1 font-mono">
                        {entry.source_identifier}
                      </span>

                      <span className="text-xs text-zinc-500 shrink-0">
                        {entry.fields_populated} fields
                      </span>

                      <span className="text-xs text-zinc-400 shrink-0 hidden sm:flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {entry.user_email || entry.user_id.slice(0, 8)}
                      </span>

                      <span className="text-xs text-zinc-400 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(entry.created_at).toLocaleString()}
                      </span>

                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-zinc-100 bg-zinc-50 space-y-3">
                        <div className="pt-3 flex items-center gap-2">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded ${
                              entry.status === "success"
                                ? "bg-green-100 text-green-700"
                                : entry.status === "partial"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {entry.status.toUpperCase()}
                          </span>
                          <span className="text-xs text-zinc-500">{entry.source_type} analysis</span>
                        </div>

                        {entry.error_message && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-xs font-medium text-red-700 mb-1">Error</p>
                            <p className="text-xs text-red-600 font-mono whitespace-pre-wrap">
                              {entry.error_message}
                            </p>
                          </div>
                        )}

                        {debugParsed?.promptSent && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs font-medium text-blue-700 mb-1">Prompt Sent</p>
                            <pre className="text-xs text-blue-600 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                              {debugParsed.promptSent}
                            </pre>
                          </div>
                        )}

                        {debugParsed?.responseReceived && (
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-xs font-medium text-green-700 mb-1">AI Response (raw)</p>
                            <pre className="text-xs text-green-600 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                              {debugParsed.responseReceived}
                            </pre>
                          </div>
                        )}

                        {debugParsed?.fieldsExtracted && (
                          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-xs font-medium text-purple-700 mb-1">Fields Extracted</p>
                            <pre className="text-xs text-purple-600 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                              {JSON.stringify(debugParsed.fieldsExtracted, null, 2)}
                            </pre>
                          </div>
                        )}

                        {!debugParsed && (
                          <p className="text-xs text-zinc-400 italic">
                            No debug data available for this run.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination controls */}
          {pagination && pagination.total > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100">
              <p className="text-xs text-zinc-500">
                Showing{" "}
                <strong className="text-zinc-700">
                  {pagination.offset + 1}–
                  {Math.min(pagination.offset + pagination.limit, pagination.total)}
                </strong>{" "}
                of <strong className="text-zinc-700">{pagination.total.toLocaleString()}</strong> entries
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={handlePrev}
                  disabled={offset === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </button>
                <button
                  onClick={handleNext}
                  disabled={!pagination.has_more}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
