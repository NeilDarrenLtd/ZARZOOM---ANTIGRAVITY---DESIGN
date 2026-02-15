"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { ShieldAlert, KeyRound, Loader2, AlertTriangle, Info } from "lucide-react";
import {
  ProviderKeyCard,
  type ProviderKeyData,
} from "@/components/admin/provider-key-card";

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

export default function ProviderKeysPage() {
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<{ providers: ProviderKeyData[] }>(
    "/api/v1/admin/settings/provider-keys",
    fetcher
  );

  /* -- Save handler ---------------------------------------------- */
  const handleSave = useCallback(
    async (providerId: string, values: Record<string, string>) => {
      const body: Record<string, unknown> = { provider: providerId };

      // Determine which field was filled
      if (values.google_vertex_config) {
        try {
          body.google_vertex_config = JSON.parse(values.google_vertex_config);
        } catch {
          throw new Error("Invalid JSON in Vertex config");
        }
      } else {
        // Use the first non-empty string value as api_key
        const apiKeyValue = Object.values(values).find(
          (v) => v.trim().length > 0
        );
        if (!apiKeyValue) throw new Error("A key value is required");
        body.api_key = apiKeyValue;
      }

      const res = await fetch("/api/v1/admin/settings/provider-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err?.error?.message ?? `Save failed (${res.status})`
        );
      }

      // Revalidate the list
      await mutate();
    },
    [mutate]
  );

  /* -- Test handler ---------------------------------------------- */
  const handleTest = useCallback(
    async (
      providerId: string
    ): Promise<{ job_id: string; status_url: string } | null> => {
      const res = await fetch(
        "/api/v1/admin/settings/provider-keys/test",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: providerId }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err?.error?.message ?? `Test failed (${res.status})`
        );
      }

      return res.json();
    },
    []
  );

  /* -- Render ---------------------------------------------------- */
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Provider Keys</h1>
            <p className="text-sm text-zinc-500">
              Manage API keys for external service providers
            </p>
          </div>
        </div>
      </div>

      {/* Security notice */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="text-xs leading-relaxed text-amber-800">
          <strong>Security:</strong> Keys are encrypted server-side using
          AES-256-GCM before storage. Only masked fingerprints are shown in this
          UI. Raw key values are never returned from the API. Every change is
          recorded in the audit log.
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          <span className="ml-2 text-sm text-zinc-500">
            Loading provider keys...
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

      {/* Provider list */}
      {data && !isLoading && (
        <div className="space-y-3">
          {data.providers.map((provider) => (
            <ProviderKeyCard
              key={provider.id}
              provider={provider}
              onSave={handleSave}
              onTest={handleTest}
            />
          ))}
        </div>
      )}

      {/* Encryption strategy note */}
      <div className="mt-8 flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
        <div className="text-xs leading-relaxed text-zinc-500">
          <strong className="text-zinc-600">Encryption strategy:</strong> Keys
          are stored as AES-256-GCM ciphertext using the{" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 font-mono text-zinc-700">
            ENCRYPTION_MASTER_KEY
          </code>{" "}
          environment variable. The database also provides encryption at rest via
          Supabase. Raw key values are never returned from the API -- only masked
          fingerprints (last 4 characters) are exposed to the browser.
        </div>
      </div>
    </div>
  );
}
