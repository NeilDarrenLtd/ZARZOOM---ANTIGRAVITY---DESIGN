"use client";

import { useEffect, useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { getUsers, updateUserRole } from "@/app/admin/actions";
import {
  Users,
  Search,
  ShieldCheck,
  User,
  Info,
} from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminUsersPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const result = await getUsers();
      if (result.users) {
        setUsers(result.users as UserProfile[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.display_name?.toLowerCase().includes(q)
    );
  }, [users, search]);

  async function handleToggleAdmin(userId: string, currentIsAdmin: boolean) {
    setUpdatingId(userId);
    const result = await updateUserRole(userId, !currentIsAdmin);
    if (result.success) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, is_admin: !currentIsAdmin } : u
        )
      );
    }
    setUpdatingId(null);
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

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors text-sm bg-white"
          placeholder={t("admin.userSearch")}
        />
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
                    {t("admin.userRole")}
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3 hidden md:table-cell">
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
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            user.is_admin
                              ? "bg-green-50"
                              : "bg-gray-100"
                          }`}
                        >
                          {user.is_admin ? (
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
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          user.is_admin
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {user.is_admin
                          ? t("admin.userRoleAdmin")
                          : t("admin.userRoleUser")}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-gray-500">
                        {formatDate(user.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() =>
                          handleToggleAdmin(user.id, user.is_admin)
                        }
                        disabled={updatingId === user.id}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                          user.is_admin
                            ? "bg-red-50 text-red-600 hover:bg-red-100"
                            : "bg-green-50 text-green-600 hover:bg-green-100"
                        }`}
                      >
                        {updatingId === user.id
                          ? "..."
                          : user.is_admin
                            ? t("admin.removeAdmin")
                            : t("admin.makeAdmin")}
                      </button>
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
