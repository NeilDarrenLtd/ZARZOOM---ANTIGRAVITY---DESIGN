"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useWorkspaceFetch, useActiveWorkspace } from "@/lib/workspace/context";
import { createClient } from "@/lib/supabase/client";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import DynamicSEO from "@/components/DynamicSEO";
import Link from "next/link";
import { User, Settings, Link2, Rocket, LogOut, RotateCcw, HelpCircle, Plus, Building2, Check, AlertCircle } from "lucide-react";
import { useUploadPostSuccess } from "@/hooks/use-upload-post-success";
import UploadPostSuccessBanner from "@/components/ui/UploadPostSuccessBanner";
import WorkspaceSwitcher, { type Workspace } from "@/components/dashboard/WorkspaceSwitcher";


export default function DashboardPage() {
  const { t } = useI18n();
  const workspaceFetch = useWorkspaceFetch();
  const activeWorkspaceId = useActiveWorkspace();
  const [user, setUser] = useState<{ email?: string; created_at?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(activeWorkspaceId);
  const showSuccessBanner = useUploadPostSuccess();

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await workspaceFetch("/api/v1/workspaces");
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces ?? []);
      }
    } catch {
      // silently fail — workspaces panel will be empty
    }
  }, [workspaceFetch]);

  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser({ email: user.email, created_at: user.created_at });
      }
      setLoading(false);
    }
    getUser();
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Keep currentWorkspaceId in sync with context
  useEffect(() => {
    if (activeWorkspaceId) setCurrentWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId]);

  async function handleSwitchWorkspace(workspaceId: string) {
    if (workspaceId === currentWorkspaceId) return;
    try {
      const res = await workspaceFetch("/api/v1/workspace/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
        return;
      }
    } catch {
      // fallback: set cookie client-side and reload
    }
    setCurrentWorkspaceId(workspaceId);
    document.cookie = `active_workspace_id=${workspaceId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.href = "/dashboard";
  }

  async function handleAddWorkspace() {
    try {
      const res = await workspaceFetch("/api/v1/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Workspace" }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
        return;
      }
    } catch {
      // fallback
    }
    window.location.href = "/dashboard";
  }



  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function handleRestartOnboarding() {
    setRestarting(true);
    try {
      const res = await workspaceFetch("/api/v1/onboarding/restart", { method: "POST" });
      if (res.ok) {
        window.location.href = "/onboarding";
      } else {
        setRestarting(false);
      }
    } catch {
      setRestarting(false);
    }
  }

  if (loading) {
    return (
      <main className="bg-gray-50 min-h-screen flex flex-col">
        <SiteNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <UploadPostSuccessBanner show={showSuccessBanner} />
      <DynamicSEO />
      <SiteNavbar />

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">
        {/* Welcome header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t("dashboard.title")}
            </h1>
            <p className="text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
              {t("dashboard.welcome")},{" "}
              <span className="text-green-600 font-medium">
                {user?.email ?? ""}
              </span>
              <button
                onClick={handleAddWorkspace}
                title="Add workspace"
                aria-label="Add workspace"
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 hover:bg-green-200 text-green-700 transition-colors flex-shrink-0"
              >
                <Plus className="w-3 h-3" />
              </button>
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t("nav.logout")}
          </button>
        </div>

        {/* Dashboard cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Workspace switcher card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:col-span-2 lg:col-span-3">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Workspaces</h2>
              </div>
              <button
                onClick={handleAddWorkspace}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-green-400 text-sm font-medium text-green-600 hover:bg-green-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Workspace
              </button>
            </div>

            {workspaces.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                No workspaces found. Click &quot;Add Workspace&quot; to get started.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {workspaces.map((ws) => {
                  const isActive = ws.id === currentWorkspaceId;
                  const statusColors: Record<string, string> = {
                    active: "bg-green-100 text-green-700",
                    setup_incomplete: "bg-amber-100 text-amber-700",
                    payment_required: "bg-red-100 text-red-700",
                  };
                  const statusLabels: Record<string, string> = {
                    active: "Active",
                    setup_incomplete: "Setup incomplete",
                    payment_required: "Payment required",
                  };
                  const StatusIcon = ws.status === "active" ? Check : AlertCircle;

                  return (
                    <button
                      key={ws.id}
                      onClick={() => handleSwitchWorkspace(ws.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                        isActive
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isActive ? "bg-green-600" : "bg-gray-100"
                        }`}
                      >
                        <Building2
                          className={`w-4 h-4 ${isActive ? "text-white" : "text-gray-500"}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${isActive ? "text-green-700" : "text-gray-900"}`}>
                          {ws.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusColors[ws.status] ?? "bg-gray-100 text-gray-600"}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusLabels[ws.status] ?? ws.status}
                          </span>
                          {ws.role && (
                            <span className="text-[10px] text-gray-400 capitalize">{ws.role}</span>
                          )}
                        </div>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-green-500 flex-shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Account settings card */}
          <Link
            href="/dashboard/profile"
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:border-green-300 hover:shadow-md transition-all block"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Settings className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {t("dashboard.profile")}
              </h2>
            </div>
            <div className="flex flex-col gap-2 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>{user?.email}</span>
              </div>
              {user?.created_at && (
                <p>
                  {t("dashboard.memberSince")}{" "}
                  {new Date(user.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </Link>

          {/* Connected accounts card */}
          <Link
            href="/dashboard/connect-accounts?returnTo=/dashboard"
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:border-purple-300 hover:shadow-md transition-all block"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Link2 className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {t("dashboard.connectedAccounts")}
              </h2>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {t("dashboard.comingSoon")}
            </p>
          </Link>

          {/* Support card */}
          <Link
            href="/dashboard/support"
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:border-green-300 hover:shadow-md transition-all block"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {t("support.nav.title")}
              </h2>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {t("dashboard.supportDescription")}
            </p>
          </Link>
        </div>

        {/* Quick links */}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={handleRestartOnboarding}
            disabled={restarting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${restarting ? "animate-spin" : ""}`} />
            {restarting ? t("dashboard.restarting") : t("dashboard.restartSetup")}
          </button>
          <Link
            href="/support"
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
          >
            {t("nav.support")}
          </Link>
          <Link
            href="/privacy"
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
          >
            {t("nav.privacy")}
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  );
}
