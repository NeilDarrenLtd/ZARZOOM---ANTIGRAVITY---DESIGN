"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  useWorkspaceFetch,
  useActiveWorkspace,
  useWorkspaceSwitchKey,
} from "@/lib/workspace/context";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace/active";
import { createClient } from "@/lib/supabase/client";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import DynamicSEO from "@/components/DynamicSEO";
import Link from "next/link";
import { User, Settings, Link2, LogOut, RotateCcw, HelpCircle, Plus, Building2, Check, Zap, Trash2, Circle, ChevronRight, BarChart3, CreditCard, CalendarDays, X, CheckCircle } from "lucide-react";
import {
  checkProfileCompleteness,
  type CompletenessResult,
} from "@/lib/workspace/profile-completeness";
import type { OnboardingUpdate } from "@/lib/validation/onboarding";
import { useUploadPostSuccess } from "@/hooks/use-upload-post-success";
import UploadPostSuccessBanner from "@/components/ui/UploadPostSuccessBanner";
import WorkspaceSwitcher, { type Workspace } from "@/components/dashboard/WorkspaceSwitcher";
import WorkspaceAutomationToggle from "@/components/dashboard/WorkspaceAutomationToggle";
import WorkspaceStatusPills from "@/components/dashboard/WorkspaceStatusPills";
import { languages } from "@/lib/i18n";


