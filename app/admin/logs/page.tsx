"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import {
  Activity,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Filter,
  Trash2,
  Search,
} from "lucide-react";

// ── Human-readable labels for analyzer log stages ─────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  // Client-side UI events
  "analyzer.ui.submit_clicked":        "User clicked Analyze",
  "analyzer.ui.request_started":       "Analysis request sent to server",
  "analyzer.ui.result_received":       "Analysis result received by browser",
  "analyzer.ui.stage_changed":         "Funnel stage changed",
  "analyzer.ui.cta_clicked":           "User clicked call-to-action button",
  "analyzer.ui.widget_expanded":       "Analyzer widget opened",
  "analyzer.ui.widget_collapsed":      "Analyzer widget minimized",
  "analyzer.ui.fallback_shown":        "Fallback screen shown to user",
  "analyzer.ui.fallback_email_submitted": "User submitted email via fallback",
  "analyzer.ui.fallback_queued":       "Fallback request queued",
  "analyzer.ui.fallback_retry":        "User clicked retry from fallback",
  "analyzer.ui.poll_started":          "Browser started polling for results",
  "analyzer.ui.poll_completed":        "Browser polling completed",
  "analyzer.ui.poll_timeout":          "Browser polling timed out",
  "analyzer.ui.MOCK_PATH_TRIGGERED":   "Warning: AI post preview shown without real data",

  // Server-side API events
  "analyzer.api.start_hit":            "API received analysis request",
  "analyzer.api.input_validated":      "API validated input data",
  "analyzer.api.platform_detected":    "Platform identified from URL",
  "analyzer.api.cache_checked":        "Checked cache for existing analysis",
  "analyzer.api.cache_hit":            "Found existing analysis in cache",
  "analyzer.api.instant_score_created": "Instant score calculated",
  "analyzer.api.pending_record_created": "Pending record saved to database",
  "analyzer.api.result_save_attempt":  "Attempting to save result",
  "analyzer.api.result_saved":         "Result saved to database",
  "analyzer.api.status_marked_completed": "Analysis marked as completed",
  "analyzer.api.normalize_completed":  "AI response formatted for display",
  "analyzer.api.completed":            "Analysis pipeline finished",
  "analyzer.api.failed":               "Analysis pipeline failed",

  // OpenRouter-related events (prefixed for easy searching)
  "analyzer_prompt_input":             "OPENROUTER — Prompt sent to AI model",
  "analyzer_prompt_output":            "OPENROUTER — Response received from AI model",
  "analyzer.api.openrouter_call_started": "OPENROUTER — AI model call started",
  "analyzer.api.openrouter_call_completed": "OPENROUTER — AI model call completed",
  "analyzer.api.openrouter_call_failed": "OPENROUTER — AI model call failed",
  "analyzer.api.openrouter_raw_output": "OPENROUTER — Raw AI model output logged",
  "analyzer.api.json_parse_started":   "OPENROUTER — Parsing AI model response",
  "analyzer.api.json_parse_succeeded": "OPENROUTER — AI response parsed successfully",
  "analyzer.api.json_parse_failed":    "OPENROUTER — Failed to parse AI response",
  "analyzer.api.key_source_resolved":  "OPENROUTER — API key source resolved",
  "analyzer.api.prompt_load_started":  "OPENROUTER — Loading prompt template",
  "analyzer.api.prompt_load_completed": "OPENROUTER — Prompt template loaded",
  "analyzer.api.normalize_started":    "OPENROUTER — Formatting AI response for display",

  // Result polling server events
  "analyzer.api.result_query_started": "Result lookup started",
  "analyzer.api.result_query_completed": "Result lookup completed",
  "analyzer.api.result_lookup_hit":    "Result found in database",
  "analyzer.api.result_lookup_miss":   "Result not found in database",
  "analyzer.api.result_endpoint_hit":  "Result endpoint responded",

  // Other
  "analyzer_failure":                  "Analysis failed",
  "email_queue_created":               "Fallback email queued for delivery",
};

type LimitOption = 50 | 100 | 500;

interface ActivityLogEntry {
  id: string;
  category: string;
  stage: string;
  level: "info" | "warn" | "error" | string;
  analysis_id?: string | null;
  user_id?: string | null;
  user_email?: string | null;
  session_id?: string | null;
  profile_url?: string | null;
  platform?: string | null;
  source?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

interface ActivityPagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

interface ActivityResponse {
  data: ActivityLogEntry[];
  pagination: ActivityPagination;
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const LOGS_KEY = "/api/v1/admin/activity/logs";

export default function AdminLogsPage() {
  const [limit, setLimit] = useState<LimitOption>(50);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("analyzer");
  const [clearing, setClearing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm.trim(), 400);

  useEffect(() => {
    setOffset(0);
    setExpandedId(null);
  }, [debouncedSearch]);

  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (categoryFilter) {
    query.set("category", categoryFilter);
  }
  if (debouncedSearch) {
    query.set("search", debouncedSearch);
  }
  const logsUrl = `${LOGS_KEY}?${query.toString()}`;

  const { data, error, isLoading, mutate: mutateLogs } = useSWR<ActivityResponse>(
    logsUrl,
    fetcher
  );

  const pagination = data?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 0;
  const currentPage = pagination ? Math.floor(pagination.offset / pagination.limit) + 1 : 1;

  const handleLimitChange = (value: LimitOption) => {
    setLimit(value);
    setOffset(0);
    setExpandedId(null);
  };

  const handlePrev = () => {
    setOffset((prev) => Math.max(0, prev - limit));
    setExpandedId(null);
  };

  const handleNext = () => {
    if (pagination?.has_more) {
      setOffset((prev) => prev + limit);
      setExpandedId(null);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("Clear all activity logs" + (categoryFilter ? ` for category \"${categoryFilter}\"` : "") + "? This cannot be undone.")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/v1/admin/activity/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: categoryFilter || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to clear");
      await mutateLogs();
      setOffset(0);
      setExpandedId(null);
    } finally {
      setClearing(false);
    }
  };

  const formatTimestamp = (ts: string) =>
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ts));

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center">
          <Activity className="w-5 h-5 text-slate-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Activity Logs</h1>
          <p className="text-xs text-gray-500">
            End-to-end trace of key flows. Filtered to the Social Analyzer by default.
          </p>
        </div>
      </div>

