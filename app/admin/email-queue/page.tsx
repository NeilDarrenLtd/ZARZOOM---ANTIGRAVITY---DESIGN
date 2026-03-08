"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Clock,
  CheckCircle2,
  Loader2,
  XCircle,
  RefreshCw,
  Eye,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type EmailStatus = "pending" | "processing" | "sent" | "failed" | "cancelled";

interface EmailQueueItem {
  id: string;
  status: EmailStatus;
  to_email: string;
  to_name: string | null;
  subject: string;
  html_body: string;
  text_body: string | null;
  email_type: string;
  related_type: string | null;
  related_id: string | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
  queued_at: string;
  scheduled_for: string;
  sent_at: string | null;
  failed_at: string | null;
}

interface SummaryCounts {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// ── Status Badge ──────────────────────────────────────────────────────────────

const statusConfig: Record<
  EmailStatus,
  { label: string; className: string; Icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
    Icon: Clock,
  },
  processing: {
    label: "Processing",
    className: "bg-blue-50 text-blue-700 border border-blue-200",
    Icon: Loader2,
  },
  sent: {
    label: "Sent",
    className: "bg-green-50 text-green-700 border border-green-200",
    Icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "bg-red-50 text-red-700 border border-red-200",
    Icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-600 border border-gray-200",
    Icon: X,
  },
};

