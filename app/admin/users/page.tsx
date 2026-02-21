"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  getUsers,
  updateUserRole,
  suspendUser,
  unsuspendUser,
  deleteUser,
  resetAutofillUsage,
  toggleAutofillBlocked,
  type AdminUserProfile,
} from "@/app/admin/actions";
import {
  Users,
  Search,
  ShieldCheck,
  User,
  Info,
  Ban,
  Trash2,
  RotateCcw,
  ShieldOff,
  ShieldAlert,
  X,
  Zap,
  ZapOff,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

// ─── Confirmation modal ─────────────────────────────────────────

function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmColor = "red",
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor?: "red" | "green" | "blue";
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const colorMap = {
    red: "bg-red-600 hover:bg-red-700 text-white",
    green: "bg-green-600 hover:bg-green-700 text-white",
    blue: "bg-blue-600 hover:bg-blue-700 text-white",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        {children}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${colorMap[confirmColor]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast notification ─────────────────────────────────────────

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium ${
        type === "success"
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-red-50 border-red-200 text-red-700"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <AlertTriangle className="w-4 h-4" />
      )}
      {message}
    </div>
  );
}

// ─── Autofill usage badge ───────────────────────────────────────

function AutofillBadge({
  user,
}: {
  user: AdminUserProfile;
}) {
  const lifetime = user.autofill_lifetime_count || 0;
  const degraded = user.autofill_degraded;
  const blocked = user.autofill_blocked;

  if (blocked) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">
        <ZapOff className="w-3 h-3" />
        Blocked
      </span>
    );
  }

  if (degraded) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
        <AlertTriangle className="w-3 h-3" />
        Degraded ({lifetime} uses)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
      <Zap className="w-3 h-3" />
      {lifetime}/10 uses
    </span>
  );
}

// ─── User detail drawer ─────────────────────────────────────────

