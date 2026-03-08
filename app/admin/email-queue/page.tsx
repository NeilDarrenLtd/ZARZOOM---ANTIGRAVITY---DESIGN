"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search,
  AlertCircle,
  Eye,
  X,
  RefreshCw,
  Inbox,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Ban,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type QueuedEmail = {
  id: string;
  status: string;
  to_email: string;
  to_name: string | null;
  from_email: string | null;
  from_name: string | null;
  subject: string;
  html_body?: string;
  text_body?: string | null;
  email_type: string;
  related_type: string | null;
  related_id: string | null;
  tenant_id: string | null;
  created_by: string | null;
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
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "support_new_ticket", label: "Support: New Ticket" },
  { value: "support_user_comment", label: "Support: User Comment" },
  { value: "support_admin_comment", label: "Support: Admin Comment" },
  { value: "support_status_change", label: "Support: Status Change" },
  { value: "contact_form", label: "Contact Form" },
  { value: "user_welcome", label: "User: Welcome" },
  { value: "user_invite", label: "User: Invite" },
  { value: "user_password_reset", label: "User: Password Reset" },
  { value: "user_email_verify", label: "User: Email Verify" },
  { value: "user_account_update", label: "User: Account Update" },
  { value: "post_scheduled", label: "Posting: Scheduled" },
  { value: "post_published", label: "Posting: Published" },
  { value: "post_failed", label: "Posting: Failed" },
  { value: "post_reminder", label: "Posting: Reminder" },
  { value: "social_connected", label: "Social: Connected" },
  { value: "social_disconnected", label: "Social: Disconnected" },
  { value: "social_auth_expiring", label: "Social: Auth Expiring" },
  { value: "billing_invoice", label: "Billing: Invoice" },
  { value: "billing_payment_failed", label: "Billing: Payment Failed" },
  { value: "billing_plan_changed", label: "Billing: Plan Changed" },
  { value: "system_alert", label: "System: Alert" },
  { value: "system_maintenance", label: "System: Maintenance" },
  { value: "general", label: "General" },
];

const PAGE_SIZE_OPTIONS = [10, 50, 100, 500];

function getStatusStyle(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "processing":
      return "bg-blue-100 text-blue-700";
    case "sent":
      return "bg-green-100 text-green-700";
    case "failed":
      return "bg-red-100 text-red-700";
    case "cancelled":
      return "bg-gray-100 text-gray-500";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "pending":
      return <Clock className="w-3.5 h-3.5" />;
    case "processing":
      return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    case "sent":
      return <CheckCircle2 className="w-3.5 h-3.5" />;
    case "failed":
      return <XCircle className="w-3.5 h-3.5" />;
    case "cancelled":
      return <Ban className="w-3.5 h-3.5" />;
    default:
      return null;
  }
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTypeLabel(emailType: string) {
  const found = TYPE_OPTIONS.find((t) => t.value === emailType);
  if (found) return found.label;
  return emailType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatFullDate(dateString: string | null) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function buildPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}

