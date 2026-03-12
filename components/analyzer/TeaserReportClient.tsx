"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import TeaserReport from "@/components/analyzer/TeaserReport";
import type { Instant, Teaser } from "@/lib/analyzer/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type AnalysisStatus = "pending" | "completed" | "failed";

interface ResultPayload {
  analysis_id: string;
  status: AnalysisStatus;
  instant: Instant | null;
  teaser: Teaser | null;
  full_report: unknown | null;
}

interface Props {
  analysisId: string;
}

// ── Polling constants ─────────────────────────────────────────────────────────

const POLL_INTERVAL = 2_000;
const MAX_POLLS = 60; // 2 min total

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div
      className="w-full max-w-2xl mx-auto rounded-2xl overflow-hidden"
      style={{
        background: "#0e1117",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.45)",
      }}
      role="status"
      aria-label="Loading your analysis"
    >
      {/* Header */}
      <div
        className="px-5 pt-5 pb-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="w-8 h-8 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-32 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="h-2 w-20 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
        </div>
      </div>

      {/* Score placeholder */}
      <div className="px-5 py-5 flex flex-col items-center gap-4">
        <div
          className="w-28 h-28 rounded-full animate-pulse"
          style={{ background: "rgba(255,255,255,0.07)" }}
        />
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Analysing your profile…</span>
        </div>
      </div>

      {/* Skeleton rows */}
      <div className="px-5 pb-6 space-y-3">
        {[0.9, 0.7, 0.8, 0.6, 0.75].map((w, i) => (
          <div
            key={i}
            className="h-8 rounded-lg animate-pulse"
            style={{ width: `${w * 100}%`, background: "rgba(255,255,255,0.05)", animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="w-full max-w-2xl mx-auto rounded-2xl px-6 py-10 text-center"
      style={{
        background: "#0e1117",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
      role="alert"
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.2)" }}
      >
        <AlertCircle className="w-6 h-6 text-red-400" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-white/80 mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-white/40 mb-6 max-w-xs mx-auto leading-relaxed">
        {message}
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white/70 transition-colors"
        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export default function TeaserReportClient({ analysisId }: Props) {
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const fetchResult = useCallback(async (): Promise<"done" | "pending" | "error"> => {
    try {
      const res = await fetch(`/api/analyzer/result?analysis_id=${analysisId}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 404) {
          setError("This analysis was not found. It may have expired or the link is invalid.");
          return "error";
        }
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message ?? "Failed to load your analysis.");
        return "error";
      }

      const data: ResultPayload = await res.json();
      setResult(data);

      if (data.status === "completed" || data.status === "failed") {
        setLoading(false);
        return "done";
      }

      return "pending";
    } catch {
      setError("A network error occurred. Please check your connection and try again.");
      return "error";
    }
  }, [analysisId]);

  // Poll until completed / failed / max polls / error
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;
    let count = 0;

    async function poll() {
      if (!mounted) return;

      const outcome = await fetchResult();
      count += 1;
      setPollCount(count);

      if (outcome === "done" || outcome === "error") {
        setLoading(false);
        return;
      }

      if (count >= MAX_POLLS) {
        setError("Analysis is taking longer than expected. Please refresh the page.");
        setLoading(false);
        return;
      }

      if (mounted) {
        timer = setTimeout(poll, POLL_INTERVAL);
      }
    }

    poll();

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [fetchResult]);

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    setPollCount(0);
    setResult(null);
  }, []);

  const handleUnlock = useCallback(() => {
    // Redirect to signup with analysis context
    window.location.href = `/signup?from=analyzer&analysis_id=${analysisId}`;
  }, [analysisId]);

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {/* Loading */}
        {loading && !error && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <LoadingSkeleton />
            {pollCount > 3 && (
              <p className="text-center text-xs text-white/25 mt-4">
                Still working… {Math.min(100, Math.round((pollCount / MAX_POLLS) * 100))}%
              </p>
            )}
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ErrorState message={error} onRetry={handleRetry} />
          </motion.div>
        )}

        {/* Result */}
        {!loading && !error && result && result.status === "completed" && result.instant && result.teaser && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          >
            <TeaserReport
              instant={result.instant}
              teaser={result.teaser}
              profileUrl={`https://${result.analysis_id}`}
              onUnlock={handleUnlock}
            />
          </motion.div>
        )}

        {/* Failed status */}
        {!loading && !error && result && result.status === "failed" && result.instant && (
          <motion.div
            key="failed"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          >
            <TeaserReport
              instant={result.instant}
              teaser={{
                growth_insights: [
                  "Your profile was partially analysed. Sign up for a full deep-dive.",
                ],
                ai_post_preview: { title: "", caption: "", hashtags: [] },
                benchmark_text: "",
              }}
              profileUrl=""
              onUnlock={handleUnlock}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