function StatusBadge({ status }: { status: EmailStatus }) {
  const cfg = statusConfig[status] ?? statusConfig.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
    >
      <cfg.Icon
        className={`w-3 h-3 ${status === "processing" ? "animate-spin" : ""}`}
      />
      {cfg.label}
    </span>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function EmailDetailDrawer({
  email,
  onClose,
}: {
  email: EmailQueueItem;
  onClose: () => void;
}) {
  const [showHtml, setShowHtml] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const fieldClass = "text-sm text-gray-900 break-all";
  const labelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Email Details"
        className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 truncate max-w-xs">
                {email.subject}
              </p>
              <p className="text-xs text-gray-500">{email.to_email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1.5 hover:bg-gray-100"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Status + meta */}
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={email.status} />
            {email.retry_count > 0 && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                Attempt {email.retry_count}/{email.max_retries}
              </span>
            )}
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              Priority {email.priority}
            </span>
          </div>

          {/* Recipient */}
          <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Recipient
            </h3>
            <div>
              <p className={labelClass}>To</p>
              <p className={fieldClass}>
                {email.to_name ? `${email.to_name} <${email.to_email}>` : email.to_email}
              </p>
            </div>
            <div>
              <p className={labelClass}>Subject</p>
              <p className={fieldClass}>{email.subject}</p>
            </div>
          </div>

          {/* Classification */}
          <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Classification
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={labelClass}>Email Type</p>
                <p className={fieldClass}>{email.email_type || "—"}</p>
              </div>
              <div>
                <p className={labelClass}>Related Type</p>
                <p className={fieldClass}>{email.related_type || "—"}</p>
              </div>
              {email.related_id && (
                <div className="col-span-2">
                  <p className={labelClass}>Related ID</p>
                  <p className="text-xs font-mono text-gray-600 break-all">
                    {email.related_id}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Timestamps
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={labelClass}>Created</p>
                <p className={fieldClass}>{formatDate(email.created_at)}</p>
              </div>
              <div>
                <p className={labelClass}>Scheduled For</p>
                <p className={fieldClass}>{formatDate(email.scheduled_for)}</p>
              </div>
              {email.sent_at && (
                <div>
                  <p className={labelClass}>Sent At</p>
                  <p className={fieldClass}>{formatDate(email.sent_at)}</p>
                </div>
              )}
              {email.failed_at && (
                <div>
                  <p className={labelClass}>Failed At</p>
                  <p className={fieldClass}>{formatDate(email.failed_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {email.error_message && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">
                Error Message
              </h3>
              <p className="text-sm text-red-700 font-mono leading-relaxed break-words">
                {email.error_message}
              </p>
            </div>
          )}

          {/* Body Preview */}
          <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Body Preview
              </h3>
              <button
                onClick={() => setShowHtml(!showHtml)}
                className="text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
              >
                {showHtml ? "Show Plain Text" : "Show HTML Source"}
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto">
              {showHtml ? (
                <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words font-mono leading-relaxed">
                  {email.html_body}
                </pre>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {email.text_body || stripHtml(email.html_body)}
                </p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  count,
  icon: Icon,
  colorClass,
  bgClass,
  active,
  onClick,
}: {
  label: string;
  count: number;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-2 p-4 rounded-xl border transition-all text-left w-full ${
        active
          ? "border-green-400 bg-green-50 shadow-sm"
          : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgClass}`}>
        <Icon className={`w-4 h-4 ${colorClass}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{count.toLocaleString()}</p>
        <p className="text-xs font-medium text-gray-500">{label}</p>
      </div>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 50, 100, 500];
const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function EmailQueuePage() {
  const [emails, setEmails] = useState<EmailQueueItem[]>([]);
  const [counts, setCounts] = useState<SummaryCounts>({
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EmailQueueItem | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Build query
      let query = supabase
        .from("email_queue")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (search.trim()) {
        query = query.or(
          `to_email.ilike.%${search.trim()}%,subject.ilike.%${search.trim()}%,related_type.ilike.%${search.trim()}%`
        );
      }

      const { data, error: qErr, count } = await query;
      if (qErr) throw qErr;
      setEmails((data as EmailQueueItem[]) ?? []);
      setTotal(count ?? 0);

      // Fetch counts for summary cards (no filter)
      const { data: allRows } = await supabase
        .from("email_queue")
        .select("status");

      const c: SummaryCounts = { pending: 0, processing: 0, sent: 0, failed: 0 };
      (allRows ?? []).forEach((r: { status: string }) => {
        if (r.status === "pending") c.pending++;
        else if (r.status === "processing") c.processing++;
        else if (r.status === "sent") c.sent++;
        else if (r.status === "failed") c.failed++;
      });
      setCounts(c);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load email queue.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSummaryClick(status: string) {
    setStatusFilter((prev) => (prev === status ? "all" : status));
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
            <Mail className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Email Queue</h1>
            <p className="text-xs text-gray-500">
              Inspect outgoing emails managed by the send engine.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard
          label="Pending"
          count={counts.pending}
          icon={Clock}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
          active={statusFilter === "pending"}
          onClick={() => handleSummaryClick("pending")}
        />
        <SummaryCard
          label="Processing"
          count={counts.processing}
          icon={Loader2}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
          active={statusFilter === "processing"}
          onClick={() => handleSummaryClick("processing")}
        />
        <SummaryCard
          label="Sent"
          count={counts.sent}
          icon={CheckCircle2}
          colorClass="text-green-600"
          bgClass="bg-green-50"
          active={statusFilter === "sent"}
          onClick={() => handleSummaryClick("sent")}
        />
        <SummaryCard
          label="Failed"
          count={counts.failed}
          icon={XCircle}
          colorClass="text-red-600"
          bgClass="bg-red-50"
          active={statusFilter === "failed"}
          onClick={() => handleSummaryClick("failed")}
        />
      </div>

      {/* Filters bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by recipient, subject, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
          />
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Page size */}
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white flex-shrink-0"
          aria-label="Page size"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              Show {n}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="animate-pulse text-gray-400 text-sm">
            Loading email queue...
          </div>
        </div>
      ) : error ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : emails.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Mail className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No emails found</p>
          <p className="text-xs text-gray-400 mt-1">
            {search || statusFilter !== "all"
              ? "Try adjusting your filters."
              : "The email queue is empty."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    "Status",
                    "To",
                    "Subject",
                    "Related Type",
                    "Created",
                    "Sent / Failed At",
                    "",
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {emails.map((email) => (
                  <tr
                    key={email.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelected(email)}
                  >
                    <td className="px-4 py-3">
                      <StatusBadge status={email.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 max-w-[180px] truncate">
                        {email.to_email}
                      </div>
                      {email.to_name && (
                        <div className="text-xs text-gray-400 truncate max-w-[180px]">
                          {email.to_name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 max-w-[220px] truncate">
                        {email.subject}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {email.related_type ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {email.related_type}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {formatDateShort(email.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {email.sent_at
                        ? formatDateShort(email.sent_at)
                        : email.failed_at
                        ? formatDateShort(email.failed_at)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(email);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
                        aria-label="View email details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
              <p className="text-xs text-gray-500">
                Showing{" "}
                <span className="font-medium text-gray-700">
                  {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, total)}
                </span>{" "}
                of <span className="font-medium text-gray-700">{total}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-700 px-2">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <EmailDetailDrawer email={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
