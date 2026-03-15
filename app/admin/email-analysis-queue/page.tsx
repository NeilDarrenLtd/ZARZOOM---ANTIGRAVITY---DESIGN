"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, RefreshCw, Loader2, ExternalLink, Clock } from "lucide-react";

type QueueItem = {
  id: string;
  email: string | null;
  profile_url: string;
  platform: string | null;
  created_at: string;
  failure_type: string | null;
  status: string;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending_manual_analysis", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function formatRelative(dateString: string) {
  const d = new Date(dateString);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function AdminEmailAnalysisQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", "50");
      const res = await fetch(`/api/v1/admin/email-analysis-queue?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `Failed to load (${res.status})`);
      }
      const body = await res.json();
      const data = body.data ?? body;
      setItems(data.items ?? []);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 1);
      if (data.pendingCount != null) setPendingCount(data.pendingCount);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/v1/admin/email-analysis-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Update failed");
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Inbox className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Analyzer Fallback Queue</h1>
            <p className="text-sm text-gray-500">
              Requests from users who entered their email when the floating analyzer failed.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount != null && (
            <span className="text-sm text-amber-600 font-medium">
              {pendingCount} pending
            </span>
          )}
          <button
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-gray-500">
            <Clock className="w-10 h-10 text-gray-300" />
            <p>No queue entries</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Created</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Profile URL</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Platform</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Failure type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                      {formatRelative(row.created_at)}
                    </td>
                    <td className="py-3 px-4 text-gray-900">{row.email ?? "—"}</td>
                    <td className="py-3 px-4">
                      <a
                        href={row.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline truncate max-w-[200px] inline-block"
                        title={row.profile_url}
                      >
                        {row.profile_url}
                      </a>
                      <ExternalLink className="w-3 h-3 inline-block ml-1 text-gray-400" />
                    </td>
                    <td className="py-3 px-4 text-gray-600">{row.platform ?? "—"}</td>
                    <td className="py-3 px-4 text-gray-600">{row.failure_type ?? "—"}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          row.status === "pending_manual_analysis"
                            ? "bg-amber-100 text-amber-800"
                            : row.status === "in_progress"
                              ? "bg-blue-100 text-blue-800"
                              : row.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {row.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {row.status === "pending_manual_analysis" && (
                        <select
                          disabled={updatingId === row.id}
                          className="rounded border border-gray-200 px-2 py-1 text-xs bg-white"
                          value=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v) updateStatus(row.id, v);
                            e.target.value = "";
                          }}
                        >
                          <option value="">Mark…</option>
                          <option value="in_progress">In progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      )}
                      {updatingId === row.id && (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400 inline-block ml-1" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
            <span>
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded border border-gray-200 bg-white disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded border border-gray-200 bg-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