export default function DashboardPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const workspaceFetch = useWorkspaceFetch();
  const activeWorkspaceId = useActiveWorkspace();
  const workspaceSwitchKey = useWorkspaceSwitchKey();
  const [user, setUser] = useState<{ email?: string; created_at?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [addWorkspaceLoading, setAddWorkspaceLoading] = useState(false);
  const [addWorkspaceError, setAddWorkspaceError] = useState<string | null>(null);
  const [deleteConfirmWorkspace, setDeleteConfirmWorkspace] = useState<Workspace | null>(null);
  const [deleteWorkspaceLoading, setDeleteWorkspaceLoading] = useState(false);
  const [deleteWorkspaceError, setDeleteWorkspaceError] = useState<string | null>(null);
  const [addWorkspaceModalOpen, setAddWorkspaceModalOpen] = useState(false);
  const [addWorkspaceName, setAddWorkspaceName] = useState("Un-Named");
  const showSuccessBanner = useUploadPostSuccess();
  const [profileCompleteness, setProfileCompleteness] = useState<CompletenessResult | null>(null);
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      setShowCheckoutSuccess(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [searchParams]);

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
    // Redirect to pricing to resume pending checkout from pre-auth plan selection
    const pending = sessionStorage.getItem("pendingCheckout");
    if (pending) {
      window.location.href = "/pricing?resumeCheckout=1";
      return;
    }

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

  // Fetch profile completeness for active workspace
  useEffect(() => {
    if (!activeWorkspaceId) {
      setProfileCompleteness(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const res = await workspaceFetch(
          `/api/v1/onboarding?_ws=${encodeURIComponent(activeWorkspaceId)}`
        );
        if (!mounted) return;
        if (!res.ok) return;
        const body = await res.json();
        const data: OnboardingUpdate = body?.data ?? {};
        if (mounted) setProfileCompleteness(checkProfileCompleteness(data));
      } catch {
        if (mounted) setProfileCompleteness(null);
      }
    })();
    return () => { mounted = false; };
  }, [activeWorkspaceId, workspaceFetch]);

  // Reset modal and form state when workspace changes so we don't retain workspace-A state on switch to B
  useEffect(() => {
    setAddWorkspaceModalOpen(false);
    setAddWorkspaceName("Un-Named");
    setDeleteConfirmWorkspace(null);
    setAddWorkspaceError(null);
    setDeleteWorkspaceError(null);
  }, [workspaceSwitchKey]);

  // Ensure a workspace is always selected when workspaces exist.
  // If only one workspace, auto-select it. If multiple but none selected, select the first.
  // Skip while a workspace is being created — otherwise the effect races with the redirect
  // to /onboarding by overwriting the cookie and navigating back to /dashboard.
  useEffect(() => {
    if (addWorkspaceLoading) return;
    if (workspaces.length === 0) return;

    const isCurrentValid = activeWorkspaceId && workspaces.some((w) => w.id === activeWorkspaceId);
    if (isCurrentValid) return;

    const targetId = workspaces[0].id;
    document.cookie = `active_workspace_id=${encodeURIComponent(targetId)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.href = "/dashboard";
  }, [workspaces, activeWorkspaceId, addWorkspaceLoading]);

  async function handleSwitchWorkspace(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) return;
    const cookieValue = `active_workspace_id=${encodeURIComponent(workspaceId)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    try {
      await workspaceFetch("/api/v1/workspace/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
    } catch {
      // non-fatal; cookie switch is enough
    }
    // Set cookie then do a full reload so the server layout re-resolves the workspace
    // and ActiveWorkspaceProvider gets the correct initialActiveWorkspaceId.
    document.cookie = cookieValue;
    window.location.href = "/dashboard";
  }

  async function doCreateWorkspace(name: string, copyFromCurrent: boolean) {
    setAddWorkspaceError(null);
    setAddWorkspaceLoading(true);
    try {
      const body: { name: string; copy_onboarding_from_workspace_id?: string } = { name: name.slice(0, 200) };
      if (copyFromCurrent && activeWorkspaceId) {
        body.copy_onboarding_from_workspace_id = activeWorkspaceId;
      }
      const res = await workspaceFetch("/api/v1/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const newWorkspaceId = (data as { workspace?: { id?: string } })?.workspace?.id;
        if (typeof newWorkspaceId === "string") {
          document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${encodeURIComponent(newWorkspaceId)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
          // Do NOT update React context here — we are about to do a full page redirect.
          // Updating context would trigger the auto-select effect which races with the
          // redirect and overwrites the cookie before the browser can navigate.
        }
        if (copyFromCurrent) {
          window.location.href = "/dashboard/profile";
        } else {
          const q = typeof newWorkspaceId === "string" ? `?workspace=${encodeURIComponent(newWorkspaceId)}` : "";
          window.location.href = `/onboarding${q}`;
        }
        return;
      }
      const message = (data as { error?: { message?: string } })?.error?.message ?? res.statusText ?? "Failed to create workspace";
      setAddWorkspaceError(message);
    } catch {
      setAddWorkspaceError("Network error. Please try again.");
    } finally {
      setAddWorkspaceLoading(false);
    }
  }

  function handleAddWorkspaceClick() {
    setAddWorkspaceError(null);
    setAddWorkspaceName("Un-Named");
    setAddWorkspaceModalOpen(true);
  }

  async function handleAddWorkspaceSubmit(copyFromCurrent: boolean) {
    const name = addWorkspaceName.trim() || "Un-Named";
    await doCreateWorkspace(name, copyFromCurrent);
    // Modal stays open on error (error shown inside modal). On success, doCreateWorkspace redirects.
  }

  async function handleDeleteWorkspace(workspace: Workspace) {
    if (workspaces.length <= 1) {
      setDeleteWorkspaceError("Your account must have at least one workspace. Add another workspace first if you want to remove this one.");
      return;
    }
    setDeleteWorkspaceError(null);
    setDeleteWorkspaceLoading(true);
    try {
      const res = await workspaceFetch(`/api/v1/workspaces/${workspace.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDeleteConfirmWorkspace(null);
        await fetchWorkspaces();
        if (workspace.id === activeWorkspaceId) {
          document.cookie = `active_workspace_id=; path=/; max-age=0`;
          window.location.href = "/dashboard";
          return;
        }
      } else {
        const message = (data as { error?: { message?: string } })?.error?.message ?? res.statusText ?? "Failed to delete workspace";
        setDeleteWorkspaceError(message);
      }
    } catch {
      setDeleteWorkspaceError("Network error. Please try again.");
    } finally {
      setDeleteWorkspaceLoading(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function handleRestartOnboarding() {
    setRestarting(true);
    try {
      const res = await workspaceFetch("/api/v1/onboarding/restart", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        window.location.href = "/onboarding";
        return;
      }
      const body = await res.json().catch(() => ({}));
      const msg = (body as { error?: string })?.error ?? res.statusText ?? "Failed to restart setup";
      console.error("[dashboard] Restart onboarding failed:", res.status, msg);
    } catch (err) {
      console.error("[dashboard] Restart onboarding error:", err);
    } finally {
      setRestarting(false);
    }
  }

  const handleTogglePause = useCallback(async (workspaceId: string, newIsPaused: boolean) => {
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === workspaceId ? { ...w, is_paused: newIsPaused } : w))
    );
    try {
      const res = await workspaceFetch(`/api/v1/workspaces/${workspaceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_paused: newIsPaused }),
      });
      if (!res.ok) {
        setWorkspaces((prev) =>
          prev.map((w) => (w.id === workspaceId ? { ...w, is_paused: !newIsPaused } : w))
        );
      }
    } catch {
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === workspaceId ? { ...w, is_paused: !newIsPaused } : w))
      );
    }
  }, [workspaceFetch]);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const canConnectAccounts = !!activeWs && activeWs.status === "active";

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
      {showCheckoutSuccess && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-md">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span>Your subscription is now active. Welcome to ZARZOOM!</span>
          <button
            type="button"
            onClick={() => setShowCheckoutSuccess(false)}
            className="ml-2 rounded-lg p-1 hover:bg-green-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <DynamicSEO />
      <SiteNavbar />

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">
        {/* Welcome header with workspace switcher */}
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
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <WorkspaceSwitcher
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              onSwitch={handleSwitchWorkspace}
              onAddWorkspace={handleAddWorkspaceClick}
              addWorkspaceLoading={addWorkspaceLoading}
            />
            {activeWs && (
              <WorkspaceAutomationToggle
                workspaceId={activeWs.id}
                isPaused={activeWs.is_paused ?? false}
                onToggle={handleTogglePause}
              />
            )}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {t("nav.logout")}
            </button>
          </div>
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
                <h2 className="text-lg font-bold text-gray-900">{t("dashboard.workspaces")}</h2>
              </div>
              <button
                onClick={handleAddWorkspaceClick}
                disabled={addWorkspaceLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-green-400 text-sm font-medium text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addWorkspaceLoading ? (
                  <span className="inline-block h-4 w-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {t("dashboard.addWorkspace")}
              </button>
            </div>

            {addWorkspaceError && (
              <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2" role="alert">
                {addWorkspaceError}
              </p>
            )}

            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              {t("dashboard.workspacesDescription")}
            </p>

            {workspaces.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                {t("dashboard.noWorkspaces")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {workspaces.map((ws) => {
                  const isCurrent = ws.id === activeWorkspaceId;

                  return (
                    <div
                      key={ws.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                        isCurrent
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSwitchWorkspace(ws.id)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isCurrent ? "bg-green-600" : "bg-gray-100"
                          }`}
                        >
                          <Building2
                            className={`w-4 h-4 ${isCurrent ? "text-white" : "text-gray-500"}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${isCurrent ? "text-green-700" : "text-gray-900"}`}>
                            {ws.name}
                            {ws.content_language && (
                              <span className="text-gray-500 font-normal">
                                {" "}
                                ({languages.find((l) => l.code === ws.content_language)?.name ?? ws.content_language})
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <WorkspaceStatusPills status={ws.status} isPaused={ws.is_paused ?? false} />
                            {ws.role && (
                              <span className="text-[10px] text-gray-400 capitalize">{ws.role}</span>
                            )}
                          </div>
                        </div>
                        {isCurrent && <Check className="w-4 h-4 text-green-500 flex-shrink-0 ml-1" />}
                      </button>
                      {ws.role === "owner" && (
                        workspaces.length > 1 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteConfirmWorkspace(ws);
                              setDeleteWorkspaceError(null);
                            }}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                            title="Delete workspace"
                            aria-label={`Delete workspace ${ws.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span
                            className="p-2 rounded-lg text-gray-300 cursor-not-allowed flex-shrink-0 inline-flex"
                            title="Your account must have at least one workspace. Add another workspace first if you want to remove this one."
                            aria-label="Delete workspace (disabled: at least one workspace is required)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </span>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {workspaces.length === 1 && (
              <p className="text-xs text-gray-500 mt-3">
                {t("dashboard.minOneWorkspace")}
              </p>
            )}
          </div>

          {/* Brand Basics card */}
          <Link
            href="/dashboard/profile"
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-all block ${
              profileCompleteness && !profileCompleteness.isComplete
                ? "border-amber-200 hover:border-amber-300"
                : "border-gray-200 hover:border-green-300"
            }`}
          >
            {/* Mini progress bar */}
            {profileCompleteness && (
              <div className="h-1 bg-gray-100">
                <div
                  className={`h-full transition-all duration-500 rounded-r-full ${
                    profileCompleteness.percentage === 100
                      ? "bg-green-500"
                      : profileCompleteness.percentage >= 60
                        ? "bg-amber-400"
                        : "bg-red-400"
                  }`}
                  style={{ width: `${profileCompleteness.percentage}%` }}
                />
              </div>
            )}

            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  profileCompleteness && profileCompleteness.isComplete
                    ? "bg-green-100"
                    : "bg-amber-100"
                }`}>
                  {profileCompleteness && profileCompleteness.isComplete ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <Settings className="w-5 h-5 text-amber-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-gray-900">
                    {t("dashboard.profile")}
                  </h2>
                  {profileCompleteness && (
                    <p className={`text-xs font-medium ${
                      profileCompleteness.isComplete ? "text-green-600" : "text-amber-600"
                    }`}>
                      {profileCompleteness.percentage}% complete
                    </p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>

              {/* Missing items */}
              {profileCompleteness && profileCompleteness.missing.length > 0 ? (
                <div className="flex flex-col gap-1.5 mt-1">
                  {profileCompleteness.missing.slice(0, 4).map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center gap-2 text-xs"
                    >
                      <Circle className={`w-3 h-3 flex-shrink-0 ${
                        item.priority === "required" ? "text-amber-400" : "text-gray-300"
                      }`} />
                      <span className={
                        item.priority === "required" ? "text-amber-700" : "text-gray-500"
                      }>
                        {item.label}
                      </span>
                    </div>
                  ))}
                  {profileCompleteness.missing.length > 4 && (
                    <p className="text-[10px] text-gray-400 ml-5">
                      +{profileCompleteness.missing.length - 4} more
                    </p>
                  )}
                </div>
              ) : profileCompleteness?.isComplete ? (
                <p className="text-sm text-green-600 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  {t("profile.subtitle")}
                </p>
              ) : (
                <div className="flex flex-col gap-2 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{user?.email}</span>
                  </div>
                </div>
              )}
            </div>
          </Link>

          {/* Content Planner card */}
          <Link
            href="/dashboard/planner"
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:border-teal-300 hover:shadow-md transition-all block"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-teal-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {t("dashboard.contentPlanner")}
              </h2>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {t("dashboard.contentPlannerDescription")}
            </p>
          </Link>

          {/* Connected accounts card */}
          {canConnectAccounts ? (
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
          ) : (
            <button
              type="button"
              onClick={() => { window.location.href = "/dashboard/billing"; }}
              className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 hover:border-red-300 hover:shadow-md transition-all block text-left cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {t("dashboard.connectedAccounts")}
                  </h2>
                  <p className="text-xs text-red-700 mt-0.5 font-medium">
                    Subscription required
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                Choose a plan for this workspace to connect social accounts.
              </p>
            </button>
          )}

          {/* Analytics card */}
          <Link
            href="/dashboard/analytics"
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:border-sky-300 hover:shadow-md transition-all block"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-sky-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {t("dashboard.analytics")}
              </h2>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {t("dashboard.analyticsDescription")}
            </p>
          </Link>

          {/* Billing card */}
          <Link
            href="/dashboard/billing"
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:border-orange-300 hover:shadow-md transition-all block"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-orange-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {t("dashboard.billing")}
              </h2>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {t("dashboard.billingDescription")}
            </p>
          </Link>

          {/* API & Integrations card */}
          <Link
            href="/dashboard/api-keys"
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:border-emerald-300 hover:shadow-md transition-all block"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {t("dashboard.apiIntegrations")}
              </h2>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {t("dashboard.apiIntegrationsDescription")}
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
            type="button"
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

      {/* Add workspace modal: name + New/Blank vs Copy from existing (same style as delete confirmation) */}
      {addWorkspaceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-workspace-title"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 id="add-workspace-title" className="text-lg font-bold text-gray-900 mb-2">
              {t("dashboard.addWorkspaceTitle")}
            </h2>
            <label htmlFor="add-workspace-name" className="block text-sm font-medium text-gray-700 mb-1">
              {t("dashboard.workspaceNameLabel")}
            </label>
            <input
              id="add-workspace-name"
              type="text"
              value={addWorkspaceName}
              onChange={(e) => setAddWorkspaceName(e.target.value.slice(0, 200))}
              placeholder="Un-Named"
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none text-gray-900 mb-4"
            />
            <p className="text-sm text-gray-600 mb-3">
              {t("dashboard.setupFormPrompt")}
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleAddWorkspaceSubmit(false)}
                disabled={addWorkspaceLoading}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 text-left text-sm font-medium text-gray-800 transition-colors disabled:opacity-50 flex items-center gap-3"
              >
                <span className="flex h-9 w-9 rounded-lg bg-gray-100 items-center justify-center text-gray-600 font-bold">1</span>
                <span><strong>{t("dashboard.newBlankForm")}</strong> — {t("dashboard.newBlankFormDescription")}</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddWorkspaceSubmit(true)}
                disabled={addWorkspaceLoading}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 text-left text-sm font-medium text-gray-800 transition-colors disabled:opacity-50 flex items-center gap-3"
              >
                <span className="flex h-9 w-9 rounded-lg bg-gray-100 items-center justify-center text-gray-600 font-bold">2</span>
                <span><strong>{t("dashboard.existingBrandForm")}</strong> — {t("dashboard.existingBrandFormDescription").replace("{name}", activeWorkspaceId ? (workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? "current workspace") : "current workspace")}</span>
              </button>
            </div>
            {addWorkspaceError && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2" role="alert">
                {addWorkspaceError}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setAddWorkspaceModalOpen(false);
                setAddWorkspaceError(null);
              }}
              disabled={addWorkspaceLoading}
              className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              {t("dashboard.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Delete workspace confirmation modal */}
      {deleteConfirmWorkspace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-workspace-title"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 id="delete-workspace-title" className="text-lg font-bold text-gray-900 mb-2">
              {t("dashboard.deleteWorkspaceTitle")}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {t("dashboard.deleteWorkspaceWarning").replace("{name}", deleteConfirmWorkspace.name)}
            </p>
            <p className="text-sm text-gray-600 mb-6">
              {t("dashboard.deleteWorkspaceConfirm")}
            </p>
            {deleteWorkspaceError && (
              <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2" role="alert">
                {deleteWorkspaceError}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmWorkspace(null);
                  setDeleteWorkspaceError(null);
                }}
                disabled={deleteWorkspaceLoading}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
              >
                {t("dashboard.cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteWorkspace(deleteConfirmWorkspace)}
                disabled={deleteWorkspaceLoading}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deleteWorkspaceLoading ? (
                  <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {t("dashboard.deleteWorkspaceButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
