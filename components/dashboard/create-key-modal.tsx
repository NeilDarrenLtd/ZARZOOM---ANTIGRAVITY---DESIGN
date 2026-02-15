"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { X, Copy, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateKeyModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

type Step = "form" | "loading" | "reveal";

export function CreateKeyModal({ open, onClose, onCreated }: CreateKeyModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [rawKey, setRawKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && step === "form") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, step]);

  const reset = useCallback(() => {
    setStep("form");
    setName("");
    setRawKey("");
    setCopied(false);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setError(null);
    setStep("loading");

    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `create-key-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStep("form");
        setError(data.error?.message ?? "Failed to create key");
        return;
      }

      setRawKey(data.raw_key);
      setStep("reveal");
      onCreated();
    } catch {
      setStep("form");
      setError("Network error. Please try again.");
    }
  }, [name, onCreated]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = rawKey;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [rawKey]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== "reveal") handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Create API key"
    >
      <div className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            {step === "reveal" ? "Key Created" : "Create API Key"}
          </h2>
          {step !== "reveal" && (
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {step === "form" && (
            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="key-name"
                  className="mb-1.5 block text-sm font-medium text-neutral-700"
                >
                  Key Name
                </label>
                <input
                  ref={inputRef}
                  id="key-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                  placeholder="e.g. Production, Staging, CI/CD"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  maxLength={100}
                />
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>
          )}

          {step === "loading" && (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-emerald-600" />
              <span className="ml-3 text-sm text-neutral-500">
                Generating key...
              </span>
            </div>
          )}

          {step === "reveal" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      Copy your API key now
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-amber-700">
                      This is the only time the full key will be displayed.
                      Store it securely -- you will not be able to see it again.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Your API Key
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 overflow-x-auto rounded-lg border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 font-mono text-sm text-neutral-900">
                    {rawKey}
                  </code>
                  <button
                    onClick={handleCopy}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                      copied
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                    )}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-neutral-100 px-6 py-4">
          {step === "form" && (
            <>
              <button
                onClick={handleClose}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create Key
              </button>
            </>
          )}

          {step === "reveal" && (
            <button
              onClick={handleClose}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
