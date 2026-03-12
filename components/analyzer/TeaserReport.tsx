"use client";

import { motion } from "framer-motion";
import {
  Lock,
  TrendingUp,
  CheckCircle2,
  Sparkles,
  FileText,
  Zap,
  Clock,
  PenSquare,
  Users,
  ArrowRight,
  BarChart2,
  ChevronRight,
} from "lucide-react";
import type { Instant, Teaser } from "@/lib/analyzer/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeaserReportProps {
  instant: Instant;
  teaser: Teaser;
  profileUrl: string;
  analysisId: string;
  /** @deprecated use analysisId to generate the unlock href instead */
  onUnlock?: () => void;
}

// ── Score arc ─────────────────────────────────────────────────────────────────

function ScoreArc({ score }: { score: number }) {
  const size = 120;
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const arc = circumference * 0.75;
  const fill = arc * (score / 100);
  const rotation = 135;

  const color =
    score >= 75 ? "#16a34a" : score >= 50 ? "#ca8a04" : "#dc2626";

  const label =
    score >= 75 ? "Strong" : score >= 50 ? "Developing" : "Needs Work";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={`Creator score ${score} out of 100`}
      >
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={size * 0.075}
          strokeDasharray={`${arc} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
        />
        <motion.circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.075}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${fill} ${circumference}` }}
          transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1], delay: 0.3 }}
        />
        <text
          x={cx} y={cy + 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={size * 0.28}
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
        >
          {score}
        </text>
        <text
          x={cx} y={cy + size * 0.22}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.4)"
          fontSize={size * 0.1}
          fontFamily="system-ui, sans-serif"
        >
          / 100
        </text>
      </svg>
      <span
        className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
        style={{
          background: `${color}22`,
          color,
          border: `1px solid ${color}44`,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Locked card ───────────────────────────────────────────────────────────────

const LOCKED_SECTIONS = [
  { icon: FileText,  label: "30 Day Content Plan",      preview: "A personalised weekly content calendar..." },
  { icon: Zap,       label: "Viral Post Ideas",          preview: "10 hook formulas proven to drive shares..." },
  { icon: Clock,     label: "Best Posting Times",        preview: "Your audience is most active on..." },
  { icon: PenSquare, label: "AI Generated Posts",        preview: "Ready-to-publish captions crafted for your voice..." },
  { icon: Users,     label: "Audience Growth Strategy",  preview: "A 90-day step-by-step plan to 10x your reach..." },
];

function LockedCard({
  icon: Icon,
  label,
  preview,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  preview: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="relative overflow-hidden rounded-xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Blurred preview content */}
      <div className="px-4 py-3 select-none" aria-hidden="true">
        <div className="flex items-center gap-2.5 mb-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(22,163,74,0.12)", border: "1px solid rgba(22,163,74,0.2)" }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: "#16a34a" }} aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold text-white/80">{label}</span>
          <Lock className="w-3.5 h-3.5 text-white/25 ml-auto flex-shrink-0" aria-hidden="true" />
        </div>
        <p className="text-xs text-white/20 leading-relaxed blur-[4px] pointer-events-none">
          {preview}
        </p>
        <div className="mt-2 space-y-1.5" aria-hidden="true">
          {[0.75, 0.55, 0.65].map((w, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full blur-[3px]"
              style={{ width: `${w * 100}%`, background: "rgba(255,255,255,0.07)" }}
            />
          ))}
        </div>
      </div>

      {/* Frosted overlay */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(14,17,23,0.1) 0%, rgba(14,17,23,0.65) 100%)",
        }}
        aria-hidden="true"
      />
    </motion.div>
  );
}

// ── Insight pill ──────────────────────────────────────────────────────────────

function InsightPill({
  text,
  variant,
  delay,
}: {
  text: string;
  variant: "strength" | "opportunity";
  delay: number;
}) {
  const isStrength = variant === "strength";
  return (
    <motion.div
      initial={{ opacity: 0, x: isStrength ? -8 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
      style={{
        background: isStrength
          ? "rgba(22,163,74,0.08)"
          : "rgba(234,179,8,0.08)",
        border: `1px solid ${isStrength ? "rgba(22,163,74,0.18)" : "rgba(234,179,8,0.18)"}`,
      }}
    >
      <CheckCircle2
        className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
        style={{ color: isStrength ? "#16a34a" : "#ca8a04" }}
        aria-hidden="true"
      />
      <p className="text-xs leading-relaxed" style={{ color: isStrength ? "#86efac" : "#fde68a" }}>
        {text}
      </p>
    </motion.div>
  );
}

// ── AI post preview ───────────────────────────────────────────────────────────

function AiPostPreview({ preview, platform }: { preview: Teaser["ai_post_preview"]; platform: string }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
      }}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2.5 flex items-center gap-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div
          className="w-7 h-7 rounded-full flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #16a34a, #4ade80)" }}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/80 leading-none capitalize">{platform}</p>
          <p className="text-[10px] text-white/35 mt-0.5">AI Generated Post</p>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: "rgba(22,163,74,0.18)", color: "#4ade80" }}
        >
          Preview
        </span>
      </div>

      {/* Post title */}
      {preview.title && (
        <div className="px-4 pt-3">
          <p className="text-xs font-semibold text-white/70">{preview.title}</p>
        </div>
      )}

      {/* Caption */}
      <div className="px-4 pt-2 pb-3">
        <p className="text-xs text-white/55 leading-relaxed line-clamp-4 whitespace-pre-line">
          {preview.caption}
        </p>
      </div>

      {/* Hashtags */}
      {preview.hashtags.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {preview.hashtags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "rgba(22,163,74,0.12)", color: "#4ade80" }}
            >
              #{tag.replace(/^#/, "")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Benchmark bar ─────────────────────────────────────────────────────────────

