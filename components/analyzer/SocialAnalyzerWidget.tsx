"use client";

import { useState, useRef, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Loader2, CheckCircle2, AlertCircle, Sparkles, TrendingUp, Zap } from "lucide-react";

// ── Platform registry ──────────────────────────────────────────────────────

const PLATFORMS = [
  { id: "tiktok",    label: "TikTok",     color: "#010101", pattern: /tiktok\.com/i },
  { id: "instagram", label: "Instagram",  color: "#E1306C", pattern: /instagram\.com/i },
  { id: "youtube",   label: "YouTube",    color: "#FF0000", pattern: /youtube\.com|youtu\.be/i },
  { id: "facebook",  label: "Facebook",   color: "#1877F2", pattern: /facebook\.com|fb\.com/i },
  { id: "linkedin",  label: "LinkedIn",   color: "#0A66C2", pattern: /linkedin\.com/i },
  { id: "twitter",   label: "X",          color: "#14171A", pattern: /x\.com|twitter\.com/i },
  { id: "threads",   label: "Threads",    color: "#101010", pattern: /threads\.net/i },
  { id: "pinterest", label: "Pinterest",  color: "#E60023", pattern: /pinterest\.com/i },
  { id: "reddit",    label: "Reddit",     color: "#FF4500", pattern: /reddit\.com/i },
  { id: "bluesky",   label: "Bluesky",    color: "#0085FF", pattern: /bsky\.app/i },
] as const;

type PlatformId = (typeof PLATFORMS)[number]["id"];

// ── Platform SVG icons ─────────────────────────────────────────────────────

function PlatformIcon({ id, size = 16 }: { id: PlatformId; size?: number }) {
  const s = size;
  switch (id) {
    case "tiktok":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.77a4.85 4.85 0 0 1-1.01-.08z"/>
        </svg>
      );
    case "instagram":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
        </svg>
      );
    case "youtube":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      );
    case "facebook":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      );
    case "linkedin":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      );
    case "twitter":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.254 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    case "threads":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.858 1.205 8.61.024 12.19 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.347-.79-.962-1.446-1.813-1.916-.18 1.ield-.414 2.05-1.196 2.848-1.016 1.037-2.397 1.573-4.183 1.598-.99 0-3.98-.212-3.98-3.35 0-3.14 2.99-3.352 3.98-3.352.33 0 .632.016.91.047-.143-.617-.463-1.138-.932-1.52-.61-.5-1.44-.756-2.46-.763-1.538 0-2.65.605-3.418 1.852l-1.757-1.04C5.48 8.07 7.086 7.11 9.195 7.11c1.49.01 2.73.39 3.683 1.133.845.657 1.39 1.578 1.62 2.725.44-.03.9-.042 1.374-.037 1.94.02 3.481.624 4.576 1.795 1.07 1.144 1.61 2.71 1.582 4.537-.02 1.27-.325 2.496-.882 3.545-1.064 2.004-2.9 3.151-5.23 3.192H12.186z"/>
        </svg>
      );
    case "pinterest":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
        </svg>
      );
    case "reddit":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
        </svg>
      );
    case "bluesky":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.204-.659-.3-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/>
        </svg>
      );
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

type WidgetState =
  | "idle"
  | "validating"
  | "submitting"
  | "instant"   // instant results shown, AI still processing
  | "loading"   // AI processing after instant
  | "error";

interface InstantResult {
  platform_detected: string;
  creator_score: number;
  keywords_detected: string[];
  posting_frequency_estimate: "low" | "medium" | "high" | "unknown";
  strengths: string[];
  opportunities: string[];
}

interface StartResponse {
  analysis_id: string;
  status: "pending" | "completed";
  instant: InstantResult;
  teaser?: unknown;
  cached?: boolean;
}

// ── URL validation ──────────────────────────────────────────────────────────

function detectPlatformFromUrl(url: string): PlatformId | null {
  for (const p of PLATFORMS) {
    if (p.pattern.test(url)) return p.id;
  }
  return null;
}

function isValidProfileUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") &&
      detectPlatformFromUrl(url) !== null;
  } catch {
    return false;
  }
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return `anon-${Math.random()}`;
  let id = sessionStorage.getItem("_az_sid");
  if (!id) {
    id = `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("_az_sid", id);
  }
  return id;
}

// ── Score arc ──────────────────────────────────────────────────────────────

function ScoreArc({ score, size = 80 }: { score: number; size?: number }) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const arc = circumference * 0.75; // 270° arc
  const fill = arc * (score / 100);
  const rotation = 135; // start at bottom-left

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={size * 0.075}
        strokeDasharray={`${arc} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(${rotation} ${cx} ${cy})`}
      />
      {/* Fill */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="#16a34a"
        strokeWidth={size * 0.075}
        strokeDasharray={`${fill} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(${rotation} ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray 1s cubic-bezier(0.34,1.56,0.64,1)" }}
      />
      <text
        x={cx} y={cy + 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize={size * 0.26}
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {score}
      </text>
      <text
        x={cx} y={cy + size * 0.2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.5)"
        fontSize={size * 0.11}
        fontFamily="system-ui, sans-serif"
      >
        /100
      </text>
    </svg>
  );
}

// ── AI scanning animation ──────────────────────────────────────────────────

function ScanningLines() {
  return (
    <div className="flex flex-col gap-2 w-full" aria-hidden="true">
      {[0.9, 0.7, 0.8, 0.6].map((w, i) => (
        <motion.div
          key={i}
          className="h-2.5 rounded-full bg-white/10"
          style={{ width: `${w * 100}%` }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.4, delay: i * 0.18, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

// ── Main widget ────────────────────────────────────────────────────────────

export default function SocialAnalyzerWidget({ onClose }: { onClose?: () => void }) {
  const inputId = useId();
  const [url, setUrl] = useState("");
  const [state, setState] = useState<WidgetState>("idle");
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<PlatformId | null>(null);
  const [result, setResult] = useState<StartResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect platform as user types
  const handleUrlChange = useCallback((v: string) => {
    setUrl(v);
    setValidationMsg(null);
    const pid = detectPlatformFromUrl(v.trim());
    setDetectedPlatform(pid);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = url.trim();

    if (!trimmed) {
      setValidationMsg("Please paste a profile URL to get started.");
      inputRef.current?.focus();
      return;
    }

    if (!isValidProfileUrl(trimmed)) {
      const hasDomain = PLATFORMS.some(p => p.pattern.test(trimmed));
      if (!hasDomain) {
        setValidationMsg("Paste a URL from TikTok, Instagram, YouTube, LinkedIn, Facebook, X, Threads, Pinterest, Reddit or Bluesky.");
      } else {
        setValidationMsg("That doesn't look like a valid URL. Make sure it starts with https://");
      }
      inputRef.current?.focus();
      return;
    }

    setState("submitting");
    setValidationMsg(null);
    setErrorMsg(null);

    try {
      const sessionId = getOrCreateSessionId();
      const res = await fetch("/api/analyzer/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-analyzer-session-id": sessionId,
        },
        body: JSON.stringify({ profile_url: trimmed }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error?.message ?? "Too many requests. Please try again later.";
        setState("error");
        setErrorMsg(msg);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
      }

      const data: StartResponse = await res.json();
      setResult(data);
      setState("instant");

      // After a brief delay showing the instant data, transition to AI loading
      setTimeout(() => setState("loading"), 2200);
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }, [url]);

  const handleReset = useCallback(() => {
    setUrl("");
    setResult(null);
    setDetectedPlatform(null);
    setValidationMsg(null);
    setErrorMsg(null);
    setState("idle");
  }, []);

  const isSubmitting = state === "submitting";
  const showResults = state === "instant" || state === "loading";

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full"
      style={{ maxWidth: 520 }}
      role="region"
      aria-label="Social media profile analyzer"
    >
      {/* Card */}
      <div className="rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(145deg, #0f1117 0%, #171c26 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-green-400" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-widest uppercase text-green-400">
              Free AI Audit
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close analyzer"
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="px-5 pt-3 pb-5">
          <AnimatePresence mode="wait">
            {/* ── IDLE / INPUT state ─────────────────────────────────────── */}
            {(state === "idle" || state === "validating" || state === "submitting") && (
              <motion.div
                key="input-panel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-xl font-bold text-white leading-tight text-balance mt-1">
                  Get Your Social Media Score
                </h2>
                <p className="mt-1 text-sm text-white/55 leading-relaxed">
                  Paste your profile and see how your content performs.
                </p>

                {/* Platform strip */}
                <div className="flex items-center gap-2 mt-3 flex-wrap" aria-label="Supported platforms">
                  {PLATFORMS.map((p) => {
                    const isActive = detectedPlatform === p.id;
                    return (
                      <motion.div
                        key={p.id}
                        animate={{ scale: isActive ? 1.15 : 1, opacity: isActive ? 1 : 0.4 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        title={p.label}
                        className="rounded"
                        style={{ color: isActive ? p.color : "white" }}
                        aria-label={p.label}
                      >
                        <PlatformIcon id={p.id} size={15} />
                      </motion.div>
                    );
                  })}
                </div>

                {/* Input + button */}
                <div className="mt-3 flex flex-col gap-2">
                  <div
                    className="flex items-center rounded-xl overflow-hidden transition-all"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: validationMsg
                        ? "1px solid rgba(239,68,68,0.6)"
                        : detectedPlatform
                        ? "1px solid rgba(22,163,74,0.5)"
                        : "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <label htmlFor={inputId} className="sr-only">
                      Social profile URL
                    </label>
                    <input
                      id={inputId}
                      ref={inputRef}
                      type="url"
                      value={url}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !isSubmitting && handleSubmit()}
                      placeholder="Paste your Instagram, TikTok, YouTube or LinkedIn profile"
                      disabled={isSubmitting}
                      className="flex-1 bg-transparent text-white text-sm px-4 py-3 outline-none placeholder:text-white/30 min-w-0"
                      aria-describedby={validationMsg ? `${inputId}-err` : undefined}
                      autoComplete="url"
                    />
                    {detectedPlatform && !isSubmitting && (
                      <div className="px-3 flex-shrink-0" aria-hidden="true">
                        <div style={{ color: PLATFORMS.find(p => p.id === detectedPlatform)?.color ?? "white" }}>
                          <PlatformIcon id={detectedPlatform} size={16} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Validation message */}
                  <AnimatePresence>
                    {validationMsg && (
                      <motion.p
                        id={`${inputId}-err`}
                        role="alert"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-1.5 text-xs text-red-400 px-1"
                      >
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                        {validationMsg}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* CTA button */}
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-5 text-sm font-bold tracking-wide transition-all"
                    style={{
                      background: isSubmitting ? "rgba(22,163,74,0.4)" : "#16a34a",
                      color: "white",
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                    }}
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <span>Analyze My Profile</span>
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>

                {/* Microcopy */}
                <p className="mt-2.5 text-center text-xs text-white/30">
                  Takes about 5 seconds. No signup required.
                </p>
              </motion.div>
            )}

            {/* ── RESULTS state ──────────────────────────────────────────── */}
            {showResults && result && (
              <motion.div
                key="results-panel"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Score row */}
                <div className="flex items-center gap-4 mt-1">
                  <ScoreArc score={result.instant.creator_score} size={76} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" aria-hidden="true" />
                      <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">
                        Instant Score
                      </span>
                    </div>
                    <p className="text-white text-sm font-semibold text-balance leading-snug">
                      {result.instant.platform_detected.charAt(0).toUpperCase() +
                        result.instant.platform_detected.slice(1)}{" "}
                      profile detected
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {result.instant.keywords_detected.slice(0, 3).map((kw) => (
                        <span
                          key={kw}
                          className="text-xs rounded-full px-2 py-0.5 font-medium"
                          style={{ background: "rgba(22,163,74,0.15)", color: "#4ade80" }}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="my-3 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />

                {/* Strengths + Opportunities */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-green-400" aria-hidden="true" />
                      <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Strengths</span>
                    </div>
                    <ul className="flex flex-col gap-1">
                      {result.instant.strengths.slice(0, 2).map((s) => (
                        <li key={s} className="text-xs text-white/70 leading-relaxed flex items-start gap-1">
                          <span className="text-green-400 mt-0.5" aria-hidden="true">+</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                      <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Opportunities</span>
                    </div>
                    <ul className="flex flex-col gap-1">
                      {result.instant.opportunities.slice(0, 2).map((o) => (
                        <li key={o} className="text-xs text-white/70 leading-relaxed flex items-start gap-1">
                          <span className="text-amber-400 mt-0.5" aria-hidden="true">→</span>
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Divider */}
                <div className="my-3 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />

                {/* AI loading state */}
                <AnimatePresence mode="wait">
                  {state === "loading" ? (
                    <motion.div
                      key="ai-loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Loader2 className="w-3.5 h-3.5 text-green-400 animate-spin flex-shrink-0" aria-hidden="true" />
                        <span className="text-xs text-white/50">AI deep analysis running...</span>
                      </div>
                      <ScanningLines />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="ai-pending-hint"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-green-400 animate-pulse flex-shrink-0" aria-hidden="true" />
                      <span className="text-xs text-white/50">Launching deep AI analysis...</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Unlock CTA */}
                <div
                  className="mt-3 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                  style={{ background: "rgba(22,163,74,0.12)", border: "1px solid rgba(22,163,74,0.25)" }}
                >
                  <p className="text-xs text-white/70 leading-relaxed text-balance">
                    Sign up free to unlock your full report, viral post ideas and posting schedule.
                  </p>
                  <a
                    href="/auth"
                    className="flex-shrink-0 text-xs font-bold text-green-400 hover:text-green-300 transition-colors whitespace-nowrap"
                  >
                    Unlock&nbsp;&rarr;
                  </a>
                </div>

                <button
                  onClick={handleReset}
                  className="mt-3 w-full text-xs text-white/30 hover:text-white/60 transition-colors text-center"
                >
                  Analyze another profile
                </button>
              </motion.div>
            )}

            {/* ── ERROR state ────────────────────────────────────────────── */}
            {state === "error" && (
              <motion.div
                key="error-panel"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="py-2"
              >
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-white mb-0.5">Unable to analyze</p>
                    <p className="text-xs text-white/50 leading-relaxed">{errorMsg}</p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold"
                  style={{ background: "rgba(255,255,255,0.06)", color: "white" }}
                >
                  Try again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
