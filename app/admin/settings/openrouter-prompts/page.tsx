"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, Info, RotateCcw, Save } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PromptSettings {
  website_prompt: string | null;
  file_prompt: string | null;
  feature_enabled: boolean;
  openrouter_api_key: string | null;
  openrouter_model: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

interface SaveState {
  status: "idle" | "saving" | "success" | "error";
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
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function OpenRouterPromptsPage() {
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<{ data: PromptSettings }>(
    "/api/v1/admin/settings/openrouter-prompts",
    fetcher
  );

  const [websitePrompt, setWebsitePrompt] = useState("");
  const [filePrompt, setFilePrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [resetState, setResetState] = useState<"idle" | "confirming">("idle");
  const [isResetting, setIsResetting] = useState(false);

  // Sync form state when data loads
  useEffect(() => {
    if (data?.data) {
      setWebsitePrompt(data.data.website_prompt ?? "");
      setFilePrompt(data.data.file_prompt ?? "");
      setApiKey(data.data.openrouter_api_key ?? "");
      setModel(data.data.openrouter_model ?? "openai/gpt-4o-mini");
      setHasUnsavedChanges(false);
    }
  }, [data]);

  // Track unsaved changes
  useEffect(() => {
    if (!data?.data) return;
    
    const changed =
      websitePrompt !== (data.data.website_prompt ?? "") ||
      filePrompt !== (data.data.file_prompt ?? "") ||
      apiKey !== (data.data.openrouter_api_key ?? "") ||
      model !== (data.data.openrouter_model ?? "openai/gpt-4o-mini");
    
    setHasUnsavedChanges(changed);
  }, [websitePrompt, filePrompt, apiKey, model, data]);

  /* -- Save handler ---------------------------------------------- */
  const handleSave = useCallback(async () => {
    setSaveState({ status: "saving" });

    try {
      const res = await fetch("/api/v1/admin/settings/openrouter-prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_prompt: websitePrompt || null,
          file_prompt: filePrompt || null,
          openrouter_api_key: apiKey || null,
          openrouter_model: model || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `Save failed (${res.status})`);
      }

      await mutate();
      setSaveState({ status: "success", message: "Prompts saved successfully" });
      setHasUnsavedChanges(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveState({ status: "idle" });
      }, 3000);
    } catch (err) {
      setSaveState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to save prompts",
      });
    }
  }, [websitePrompt, filePrompt, mutate]);

  /* -- Reset handler --------------------------------------------- */
  const handleReset = useCallback(async () => {
    if (resetState === "idle") {
      setResetState("confirming");
      return;
    }

    if (resetState === "confirming") {
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
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSaveState({ status: "idle" });
        }, 3000);
      } catch (err) {
        setResetState("idle");
        setSaveState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to reset prompts",
        });
      } finally {
        setIsResetting(false);
      }
    }
  }, [resetState, mutate]);

  /* -- Cancel reset ---------------------------------------------- */
  const handleCancelReset = useCallback(() => {
    setResetState("idle");
  }, []);

  /* -- Keyboard shortcut ----------------------------------------- */
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

  /* -- Format timestamp ------------------------------------------ */
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
          <strong>About these prompts:</strong> These prompts are sent to OpenRouter when users click "Auto-fill from website" or "Analyse file" in the onboarding wizard. The AI will extract brand information based on your instructions. The OpenRouter API key should be set as an environment variable.
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          <span className="ml-2 text-sm text-zinc-500">
            Loading prompts...
          </span>
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
                <span className="text-zinc-400">• User ID: {data.data.updated_by.slice(0, 8)}...</span>
              )}
            </div>
          )}

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
                  placeholder="sk-or-v1-..."
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
                . This key is stored securely in the database and used server-side only.
              </p>
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Model
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="openai/gpt-4o-mini"
              />
              <p className="text-xs text-zinc-500 mt-1.5">
                The OpenRouter model identifier (e.g. <code className="bg-zinc-100 px-1 rounded text-[11px]">openai/gpt-4o-mini</code>,{" "}
                <code className="bg-zinc-100 px-1 rounded text-[11px]">anthropic/claude-3.5-sonnet</code>).
                See{" "}
                <a
                  href="https://openrouter.ai/models"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-700 underline"
                >
                  openrouter.ai/models
                </a>{" "}
                for available models.
              </p>
            </div>
          </div>

          {/* Website Prompt */}
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-2">
              Website Investigation Prompt
            </label>
            <textarea
              value={websitePrompt}
              onChange={(e) => setWebsitePrompt(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 rounded-lg border border-zinc-200 bg-white text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
              placeholder="Enter the prompt for website analysis..."
            />
            <p className="text-xs text-zinc-500 mt-2">
              This prompt is used when users provide a website URL. It should instruct the AI to extract business name, description, colors, and article styles from the website content.
            </p>
          </div>

          {/* File Prompt */}
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-2">
              File Investigation Prompt
            </label>
            <textarea
              value={filePrompt}
              onChange={(e) => setFilePrompt(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 rounded-lg border border-zinc-200 bg-white text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
              placeholder="Enter the prompt for file analysis..."
            />
            <p className="text-xs text-zinc-500 mt-2">
              This prompt is used when users upload a PDF or Word document. It should instruct the AI to extract business information from the document content.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-zinc-200">
            <div className="flex items-center gap-3">
              {/* Reset button */}
              {resetState === "idle" && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to defaults
                </button>
              )}

              {/* Confirm reset */}
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

            {/* Save button */}
            <div className="flex items-center gap-3">
              {/* Unsaved changes indicator */}
              {hasUnsavedChanges && saveState.status === "idle" && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                  Unsaved changes
                </span>
              )}

              {/* Status messages */}
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
    </div>
  );
}
