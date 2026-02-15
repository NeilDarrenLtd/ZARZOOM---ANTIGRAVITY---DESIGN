"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Plus, Key, Terminal, ExternalLink } from "lucide-react";
import { ApiKeyRow, type ApiKeyItem } from "@/components/dashboard/api-key-row";
import { CreateKeyModal } from "@/components/dashboard/create-key-modal";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Fetcher                                                            */
/* ------------------------------------------------------------------ */

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ApiKeysPage() {
  const { data, error, isLoading, mutate } = useSWR<{ keys: ApiKeyItem[] }>(
    "/api/v1/api-keys",
    fetcher
  );

  const [showCreate, setShowCreate] = useState(false);
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [rotateName, setRotateName] = useState("");

  const keys = data?.keys ?? [];
  const activeKeys = keys.filter((k) => k.status === "active");
  const revokedKeys = keys.filter((k) => k.status === "revoked");

  /* -- Revoke handler -------------------------------------------- */
  const handleRevoke = useCallback(
    async (keyId: string) => {
      const res = await fetch("/api/v1/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: keyId }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message ?? "Revoke failed");
      }

      await mutate();
    },
    [mutate]
  );

  /* -- Rotate handler: revoke old, then open create modal -------- */
  const handleRotate = useCallback(
    async (keyId: string, name: string) => {
      await handleRevoke(keyId);
      setRotateName(name);
      setShowRotateModal(true);
    },
    [handleRevoke]
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            API Keys
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-neutral-500">
            Create and manage API keys to authenticate with the ZARZOOM API.
          </p>
        </div>

        <button
          onClick={() => {
            setRotateName("");
            setShowCreate(true);
          }}
          className="mt-4 flex items-center gap-2 self-start rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 sm:mt-0 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Create Key
        </button>
      </div>

      {/* Usage callout */}
      <div className="mt-8 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Terminal className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neutral-900">
              How to call the API
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
              Include your API key as a Bearer token in the Authorization header:
            </p>
            <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white p-3">
              <pre className="text-xs leading-relaxed text-neutral-700">
                <code>{`curl -X POST https://your-domain.com/api/v1/images/generate \\
  -H "Authorization: Bearer zarz_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "A futuristic cityscape"}'`}</code>
              </pre>
            </div>
            <a
              href="/docs/api"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700"
            >
              View full API documentation
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Keys list */}
      <div className="mt-8">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-emerald-600" />
            <span className="ml-3 text-sm text-neutral-500">Loading keys...</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-600">
              Failed to load API keys. Please try refreshing the page.
            </p>
          </div>
        )}

        {!isLoading && !error && keys.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
              <Key className="h-7 w-7 text-neutral-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-neutral-900">
              No API keys yet
            </h3>
            <p className="mt-1 max-w-sm text-center text-sm leading-relaxed text-neutral-500">
              Create your first API key to start making requests to the ZARZOOM API.
            </p>
            <button
              onClick={() => {
                setRotateName("");
                setShowCreate(true);
              }}
              className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Create Your First Key
            </button>
          </div>
        )}

        {!isLoading && !error && keys.length > 0 && (
          <div className="flex flex-col gap-6">
            {/* Active keys */}
            {activeKeys.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
                  Active Keys ({activeKeys.length})
                </h2>
                <div className="flex flex-col gap-3">
                  {activeKeys.map((k) => (
                    <ApiKeyRow
                      key={k.id}
                      apiKey={k}
                      onRevoke={handleRevoke}
                      onRotate={handleRotate}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Revoked keys */}
            {revokedKeys.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
                  Revoked Keys ({revokedKeys.length})
                </h2>
                <div className="flex flex-col gap-3">
                  {revokedKeys.map((k) => (
                    <ApiKeyRow
                      key={k.id}
                      apiKey={k}
                      onRevoke={handleRevoke}
                      onRotate={handleRotate}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create / Rotate modal */}
      <CreateKeyModal
        open={showCreate || showRotateModal}
        onClose={() => {
          setShowCreate(false);
          setShowRotateModal(false);
          setRotateName("");
        }}
        onCreated={() => mutate()}
      />
    </div>
  );
}
