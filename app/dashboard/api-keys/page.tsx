"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Plus, Key, Terminal, ExternalLink, Plug, Zap, Lightbulb } from "lucide-react";
import { ApiKeyRow, type ApiKeyItem } from "@/components/dashboard/api-key-row";
import { CreateKeyModal } from "@/components/dashboard/create-key-modal";
import { cn } from "@/lib/utils";
import { useWorkspaceFetch, useWorkspaceFetcher } from "@/lib/workspace/context";

type TabType = "api" | "openclaw" | "skills";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ApiIntegrationsPage() {
  const workspaceFetcher = useWorkspaceFetcher<{ keys: ApiKeyItem[] }>();
  const workspaceFetch = useWorkspaceFetch();
  const { data, error, isLoading, mutate } = useSWR(
    "/api/v1/api-keys",
    workspaceFetcher
  );

  const [activeTab, setActiveTab] = useState<TabType>("api");
  const [showCreate, setShowCreate] = useState(false);
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [rotateName, setRotateName] = useState("");

  const keys = data?.keys ?? [];
  const activeKeys = keys.filter((k) => k.status === "active");
  const revokedKeys = keys.filter((k) => k.status === "revoked");

  /* -- Revoke handler -------------------------------------------- */
  const handleRevoke = useCallback(
    async (keyId: string) => {
      const res = await workspaceFetch("/api/v1/api-keys", {
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
    [mutate, workspaceFetch]
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

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "api", label: "API", icon: <Zap className="h-4 w-4" /> },
    { id: "openclaw", label: "OpenClaw", icon: <Plug className="h-4 w-4" /> },
    { id: "skills", label: "Skills", icon: <Lightbulb className="h-4 w-4" /> },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          API & Integrations
        </h1>
        <p className="mt-2 text-base text-gray-600">
          Manage API access, view integrations, and connect external services to your workspace.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8 border-b border-gray-200">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* API Tab Content */}
      {activeTab === "api" && (
        <div>
          {/* Header with action */}
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">API Keys</h2>
              <p className="mt-1 text-sm text-gray-600">
                Create and manage API keys to authenticate with the ZARZOOM API.
              </p>
            </div>

            <button
              onClick={() => {
                setRotateName("");
                setShowCreate(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Create Key
            </button>
          </div>

          {/* Usage callout */}
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Terminal className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">
                  How to use the API
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Include your API key as a Bearer token in the Authorization header:
                </p>
                <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <pre className="text-xs leading-relaxed text-gray-700">
                    <code>{`curl -X POST https://api.zarzoom.com/v1/images/generate \\
  -H "Authorization: Bearer zarz_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "A futuristic cityscape"}'`}</code>
                  </pre>
                </div>
                <a
                  href="/docs/api"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700"
                >
                  View full API documentation
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Keys list */}
          <div>
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-600" />
                <span className="ml-3 text-sm text-gray-500">Loading keys...</span>
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
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                  <Key className="h-7 w-7 text-gray-400" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-gray-900">
                  No API keys yet
                </h3>
                <p className="mt-1 max-w-sm text-center text-sm text-gray-600">
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
              <div className="space-y-6">
                {/* Active keys */}
                {activeKeys.length > 0 && (
                  <div>
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-700">
                      Active Keys ({activeKeys.length})
                    </h3>
                    <div className="space-y-3">
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
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-700">
                      Revoked Keys ({revokedKeys.length})
                    </h3>
                    <div className="space-y-3">
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
        </div>
      )}

      {/* OpenClaw Tab Content */}
      {activeTab === "openclaw" && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mx-auto">
            <Plug className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">OpenClaw Integration</h3>
          <p className="mt-2 text-gray-600">
            Connect your OpenClaw account to unlock advanced integration features.
          </p>
          <button className="mt-6 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700">
            Connect OpenClaw
          </button>
        </div>
      )}

      {/* Skills Tab Content */}
      {activeTab === "skills" && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mx-auto">
            <Lightbulb className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Skills Management</h3>
          <p className="mt-2 text-gray-600">
            Manage and configure custom skills for your ZARZOOM workspace.
          </p>
          <button className="mt-6 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700">
            Explore Skills
          </button>
        </div>
      )}

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