function UserDetailPanel({
  user,
  onClose,
  onAction,
  actionLoading,
}: {
  user: AdminUserProfile;
  onClose: () => void;
  onAction: (action: string, userId: string) => void;
  actionLoading: string | null;
}) {
  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "N/A";

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg h-full shadow-xl border-l border-gray-200 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                user.is_suspended
                  ? "bg-red-50"
                  : user.is_admin
                    ? "bg-green-50"
                    : "bg-gray-100"
              }`}
            >
              {user.is_suspended ? (
                <Ban className="w-5 h-5 text-red-500" />
              ) : user.is_admin ? (
                <ShieldCheck className="w-5 h-5 text-green-600" />
              ) : (
                <User className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                {user.display_name || user.email}
              </p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                user.is_admin
                  ? "bg-green-50 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {user.is_admin ? "Admin" : "User"}
            </span>
            {user.is_suspended && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-700">
                Suspended
              </span>
            )}
            <AutofillBadge user={user} />
          </div>

          {/* Suspension info */}
          {user.is_suspended && user.suspended_reason && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              <p className="text-xs font-medium text-red-800 mb-1">
                Suspension Reason
              </p>
              <p className="text-xs text-red-600">{user.suspended_reason}</p>
              {user.suspended_at && (
                <p className="text-xs text-red-400 mt-1">
                  Suspended on {formatDate(user.suspended_at)}
                </p>
              )}
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Created</p>
              <p className="text-sm text-gray-900 font-medium">
                {formatDate(user.created_at)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Updated</p>
              <p className="text-sm text-gray-900 font-medium">
                {formatDate(user.updated_at)}
              </p>
            </div>
          </div>

          {/* Autofill usage section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-bold text-gray-900 mb-3">
              Autofill Usage
            </h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-400">Lifetime Uses</p>
                <p className="text-2xl font-bold text-gray-900">
                  {user.autofill_lifetime_count || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  {user.autofill_daily_count || 0}
                  <span className="text-sm font-normal text-gray-400">
                    {" "}
                    / 2
                  </span>
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">
                  Degradation threshold
                </span>
                <span className="text-xs font-medium text-gray-700">
                  {Math.min(user.autofill_lifetime_count || 0, 10)}/10
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    (user.autofill_lifetime_count || 0) >= 10
                      ? "bg-amber-500"
                      : "bg-green-500"
                  }`}
                  style={{
                    width: `${Math.min(((user.autofill_lifetime_count || 0) / 10) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  user.autofill_degraded
                    ? "bg-amber-50 text-amber-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {user.autofill_degraded ? "Degraded (basic mode)" : "Full AI mode"}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  user.autofill_blocked
                    ? "bg-red-50 text-red-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {user.autofill_blocked ? "Autofill blocked" : "Autofill enabled"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-gray-900 mb-3">Actions</h4>

            {/* Role toggle */}
            <button
              onClick={() =>
                onAction(user.is_admin ? "remove-admin" : "make-admin", user.id)
              }
              disabled={actionLoading === user.id}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                user.is_admin
                  ? "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  : "bg-green-50 text-green-700 hover:bg-green-100"
              }`}
            >
              {user.is_admin ? (
                <ShieldOff className="w-4 h-4" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {user.is_admin ? "Remove Admin" : "Make Admin"}
            </button>

            {/* Suspend / Unsuspend */}
            <button
              onClick={() =>
                onAction(
                  user.is_suspended ? "unsuspend" : "suspend",
                  user.id
                )
              }
              disabled={actionLoading === user.id}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                user.is_suspended
                  ? "bg-green-50 text-green-700 hover:bg-green-100"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              {user.is_suspended ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Ban className="w-4 h-4" />
              )}
              {user.is_suspended ? "Unsuspend User" : "Suspend User"}
            </button>

            {/* Reset autofill */}
            <button
              onClick={() => onAction("reset-autofill", user.id)}
              disabled={actionLoading === user.id}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Autofill Usage
            </button>

            {/* Block / unblock autofill */}
            <button
              onClick={() =>
                onAction(
                  user.autofill_blocked ? "unblock-autofill" : "block-autofill",
                  user.id
                )
              }
              disabled={actionLoading === user.id}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                user.autofill_blocked
                  ? "bg-green-50 text-green-700 hover:bg-green-100"
                  : "bg-red-50 text-red-700 hover:bg-red-100"
              }`}
            >
              {user.autofill_blocked ? (
                <Zap className="w-4 h-4" />
              ) : (
                <ZapOff className="w-4 h-4" />
              )}
              {user.autofill_blocked
                ? "Unblock Autofill"
                : "Block Autofill"}
            </button>

            {/* Delete */}
            <button
              onClick={() => onAction("delete", user.id)}
              disabled={actionLoading === user.id}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete User
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "degraded">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserProfile | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    confirmColor: "red" | "green" | "blue";
    action: () => Promise<void>;
    children?: React.ReactNode;
  } | null>(null);

  const loadUsers = useCallback(async () => {
    const result = await getUsers();
    if (result.users) {
      setUsers(result.users as AdminUserProfile[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(() => {
    let list = users;

    // Text search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.email?.toLowerCase().includes(q) ||
          u.display_name?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter === "active") {
      list = list.filter((u) => !u.is_suspended);
    } else if (statusFilter === "suspended") {
      list = list.filter((u) => u.is_suspended);
    } else if (statusFilter === "degraded") {
      list = list.filter((u) => u.autofill_degraded || u.autofill_blocked);
    }

    return list;
  }, [users, search, statusFilter]);

  // Derived counts
  const suspendedCount = users.filter((u) => u.is_suspended).length;
  const degradedCount = users.filter(
    (u) => u.autofill_degraded || u.autofill_blocked
  ).length;

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
  };

  async function handleAction(action: string, userId: string) {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    // Actions that need confirmation
    const needsConfirm = ["suspend", "delete", "block-autofill"];
    if (needsConfirm.includes(action)) {
      const configs: Record<
        string,
        { title: string; message: string; label: string; color: "red" | "green" | "blue" }
      > = {
        suspend: {
          title: "Suspend User",
          message: `Are you sure you want to suspend ${user.email}? They will be signed out and unable to log in until unsuspended.`,
          label: "Suspend User",
          color: "red",
        },
        delete: {
          title: "Delete User",
          message: `Are you sure you want to permanently delete ${user.email}? This action cannot be undone. All their data will be removed.`,
          label: "Delete Permanently",
          color: "red",
        },
        "block-autofill": {
          title: "Block Autofill",
          message: `Are you sure you want to block ${user.email} from using auto-fill? They will not be able to use either website or file autofill until unblocked.`,
          label: "Block Autofill",
          color: "red",
        },
      };

      const config = configs[action];
      setConfirmModal({
        title: config.title,
        message: config.message,
        confirmLabel: config.label,
        confirmColor: config.color,
        action: async () => {
          setConfirmModal(null);
          await executeAction(action, userId, user);
        },
      });
      return;
    }

    await executeAction(action, userId, user);
  }

  async function executeAction(action: string, userId: string, user: AdminUserProfile) {
    setActionLoading(userId);
    let result: { success?: boolean; error?: string };

    switch (action) {
      case "make-admin":
        result = await updateUserRole(userId, true);
        if (result.success) {
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, is_admin: true } : u))
          );
          showToast(`${user.email} is now an admin.`, "success");
        }
        break;

      case "remove-admin":
        result = await updateUserRole(userId, false);
        if (result.success) {
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, is_admin: false } : u))
          );
          showToast(`Admin removed for ${user.email}.`, "success");
        }
        break;

      case "suspend":
        result = await suspendUser(userId, "Suspended by administrator");
        if (result.success) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId
                ? {
                    ...u,
                    is_suspended: true,
                    suspended_at: new Date().toISOString(),
                    suspended_reason: "Suspended by administrator",
                  }
                : u
            )
          );
          if (selectedUser?.id === userId) {
            setSelectedUser((prev) =>
              prev ? { ...prev, is_suspended: true, suspended_at: new Date().toISOString(), suspended_reason: "Suspended by administrator" } : null
            );
          }
          showToast(`${user.email} has been suspended.`, "success");
        }
        break;

      case "unsuspend":
        result = await unsuspendUser(userId);
        if (result.success) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId
                ? { ...u, is_suspended: false, suspended_at: null, suspended_reason: null }
                : u
            )
          );
          if (selectedUser?.id === userId) {
            setSelectedUser((prev) =>
              prev ? { ...prev, is_suspended: false, suspended_at: null, suspended_reason: null } : null
            );
          }
          showToast(`${user.email} has been unsuspended.`, "success");
        }
        break;

      case "delete":
        result = await deleteUser(userId);
        if (result.success) {
          setUsers((prev) => prev.filter((u) => u.id !== userId));
          setSelectedUser(null);
          showToast(`${user.email} has been deleted.`, "success");
        }
        break;

      case "reset-autofill":
        result = await resetAutofillUsage(userId);
        if (result.success) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId
                ? {
                    ...u,
                    autofill_lifetime_count: 0,
                    autofill_daily_count: 0,
                    autofill_degraded: false,
                    autofill_blocked: false,
                  }
                : u
            )
          );
          if (selectedUser?.id === userId) {
            setSelectedUser((prev) =>
              prev
                ? {
                    ...prev,
                    autofill_lifetime_count: 0,
                    autofill_daily_count: 0,
                    autofill_degraded: false,
                    autofill_blocked: false,
                  }
                : null
            );
          }
          showToast(`Autofill usage reset for ${user.email}.`, "success");
        }
        break;

      case "block-autofill":
        result = await toggleAutofillBlocked(userId, true);
        if (result.success) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId ? { ...u, autofill_blocked: true } : u
            )
          );
          if (selectedUser?.id === userId) {
            setSelectedUser((prev) =>
              prev ? { ...prev, autofill_blocked: true } : null
            );
          }
          showToast(`Autofill blocked for ${user.email}.`, "success");
        }
        break;

      case "unblock-autofill":
        result = await toggleAutofillBlocked(userId, false);
        if (result.success) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId ? { ...u, autofill_blocked: false } : u
            )
          );
          if (selectedUser?.id === userId) {
            setSelectedUser((prev) =>
              prev ? { ...prev, autofill_blocked: false } : null
            );
          }
          showToast(`Autofill unblocked for ${user.email}.`, "success");
        }
        break;

      default:
        result = { error: "Unknown action" };
    }

    if (result.error) {
      showToast(`Error: ${result.error}`, "error");
    }

    setActionLoading(null);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          confirmColor={confirmModal.confirmColor}
          onConfirm={confirmModal.action}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {/* Detail Panel */}
      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onAction={handleAction}
          actionLoading={actionLoading}
        />
      )}

      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {t("admin.userManagement")}
          </h1>
          <p className="text-xs text-gray-500">
            {t("admin.users")} ({users.length})
            {suspendedCount > 0 && (
              <span className="text-red-500 ml-2">
                {suspendedCount} suspended
              </span>
            )}
            {degradedCount > 0 && (
              <span className="text-amber-500 ml-2">
                {degradedCount} degraded/blocked
              </span>
            )}
          </p>
        </div>
      </div>

      {/* RBAC note */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mb-6">
        <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700 leading-relaxed">
          {t("admin.rbacNote")}
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors text-sm bg-white"
            placeholder={t("admin.userSearch")}
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(["all", "active", "suspended", "degraded"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-2 text-xs font-medium transition-colors capitalize ${
                statusFilter === f
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400 animate-pulse">
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            {t("admin.noUsersFound")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                    {t("admin.email")}
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3 hidden sm:table-cell">
                    {t("admin.status")}
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3 hidden md:table-cell">
                    Autofill
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3 hidden lg:table-cell">
                    {t("admin.userCreated")}
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-600 px-4 py-3">
                    {t("admin.userActions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user.id}
                    className={`border-b border-gray-50 last:border-0 transition-colors cursor-pointer ${
                      user.is_suspended
                        ? "bg-red-50/30 hover:bg-red-50/50"
                        : "hover:bg-gray-50/50"
                    }`}
                    onClick={() => setSelectedUser(user)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            user.is_suspended
                              ? "bg-red-50"
                              : user.is_admin
                                ? "bg-green-50"
                                : "bg-gray-100"
                          }`}
                        >
                          {user.is_suspended ? (
                            <Ban className="w-4 h-4 text-red-500" />
                          ) : user.is_admin ? (
                            <ShieldCheck className="w-4 h-4 text-green-600" />
                          ) : (
                            <User className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.display_name || user.email}
                          </p>
                          {user.display_name && (
                            <p className="text-xs text-gray-500 truncate">
                              {user.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            user.is_admin
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {user.is_admin ? "Admin" : "User"}
                        </span>
                        {user.is_suspended && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                            Suspended
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <AutofillBadge user={user} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-gray-500">
                        {formatDate(user.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {user.is_suspended ? (
                          <button
                            onClick={() =>
                              handleAction("unsuspend", user.id)
                            }
                            disabled={actionLoading === user.id}
                            title="Unsuspend"
                            className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleAction("suspend", user.id)
                            }
                            disabled={actionLoading === user.id}
                            title="Suspend"
                            className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            handleAction("reset-autofill", user.id)
                          }
                          disabled={actionLoading === user.id}
                          title="Reset Autofill"
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            handleAction("delete", user.id)
                          }
                          disabled={actionLoading === user.id}
                          title="Delete"
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