export default function AdminEmailQueuePage() {
  const [emails, setEmails] = useState<QueuedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  const [selectedEmail, setSelectedEmail] = useState<QueuedEmail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [bodyTab, setBodyTab] = useState<"html" | "text">("html");

  // Debounce search input
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const loadEmails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("email_type", typeFilter);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      params.set("page", String(page));
      params.set("limit", String(pageSize));

      const res = await fetch(`/api/v1/admin/email-queue?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.error?.message || `Failed to load queue (${res.status})`
        );
      }

      const body = await res.json();
      const data = body.data ?? body;
      setEmails(data.emails ?? []);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 1);
      if (data.statusCounts) setStatusCounts(data.statusCounts);
    } catch (err: any) {
      setError(err.message || "Failed to load email queue");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, debouncedSearch, page, pageSize]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  // Reset to page 1 when filters/search/pageSize change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, debouncedSearch, pageSize]);

  async function openDetail(emailId: string) {
    setDetailLoading(true);
    setBodyTab("html");
    try {
      const res = await fetch(`/api/v1/admin/email-queue/${emailId}`);
      if (!res.ok) throw new Error("Failed to load email details");
      const body = await res.json();
      setSelectedEmail(body.data?.email ?? body.email);
    } catch {
      setSelectedEmail(emails.find((e) => e.id === emailId) ?? null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCancel(emailId: string) {
    setCancelling(emailId);
    try {
      const res = await fetch("/api/v1/admin/email-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: emailId, action: "cancel" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || "Failed to cancel");
      }
      await loadEmails();
      if (selectedEmail?.id === emailId) {
        setSelectedEmail((prev) =>
          prev ? { ...prev, status: "cancelled" } : null
        );
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCancelling(null);
    }
  }

  function getRelatedLink(
    relatedType: string | null,
    relatedId: string | null
  ) {
    if (!relatedType || !relatedId) return null;
    if (relatedType === "support_ticket") {
      return `/admin/support/tickets/${relatedId}`;
    }
    return null;
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Email Queue</h1>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {total} total
            </span>
            {(statusCounts.pending ?? 0) > 0 && (
              <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {statusCounts.pending} pending
              </span>
            )}
            {(statusCounts.processing ?? 0) > 0 && (
              <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                {statusCounts.processing} processing
              </span>
            )}
            {(statusCounts.failed ?? 0) > 0 && (
              <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                {statusCounts.failed} failed
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Queued emails waiting for the sending engine. Inspect status,
            recipient, and content.
          </p>
        </div>
        <button
          onClick={loadEmails}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by recipient or subject..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 text-gray-300 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-gray-400">Loading email queue...</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={loadEmails}
            className="mt-4 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : emails.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-sm text-gray-500 font-medium">
            {statusFilter !== "all" || typeFilter !== "all" || debouncedSearch
              ? "No emails match your filters"
              : "No emails in queue"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {statusFilter !== "all" || typeFilter !== "all" || debouncedSearch
              ? "Try adjusting your filters or search query."
              : "Emails will appear here when support tickets are created or comments are added."}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-[110px] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="w-[110px] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="w-[180px] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      To
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="w-[140px] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="w-[100px] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="w-[70px] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tries
                    </th>
                    <th className="w-[130px] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {emails.map((email) => {
                    const refLink = getRelatedLink(
                      email.related_type,
                      email.related_id
                    );
                    return (
                      <tr
                        key={email.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusStyle(
                              email.status
                            )}`}
                          >
                            {getStatusIcon(email.status)}
                            {capitalise(email.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 truncate">
                          {formatTypeLabel(email.email_type)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 truncate">
                          {email.to_email}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 truncate">
                          {email.subject}
                        </td>
                        <td className="px-4 py-3 text-xs truncate">
                          {refLink ? (
                            <a
                              href={refLink}
                              className="text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">
                                #{email.related_id?.slice(0, 8)}
                              </span>
                            </a>
                          ) : email.related_type ? (
                            <span className="text-gray-500">
                              {email.related_type}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {formatRelativeTime(email.created_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {email.retry_count}/{email.max_retries}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openDetail(email.id)}
                              className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </button>
                            {email.status === "pending" && (
                              <button
                                onClick={() => handleCancel(email.id)}
                                disabled={cancelling === email.id}
                                className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium disabled:opacity-50"
                              >
                                {cancelling === email.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Ban className="w-3 h-3" />
                                )}
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <p className="text-sm text-gray-500">
              Showing {rangeStart}–{rangeEnd} of {total}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {buildPageNumbers(page, totalPages).map((n, i) =>
                  n === "..." ? (
                    <span
                      key={`dots-${i}`}
                      className="px-1.5 text-xs text-gray-400"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${
                        n === page
                          ? "bg-green-600 text-white"
                          : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {n}
                    </button>
                  )
                )}
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Detail modal */}
      {selectedEmail && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEmail(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getStatusStyle(
                    selectedEmail.status
                  )}`}
                >
                  {getStatusIcon(selectedEmail.status)}
                  {capitalise(selectedEmail.status)}
                </span>
                <h2 className="text-lg font-bold text-gray-900 truncate">
                  {selectedEmail.subject}
                </h2>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Metadata grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="To" value={selectedEmail.to_email} />
                    <Field
                      label="From"
                      value={
                        selectedEmail.from_name && selectedEmail.from_email
                          ? `${selectedEmail.from_name} <${selectedEmail.from_email}>`
                          : selectedEmail.from_email || "—"
                      }
                    />
                    <Field
                      label="Type"
                      value={formatTypeLabel(selectedEmail.email_type)}
                    />
                    <Field
                      label="Priority"
                      value={
                        selectedEmail.priority === 0
                          ? "Normal"
                          : selectedEmail.priority > 0
                            ? `High (${selectedEmail.priority})`
                            : `Low (${selectedEmail.priority})`
                      }
                    />
                    <Field
                      label="Created"
                      value={formatFullDate(selectedEmail.created_at)}
                    />
                    <Field
                      label="Sent"
                      value={formatFullDate(selectedEmail.sent_at)}
                    />
                    <Field
                      label="Attempts"
                      value={`${selectedEmail.retry_count} / ${selectedEmail.max_retries}`}
                    />
                    {selectedEmail.related_type && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-1">
                          Reference
                        </p>
                        {(() => {
                          const link = getRelatedLink(
                            selectedEmail.related_type,
                            selectedEmail.related_id
                          );
                          if (link) {
                            return (
                              <a
                                href={link}
                                className="text-sm text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-1"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                {selectedEmail.related_type} #
                                {selectedEmail.related_id?.slice(0, 8)}
                              </a>
                            );
                          }
                          return (
                            <p className="text-sm text-gray-700">
                              {selectedEmail.related_type}{" "}
                              {selectedEmail.related_id
                                ? `#${selectedEmail.related_id.slice(0, 8)}`
                                : ""}
                            </p>
                          );
                        })()}
                      </div>
                    )}
                    {selectedEmail.tenant_id && (
                      <Field
                        label="Workspace"
                        value={selectedEmail.tenant_id.slice(0, 8) + "..."}
                        mono
                      />
                    )}
                    {selectedEmail.created_by && (
                      <Field
                        label="Triggered by"
                        value={selectedEmail.created_by.slice(0, 8) + "..."}
                        mono
                      />
                    )}
                  </div>

                  {/* Error message */}
                  {selectedEmail.error_message && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-red-500 mb-1">
                        Error
                      </p>
                      <p className="text-sm text-red-700 font-mono whitespace-pre-wrap break-all">
                        {selectedEmail.error_message}
                      </p>
                      {selectedEmail.failed_at && (
                        <p className="text-xs text-red-400 mt-2">
                          Failed at: {formatFullDate(selectedEmail.failed_at)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Body preview */}
                  {(selectedEmail.html_body || selectedEmail.text_body) && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">
                          Email Body
                        </p>
                        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                          <button
                            onClick={() => setBodyTab("html")}
                            className={`px-3 py-1 text-xs font-medium transition-colors ${
                              bodyTab === "html"
                                ? "bg-green-50 text-green-700"
                                : "text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            HTML
                          </button>
                          <button
                            onClick={() => setBodyTab("text")}
                            className={`px-3 py-1 text-xs font-medium transition-colors border-l border-gray-200 ${
                              bodyTab === "text"
                                ? "bg-green-50 text-green-700"
                                : "text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            Text
                          </button>
                        </div>
                      </div>

                      {bodyTab === "html" && selectedEmail.html_body ? (
                        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                          <iframe
                            srcDoc={selectedEmail.html_body}
                            title="Email HTML preview"
                            className="w-full border-0"
                            style={{ minHeight: 300 }}
                            sandbox="allow-same-origin"
                          />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 max-h-[400px] overflow-y-auto">
                          <pre className="text-sm text-gray-700 whitespace-pre-wrap break-words font-mono">
                            {selectedEmail.text_body || "(no text body)"}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cancel action */}
                  {selectedEmail.status === "pending" && (
                    <div className="flex justify-end pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleCancel(selectedEmail.id)}
                        disabled={cancelling === selectedEmail.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {cancelling === selectedEmail.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Ban className="w-4 h-4" />
                        )}
                        Cancel this email
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-1">
        {label}
      </p>
      <p className={`text-sm text-gray-700 break-all ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}
