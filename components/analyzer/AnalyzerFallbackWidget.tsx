"use client";

/**
 * AnalyzerFallbackWidget
 *
 * Shown when the main analyzer service fails, times out, or is under high
 * demand. Captures an optional email address, calls /api/analyzer/fallback
 * to queue the request, and confirms delivery without creating a dead-end.
 *
 * States:
 *   idle     — initial message + optional email input + CTA
 *   loading  — waiting for API response
 *   queued   — confirmation: with email or without
 *   error    — API call failed (very rarely)
 */

import { useState, useId, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Loader2, CheckCircle2, AlertCircle, Clock, ArrowRight } from "lucide-react";
import { logAnalyzerUiEvent } from "@/lib/analyzer/clientLog";

// ── Types ─────────────────────────────────────────────────────────────────────

type FallbackState = "idle" | "loading" | "queued" | "error";

interface Props {
  /** The profile URL already entered by the user so it can be pre-queued */
  profileUrl: string;
  /** Platform (e.g. instagram, tiktok) when known — sent with queue request */
  platform?: string | null;
  /** Failure type/code when known (e.g. AI_ERROR, PARSE_OR_SCHEMA_FAILURE) — sent with queue request */
  failureType?: string | null;
  /** Called when the user wants to retry the main flow */
  onRetry?: () => void;
}

// ── Email validation ──────────────────────────────────────────────────────────

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnalyzerFallbackWidget({ profileUrl, platform, failureType, onRetry }: Props) {
  const emailId = useId();
  const [state, setState] = useState<FallbackState>("idle");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [hasEmail, setHasEmail] = useState(false);

  useEffect(() => {
    logAnalyzerUiEvent("analyzer.ui.**FALLBACK** shown", {
      profileUrl,
      platform,
      details: {
        note: "FALLBACK UI PRESENTED TO USER",
        failureType: failureType ?? null,
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleQueue() {
    const trimmedEmail = email.trim();
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError(null);

    setState("loading");

    try {
      const res = await fetch("/api/analyzer/fallback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_url: profileUrl,
          ...(trimmedEmail ? { email: trimmedEmail } : {}),
          ...(platform && platform.trim() ? { platform: platform.trim() } : {}),
          ...(failureType && failureType.trim() ? { failure_type: failureType.trim() } : {}),
        }),
      });

      if (res.ok || res.status === 202) {
        setHasEmail(!!trimmedEmail);
        setState("queued");
      } else {
        setState("error");
      }
    } catch {
      setHasEmail(!!trimmedEmail);
      setState("queued");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{
        background: "#0e1117",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
      }}
      role="region"
      aria-label="Analyzer temporarily unavailable"
    >
      <AnimatePresence mode="wait" initial={false}>

        {/* ── Idle ─────────────────────────────────────────────────────── */}
        {state === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="px-5 py-7"
          >
            {/* Status header */}
            <div className="flex items-start gap-3 mb-5">
              <div
                className="mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(234,179,8,0.12)",
                  border: "1px solid rgba(234,179,8,0.25)",
                }}
              >
                <Clock className="w-4.5 h-4.5 text-yellow-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">
                  We&apos;re experiencing high demand
                </p>
                <p className="text-xs text-white/45 mt-1 leading-relaxed">
                  Your analysis can still be prepared and emailed to you — it just
                  might take a few minutes while we clear the queue.
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px mb-5" style={{ background: "rgba(255,255,255,0.06)" }} />

            {/* Email input */}
            <div className="mb-4">
              <label
                htmlFor={emailId}
                className="block text-xs font-medium text-white/50 mb-1.5"
              >
                Email address{" "}
                <span className="text-white/25 font-normal">(optional but recommended)</span>
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id={emailId}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleQueue();
                  }}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: emailError
                      ? "1px solid rgba(220,38,38,0.5)"
                      : "1px solid rgba(255,255,255,0.1)",
                  }}
                  aria-describedby={emailError ? `${emailId}-error` : undefined}
                  aria-invalid={!!emailError}
                />
              </div>
              {emailError && (
                <p
                  id={`${emailId}-error`}
                  className="mt-1.5 text-xs text-red-400"
                  role="alert"
                >
                  {emailError}
                </p>
              )}
              <p className="mt-1.5 text-xs text-white/25">
                We&apos;ll email you as soon as your report is ready. No spam, ever.
              </p>
            </div>

            {/* CTA */}
            <motion.button
              onClick={handleQueue}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ background: "#16a34a" }}
            >
              Notify me when ready
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </motion.button>

            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full mt-3 text-xs text-white/30 hover:text-white/50 transition-colors py-1"
              >
                Try the analyzer again
              </button>
            )}
          </motion.div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {state === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-5 py-10 flex flex-col items-center gap-3"
            aria-live="polite"
            aria-label="Queuing your request"
          >
            <Loader2 className="w-6 h-6 text-green-500 animate-spin" aria-hidden="true" />
            <p className="text-sm text-white/40">Queuing your request…</p>
          </motion.div>
        )}

        {/* ── Queued ────────────────────────────────────────────────────── */}
        {state === "queued" && (
          <motion.div
            key="queued"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="px-5 py-8 flex flex-col items-center text-center gap-4"
            role="status"
            aria-live="polite"
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(22,163,74,0.15)",
                border: "1px solid rgba(22,163,74,0.3)",
              }}
            >
              <CheckCircle2 className="w-6 h-6 text-green-400" aria-hidden="true" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white mb-1.5">
                {hasEmail ? "You're in the queue" : "Request received"}
              </h3>
              <p className="text-xs text-white/45 max-w-xs leading-relaxed">
                {hasEmail
                  ? "We'll email you the moment your Social Growth Report is ready. Usually within a few minutes."
                  : "Your analysis has been queued. You can also sign up for a free account to track its status and get notified automatically."}
              </p>
            </div>

            {!hasEmail && (
              <a
                href="/auth?mode=register"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: "#16a34a" }}
              >
                Create free account
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>
            )}

            {onRetry && (
              <button
                onClick={onRetry}
                className="text-xs text-white/25 hover:text-white/45 transition-colors"
              >
                Try the analyzer again
              </button>
            )}
          </motion.div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {state === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="px-5 py-8 flex flex-col items-center text-center gap-4"
            role="alert"
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(220,38,38,0.1)",
                border: "1px solid rgba(220,38,38,0.2)",
              }}
            >
              <AlertCircle className="w-6 h-6 text-red-400" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white/80 mb-1">
                Something went wrong
              </h3>
              <p className="text-xs text-white/40 max-w-xs leading-relaxed">
                We couldn&apos;t queue your request right now. Please try the analyzer again
                in a moment.
              </p>
            </div>
            {onRetry && (
              <button
                onClick={() => {
                  setState("idle");
                  onRetry();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 transition-colors"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                Try again
              </button>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
