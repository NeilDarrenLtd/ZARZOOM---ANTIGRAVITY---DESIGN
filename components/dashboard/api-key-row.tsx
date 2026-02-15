"use client";

import { useState, useCallback } from "react";
import { Key, Trash2, RotateCcw, Clock, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  scopes: Record<string, unknown>;
  created_at: string;
  last_used_at: string | null;
  status: "active" | "revoked";
  revoked_at: string | null;
}

interface ApiKeyRowProps {
  apiKey: ApiKeyItem;
  onRevoke: (keyId: string) => Promise<void>;
  onRotate: (keyId: string, name: string) => Promise<void>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ApiKeyRow({ apiKey, onRevoke, onRotate }: ApiKeyRowProps) {
  const [confirming, setConfirming] = useState<"revoke" | "rotate" | null>(null);
  const [loading, setLoading] = useState(false);
  const isActive = apiKey.status === "active";

  const handleRevoke = useCallback(async () => {
    setLoading(true);
    try {
      await onRevoke(apiKey.id);
    } finally {
      setLoading(false);
      setConfirming(null);
    }
  }, [apiKey.id, onRevoke]);

  const handleRotate = useCallback(async () => {
    setLoading(true);
    try {
      await onRotate(apiKey.id, apiKey.name);
    } finally {
      setLoading(false);
      setConfirming(null);
    }
  }, [apiKey.id, apiKey.name, onRotate]);

  return (
    <div
      className={cn(
        "rounded-lg border px-5 py-4 transition-colors",
        isActive
          ? "border-neutral-200 bg-white"
          : "border-neutral-100 bg-neutral-50 opacity-75"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Key info */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
              isActive ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-400"
            )}
          >
            <Key className="h-4.5 w-4.5" />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-neutral-900">{apiKey.name}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-neutral-100 text-neutral-500"
                )}
              >
                {isActive ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {isActive ? "Active" : "Revoked"}
              </span>
            </div>

            <code className="text-xs text-neutral-500 font-mono">
              {apiKey.prefix}{"****"}
            </code>

            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Created {formatDate(apiKey.created_at)}
              </span>
              {apiKey.last_used_at && (
                <span>Last used {formatDateTime(apiKey.last_used_at)}</span>
              )}
              {apiKey.revoked_at && (
                <span>Revoked {formatDate(apiKey.revoked_at)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        {isActive && (
          <div className="flex flex-shrink-0 items-center gap-2">
            {confirming === null && (
              <>
                <button
                  onClick={() => setConfirming("rotate")}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                  title="Rotate: revoke this key and create a new one"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Rotate
                </button>
                <button
                  onClick={() => setConfirming("revoke")}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Revoke
                </button>
              </>
            )}

            {confirming === "revoke" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Revoke this key?</span>
                <button
                  onClick={handleRevoke}
                  disabled={loading}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? "Revoking..." : "Confirm"}
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  disabled={loading}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}

            {confirming === "rotate" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-600 font-medium">Rotate key?</span>
                <button
                  onClick={handleRotate}
                  disabled={loading}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                >
                  {loading ? "Rotating..." : "Confirm"}
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  disabled={loading}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