      {/* Toolbar: Search + Clear Logs */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-white border border-gray-200 rounded-xl">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logs (e.g. OPENROUTER, failed, instagram...)"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            aria-label="Search activity logs"
          />
        </div>
        <button
          type="button"
          onClick={handleClearLogs}
          disabled={clearing}
          className="inline-flex items-center gap-2 rounded-lg border-2 border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
          aria-label="Clear activity logs"
        >
          {clearing ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="w-4 h-4" aria-hidden />
          )}
          Clear Logs
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {/* Filters: Category + rows per page */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" aria-hidden />
            <span className="text-xs text-gray-500">Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setOffset(0);
                setExpandedId(null);
              }}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label="Filter by category"
            >
              <option value="">All</option>
              <option value="analyzer">Analyzer</option>
              <option value="wizard">Wizard</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Rows per page</span>
            <select
              value={limit}
              onChange={(e) => handleLimitChange(Number(e.target.value) as LimitOption)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label="Rows per page"
            >
              {[50, 100, 500].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-12">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading activity logs...
          </div>
        )}

        {error && !isLoading && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>Failed to load activity logs: {error.message}</span>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {(data?.data ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                {debouncedSearch
                  ? `No logs matching "${debouncedSearch}".`
                  : "No activity logs recorded yet."}
              </p>
            ) : (
              <div className="space-y-2">
                {(data?.data ?? []).map((entry) => {
                  const isExpanded = expandedId === entry.id;
                  const levelColor =
                    entry.level === "error"
                      ? "bg-red-500"
                      : entry.level === "warn"
                      ? "bg-amber-500"
                      : "bg-emerald-500";

                  const label = STAGE_LABELS[entry.stage] ?? entry.stage;
                  const isOpenRouter = label.startsWith("OPENROUTER");

                  return (
                    <div
                      key={entry.id}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${levelColor}`}
                          aria-hidden="true"
                        />
                        <span className="text-[11px] font-mono text-gray-400 shrink-0">
                          {entry.category}
                        </span>
                        <span className="truncate flex-1">
                          {isOpenRouter ? (
                            <>
                              <span className="text-xs font-bold text-indigo-600">OPENROUTER</span>
                              <span className="text-xs font-medium text-gray-800">
                                {" — " + label.replace(/^OPENROUTER\s*—?\s*/, "")}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-medium text-gray-800">{label}</span>
                          )}
                          {STAGE_LABELS[entry.stage] && (
                            <span className="ml-1.5 text-[10px] font-mono text-gray-400">
                              {entry.stage}
                            </span>
                          )}
                        </span>
                        {entry.profile_url && (
                          <span className="hidden md:inline text-[11px] text-gray-500 truncate max-w-xs">
                            {entry.profile_url}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400 shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(entry.created_at)}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 rotate-180" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-700 space-y-2">
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {entry.user_id && (
                              <div className="flex items-center gap-1 text-gray-500">
                                <User className="w-3 h-3" />
                                <span>
                                  {entry.user_email ||
                                    `${entry.user_id.slice(0, 6)}…${entry.user_id.slice(-4)}`}
                                </span>
                              </div>
                            )}
                            {entry.analysis_id && (
                              <div className="text-gray-500">
                                <span className="font-semibold">analysis_id:</span>{" "}
                                <span className="font-mono">
                                  {entry.analysis_id.slice(0, 10)}…
                                </span>
                              </div>
                            )}
                            {entry.session_id && (
                              <div className="text-gray-500">
                                <span className="font-semibold">session:</span>{" "}
                                <span className="font-mono">
                                  {entry.session_id.slice(0, 10)}…
                                </span>
                              </div>
                            )}
                            {entry.platform && (
                              <div className="text-gray-500">
                                <span className="font-semibold">platform:</span>{" "}
                                {entry.platform}
                              </div>
                            )}
                            {entry.source && (
                              <div className="text-gray-500">
                                <span className="font-semibold">source:</span>{" "}
                                {entry.source}
                              </div>
                            )}
                          </div>

                          {entry.profile_url && (
                            <div className="text-gray-600 break-all">
                              <span className="font-semibold">profile_url:</span>{" "}
                              {entry.profile_url}
                            </div>
                          )}

                          {entry.details && (
                            <pre className="mt-1 max-h-56 overflow-auto rounded-md bg-gray-900 text-[11px] text-gray-100 p-2">
                              {JSON.stringify(entry.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination controls */}
            {pagination && pagination.total > 0 && (
              <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <div>
                  Showing{" "}
                  <span className="font-semibold">
                    {pagination.offset + 1}–
                    {Math.min(
                      pagination.offset + pagination.limit,
                      pagination.total
                    )}
                  </span>{" "}
                  of <span className="font-semibold">{pagination.total}</span>{" "}
                  entries
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={pagination.offset === 0}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    Prev
                  </button>
                  <span className="text-[11px] text-gray-400">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!pagination.has_more}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