function BenchmarkBar({ score }: { score: number }) {
  // Compute rough percentile — higher score = better than more creators
  const topPct = Math.max(3, Math.min(72, Math.round(100 - score * 0.72 + 5)));

  return (
    <div
      className="rounded-xl px-4 py-4"
      style={{
        background: "rgba(22,163,74,0.06)",
        border: "1px solid rgba(22,163,74,0.15)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-white/70">Platform benchmark</p>
        <span className="text-xs font-bold text-green-400">
          Top {topPct}%
        </span>
      </div>

      {/* Bar track */}
      <div className="relative h-2 rounded-full mb-3" style={{ background: "rgba(255,255,255,0.07)" }}>
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #16a34a, #4ade80)" }}
          initial={{ width: "0%" }}
          animate={{ width: `${100 - topPct}%` }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.5 }}
        />
        {/* Marker */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white"
          style={{ background: "#16a34a" }}
          initial={{ left: "0%" }}
          animate={{ left: `calc(${100 - topPct}% - 6px)` }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.5 }}
        />
      </div>

      <p className="text-[11px] text-white/40 leading-relaxed">
        Your profile scores higher than{" "}
        <span className="text-white/70 font-medium">{100 - topPct}%</span> of creators on this platform.
        Unlock your full report to see what the top 10% do differently.
      </p>
    </div>
  );
}

// ── CTA block ─────────────────────────────────────────────────────────────────

function CtaBlock({ unlockHref }: { unlockHref: string }) {
  return (
    <div
      className="rounded-2xl px-5 py-6 text-center"
      style={{
        background: "rgba(22,163,74,0.08)",
        border: "1px solid rgba(22,163,74,0.22)",
      }}
    >
      <div className="flex justify-center mb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.3)" }}
        >
          <Sparkles className="w-5 h-5 text-green-400" aria-hidden="true" />
        </div>
      </div>
      <h3 className="text-base font-bold text-white mb-1.5 text-balance">
        Unlock your full AI growth strategy
      </h3>
      <p className="text-xs text-white/45 mb-4">
        Free account. Takes 10 seconds.
      </p>
      <motion.a
        href={unlockHref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white transition-colors"
        style={{ background: "#16a34a" }}
      >
        Get my free report
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </motion.a>
      <p className="text-[10px] text-white/30 mt-3">
        No credit card required
      </p>
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, title, subtitle }: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: "rgba(22,163,74,0.12)", border: "1px solid rgba(22,163,74,0.2)" }}
      >
        <Icon className="w-3.5 h-3.5 text-green-400" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white/85">{title}</p>
        {subtitle && (
          <p className="text-[11px] text-white/40 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div className="h-px w-full" style={{ background: "rgba(255,255,255,0.06)" }} />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TeaserReport({
  instant,
  teaser,
  profileUrl,
  analysisId,
}: TeaserReportProps) {
  const {
    creator_score,
    platform_detected,
    strengths,
    opportunities,
  } = instant;

  const { growth_insights, ai_post_preview, benchmark_text } = teaser;

  // Build the unlock href — links to /auth with analysis_id threaded through
  const unlockHref = `/auth?analysis_id=${encodeURIComponent(analysisId)}&mode=register`;

  // Derive platform display name
  const platformLabel =
    platform_detected.charAt(0).toUpperCase() + platform_detected.slice(1);

  // Extract handle from URL for display
  const handle = (() => {
    try {
      const u = new URL(profileUrl);
      const parts = u.pathname.split("/").filter(Boolean);
      return parts[0] ? `@${parts[0]}` : u.hostname;
    } catch {
      return profileUrl;
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-2xl mx-auto"
    >
      {/* ── Report card ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#0e1117",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.45)",
        }}
      >

        {/* Header stripe */}
        <div
          className="px-5 pt-5 pb-4 flex items-center gap-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.25)" }}
          >
            <BarChart2 className="w-4 h-4 text-green-400" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/80 truncate">{handle}</p>
            <p className="text-[10px] text-white/35 capitalize mt-0.5">
              {platformLabel} · AI Profile Analysis
            </p>
          </div>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: "rgba(22,163,74,0.15)", color: "#4ade80", border: "1px solid rgba(22,163,74,0.25)" }}
          >
            Free Report
          </span>
        </div>

        {/* ── Score + signals row ──────────────────────────────────────────── */}
        <div className="px-5 py-5 flex flex-col sm:flex-row items-center gap-5">
          {/* Score arc */}
          <div className="flex-shrink-0">
            <ScoreArc score={creator_score} />
          </div>

          {/* Divider (vertical on sm+) */}
          <div
            className="hidden sm:block self-stretch w-px"
            style={{ background: "rgba(255,255,255,0.06)" }}
            aria-hidden="true"
          />
          <div className="sm:hidden h-px w-full" style={{ background: "rgba(255,255,255,0.06)" }} aria-hidden="true" />

          {/* Signal pills */}
          <div className="flex-1 w-full grid grid-cols-2 gap-2">
            {[
              { label: "Platform", value: platformLabel },
              {
                label: "Posting",
                value:
                  instant.posting_frequency_estimate === "unknown"
                    ? "Undetected"
                    : instant.posting_frequency_estimate.charAt(0).toUpperCase() +
                      instant.posting_frequency_estimate.slice(1),
              },
              {
                label: "Topics",
                value:
                  instant.keywords_detected.length > 0
                    ? instant.keywords_detected.slice(0, 2).join(", ")
                    : "General",
              },
              {
                label: "Score tier",
                value:
                  creator_score >= 75
                    ? "Strong"
                    : creator_score >= 50
                    ? "Developing"
                    : "Needs work",
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="px-3 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-[10px] text-white/35 mb-0.5">{label}</p>
                <p className="text-xs font-semibold text-white/80 truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <Divider />

        {/* ── Strengths ────────────────────────────────────────────────────── */}
        {strengths.length > 0 && (
          <div className="px-5 py-4">
            <SectionHeading icon={CheckCircle2} title="What's working" subtitle="Your current profile strengths" />
            <div className="mt-3 flex flex-col gap-2">
              {strengths.slice(0, 3).map((s, i) => (
                <InsightPill key={i} text={s} variant="strength" delay={0.1 + i * 0.07} />
              ))}
            </div>
          </div>
        )}

        {/* ── Opportunities ─────────────────────────────────────────────────── */}
        {opportunities.length > 0 && (
          <>
            <Divider />
            <div className="px-5 py-4">
              <SectionHeading icon={TrendingUp} title="Growth opportunities" subtitle="Quick wins to boost your score" />
              <div className="mt-3 flex flex-col gap-2">
                {opportunities.slice(0, 3).map((o, i) => (
                  <InsightPill key={i} text={o} variant="opportunity" delay={0.1 + i * 0.07} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Growth insights (teaser) ───────────────────────────────────────── */}
        {growth_insights.length > 0 && (
          <>
            <Divider />
            <div className="px-5 py-4">
              <SectionHeading icon={Sparkles} title="AI growth insights" subtitle="Personalised recommendations" />
              <div className="mt-3 flex flex-col gap-2">
                {growth_insights.slice(0, 2).map((insight, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-xs text-white/55 leading-relaxed">{insight}</p>
                  </motion.div>
                ))}
                {/* Teased third insight — blurred */}
                {growth_insights.length > 2 && (
                  <div
                    className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg select-none"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                    aria-hidden="true"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5 opacity-25" />
                    <p className="text-xs text-white/55 leading-relaxed blur-[4px] pointer-events-none">
                      {growth_insights[2]}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Benchmark text (if no structured data, fall back to text) ─────── */}
        {benchmark_text && (
          <>
            <Divider />
            <div className="px-5 py-4">
              <BenchmarkBar score={creator_score} />
              {benchmark_text && (
                <p className="text-[11px] text-white/35 mt-3 leading-relaxed">{benchmark_text}</p>
              )}
            </div>
          </>
        )}
        {!benchmark_text && (
          <>
            <Divider />
            <div className="px-5 py-4">
              <BenchmarkBar score={creator_score} />
            </div>
          </>
        )}

        {/* ── AI post preview ────────────────────────────────────────────────── */}
        {ai_post_preview?.caption && (
          <>
            <Divider />
            <div className="px-5 py-4">
              <SectionHeading
                icon={PenSquare}
                title="Sample AI post"
                subtitle="Crafted for your niche and voice"
              />
              <div className="mt-3">
                <AiPostPreview preview={ai_post_preview} platform={platform_detected} />
              </div>
            </div>
          </>
        )}

        <Divider />

        {/* ── Locked sections ─────────────────────────────────────────────────── */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <SectionHeading
              icon={Lock}
              title="Your full strategy"
              subtitle="Unlock everything below"
            />
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}
            >
              {LOCKED_SECTIONS.length} sections locked
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            {LOCKED_SECTIONS.map(({ icon, label, preview }, i) => (
              <LockedCard
                key={label}
                icon={icon}
                label={label}
                preview={preview}
                delay={0.05 + i * 0.06}
              />
            ))}
          </div>
        </div>

        {/* ── CTA ─────────────────────────────────────────────────────────────── */}
        <div className="px-5 pb-5 pt-2">
          <CtaBlock unlockHref={unlockHref} />
        </div>
      </div>
    </motion.div>
  );
}
