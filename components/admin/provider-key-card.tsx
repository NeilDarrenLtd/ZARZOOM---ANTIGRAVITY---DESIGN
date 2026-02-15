"use client";

import { useState } from "react";
import {
  Key,
  Eye,
  EyeOff,
  Save,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProviderField {
  name: string;
  type: "string" | "json";
  label: string;
}

export interface ProviderKeyData {
  id: string;
  label: string;
  fields: readonly ProviderField[];
  is_set: boolean;
  masked_key: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

interface ProviderKeyCardProps {
  provider: ProviderKeyData;
  onSave: (
    providerId: string,
    values: Record<string, string>
  ) => Promise<void>;
  onTest: (providerId: string) => Promise<{ job_id: string; status_url: string } | null>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ProviderKeyCard({ provider, onSave, onTest }: ProviderKeyCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(provider.id, fieldValues);
      setIsEditing(false);
      setFieldValues({});
      setShowValue(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(provider.id);
      setTestResult(result ? "success" : "error");
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  }

  function handleFieldChange(fieldName: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  }

  const hasValues = Object.values(fieldValues).some((v) => v.trim().length > 0);

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-200 bg-white p-5 transition-shadow",
        isEditing && "ring-2 ring-emerald-500/20 shadow-sm"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md",
              provider.is_set
                ? "bg-emerald-50 text-emerald-600"
                : "bg-zinc-100 text-zinc-400"
            )}
          >
            <Key className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">{provider.label}</h3>
            {provider.is_set ? (
              <p className="text-xs text-zinc-500">
                <span className="font-mono text-zinc-600">
                  {provider.masked_key}
                </span>
              </p>
            ) : (
              <p className="text-xs text-zinc-400">Not configured</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          {provider.is_set ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
              <XCircle className="h-3 w-3" />
              Missing
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              setIsEditing(!isEditing);
              setSaveError(null);
              setTestResult(null);
            }}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            {isEditing ? "Cancel" : provider.is_set ? "Rotate" : "Configure"}
          </button>
        </div>
      </div>

      {/* Updated at metadata */}
      {provider.updated_at && !isEditing && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
          <Clock className="h-3 w-3" />
          <span>
            Updated{" "}
            {new Date(provider.updated_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}

      {/* Edit form */}
      {isEditing && (
        <div className="mt-4 space-y-3">
          {provider.fields.map((field) => (
            <div key={field.name}>
              <label
                htmlFor={`${provider.id}-${field.name}`}
                className="mb-1 block text-xs font-medium text-zinc-700"
              >
                {field.label}
              </label>
              {field.type === "json" ? (
                <textarea
                  id={`${provider.id}-${field.name}`}
                  rows={6}
                  placeholder={'{\n  "project_id": "...",\n  "location": "...",\n  "credentials": {}\n}'}
                  value={fieldValues[field.name] ?? ""}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              ) : (
                <div className="relative">
                  <input
                    id={`${provider.id}-${field.name}`}
                    type={showValue ? "text" : "password"}
                    placeholder="Enter key value"
                    autoComplete="off"
                    value={fieldValues[field.name] ?? ""}
                    onChange={(e) =>
                      handleFieldChange(field.name, e.target.value)
                    }
                    className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 pr-10 font-mono text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowValue(!showValue)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 transition-colors hover:text-zinc-600"
                    aria-label={showValue ? "Hide value" : "Show value"}
                  >
                    {showValue ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}

          {saveError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {saveError}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={saving || !hasValues}
              onClick={handleSave}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors",
                saving || !hasValues
                  ? "cursor-not-allowed bg-zinc-300"
                  : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Key
            </button>

            {provider.is_set && (
              <button
                type="button"
                disabled={testing}
                onClick={handleTest}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  testing
                    ? "cursor-not-allowed border-zinc-200 text-zinc-400"
                    : testResult === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : testResult === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                )}
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : testResult === "success" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : testResult === "error" ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                {testing
                  ? "Testing..."
                  : testResult === "success"
                    ? "Job Enqueued"
                    : testResult === "error"
                      ? "Failed"
                      : "Test Connection"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
