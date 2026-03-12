"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  TrendingUp,
  Lightbulb,
  Calendar,
  Zap,
  BarChart2,
  BookOpen,
  Clock,
  ArrowRight,
  Sparkles,
  Target,
  FlameKindling,
} from "lucide-react";
import type { Instant, Teaser, FullReport } from "@/lib/analyzer/types";

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.07, ease: "easeOut" },
  }),
};

// ── Design constants ──────────────────────────────────────────────────────────

const CARD = {
  background: "#0e1117",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.28)",
} as const;

const SECTION_HEADER_ICON =
  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0";

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  index,
  icon,
  label,
  badge,
  children,
}: {
  index: number;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="rounded-2xl overflow-hidden"
      style={CARD}
      aria-labelledby={`section-${index}-title`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className={SECTION_HEADER_ICON}
          style={{ background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.25)" }}
        >
          {icon}
        </div>
        <h2
          id={`section-${index}-title`}
          className="text-sm font-bold text-white/90 tracking-tight"
        >
          {label}
        </h2>
        {badge && (
          <span
            className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(22,163,74,0.18)", color: "#4ade80" }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-5">{children}</div>
    </motion.section>
  );
}

// ── Score arc (animated) ──────────────────────────────────────────────────────

function ScoreArc({ score }: { score: number }) {
  const size = 140;
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const arc = circumference * 0.75;
  const fill = arc * (score / 100);

  const color =
    score >= 75 ? "#16a34a" : score >= 50 ? "#ca8a04" : "#dc2626";
  const label =
    score >= 75 ? "Strong" : score >= 50 ? "Developing" : "Needs Work";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={`Creator score ${score} out of 100`}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={10}
          strokeDasharray={`${arc} ${circumference - arc}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={`${fill} ${circumference - fill}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${fill} ${circumference - fill}` }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={28}
          fontWeight={800}
          fontFamily="inherit"
        >
          {score}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.38)"
          fontSize={10}
          fontFamily="inherit"
        >
          /100
        </text>
      </svg>
      <span
        className="text-xs font-semibold px-3 py-1 rounded-full"
        style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Pill list ─────────────────────────────────────────────────────────────────

function PillList({ items, color = "green" }: { items: string[]; color?: "green" | "amber" }) {
  const bg = color === "green" ? "rgba(22,163,74,0.12)" : "rgba(202,138,4,0.12)";
  const border = color === "green" ? "rgba(22,163,74,0.25)" : "rgba(202,138,4,0.25)";
  const text = color === "green" ? "#4ade80" : "#fbbf24";

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span
          key={i}
          className="text-xs font-medium px-3 py-1.5 rounded-full leading-none"
          style={{ background: bg, border: `1px solid ${border}`, color: text }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ── Bullet list ───────────────────────────────────────────────────────────────

function BulletList({ items, icon: Icon }: { items: string[]; icon: React.ElementType }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <div
            className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.3)" }}
          >
            <Icon className="w-3 h-3 text-green-400" aria-hidden="true" />
          </div>
          <p className="text-sm text-white/70 leading-relaxed">{item}</p>
        </li>
      ))}
    </ul>
  );
}

// ── Posting schedule ──────────────────────────────────────────────────────────

function PostingScheduleGrid({
  postsPerWeek,
  bestDays,
  bestTimes,
}: {
  postsPerWeek: string;
  bestDays: string[];
  bestTimes: string[];
}) {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activeDays = new Set(
    bestDays.map((d) => d.slice(0, 3).replace(/^./, (c) => c.toUpperCase()))
  );

  return (
    <div className="space-y-5">
      {/* Frequency badge */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.25)" }}
        >
          <Clock className="w-4 h-4 text-green-400" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[10px] text-white/35 uppercase tracking-widest mb-0.5">
            Posting frequency
          </p>
          <p className="text-sm font-bold text-white">{postsPerWeek} per week</p>
        </div>
      </div>

      {/* Day grid */}
      <div>
        <p className="text-[10px] text-white/35 uppercase tracking-widest mb-2.5">Best days</p>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((day) => {
            const active = activeDays.has(day);
            return (
              <div
                key={day}
                className="flex flex-col items-center gap-1.5 py-2 rounded-xl"
                style={{
                  background: active ? "rgba(22,163,74,0.18)" : "rgba(255,255,255,0.04)",
                  border: active ? "1px solid rgba(22,163,74,0.35)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span className={`text-[9px] font-bold uppercase ${active ? "text-green-400" : "text-white/25"}`}>
                  {day}
                </span>
                {active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Best times */}
      <div>
        <p className="text-[10px] text-white/35 uppercase tracking-widest mb-2.5">Best times</p>
        <div className="flex flex-wrap gap-2">
          {bestTimes.map((time, i) => (
            <span
              key={i}
              className="text-xs font-medium px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.65)",
              }}
            >
              {time}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Viral post idea card ──────────────────────────────────────────────────────

function ViralPostCard({
  title,
  hook,
  description,
  index,
}: {
  title: string;
  hook: string;
  description: string;
  index: number;
}) {
  return (
    <div
      className="rounded-xl p-4 space-y-2"
      style={{
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="text-xs font-black px-2 py-0.5 rounded-md shrink-0 mt-0.5"
          style={{ background: "rgba(22,163,74,0.18)", color: "#4ade80" }}
        >
          #{index + 1}
        </span>
        <p className="text-sm font-bold text-white/90 leading-snug">{title}</p>
      </div>
      <div
        className="rounded-lg px-3 py-2"
        style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.15)" }}
      >
        <p className="text-[10px] text-green-400/70 uppercase tracking-widest mb-1 font-semibold">
          Hook
        </p>
        <p className="text-xs text-white/65 italic leading-relaxed">{`"${hook}"`}</p>
      </div>
      <p className="text-xs text-white/45 leading-relaxed">{description}</p>
    </div>
  );
}

// ── AI post preview card ──────────────────────────────────────────────────────

function AiPostCard({
  title,
  caption,
  hashtags,
}: {
  title: string;
  caption: string;
  hashtags: string[];
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Post header */}
      <div
        className="px-4 py-3 flex items-center gap-2.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(22,163,74,0.25)" }}
        >
          <Sparkles className="w-3.5 h-3.5 text-green-400" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-bold text-white/80 leading-none">{title}</p>
          <p className="text-[10px] text-white/30 mt-0.5">AI-generated sample post</p>
        </div>
      </div>

      {/* Caption */}
      <div className="px-4 py-4 space-y-3">
        <p className="text-sm text-white/65 leading-relaxed">{caption}</p>

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((tag, i) => (
              <span key={i} className="text-xs text-blue-400/70">
                #{tag.replace(/^#/, "")}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Benchmark bar ─────────────────────────────────────────────────────────────

function BenchmarkBar({ score, text }: { score: number; text: string }) {
  const topPct = Math.max(5, Math.min(95, Math.round(100 - score * 0.62 + 8)));

  return (
    <div className="space-y-4">
      {/* Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-white/35 uppercase tracking-widest">
            Your profile vs peers
          </span>
          <span className="text-xs font-bold text-green-400">
            Top {topPct}%
          </span>
        </div>
        <div
          className="relative h-2.5 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.07)" }}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: "#16a34a" }}
            initial={{ width: "0%" }}
            animate={{ width: `${100 - topPct}%` }}
            transition={{ duration: 1.0, ease: "easeOut", delay: 0.4 }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[9px] text-white/20">Bottom 0%</span>
          <span className="text-[9px] text-white/20">Top 0%</span>
        </div>
      </div>

      {/* Benchmark text */}
      {text && (
        <p className="text-sm text-white/55 leading-relaxed">{text}</p>
      )}
    </div>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────────────

function FinalCta({ index }: { index: number }) {
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="rounded-2xl overflow-hidden text-center px-6 py-10"
      style={{
        background: "#0e1117",
        border: "1px solid rgba(22,163,74,0.25)",
        boxShadow: "0 0 48px rgba(22,163,74,0.08)",
      }}
    >
      {/* Icon */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.3)" }}
      >
        <Zap className="w-7 h-7 text-green-400" aria-hidden="true" />
      </div>

      <h2 className="text-xl font-black text-white mb-2 text-balance">
        Let ZARZOOM run your social autopilot.
      </h2>
      <p className="text-sm text-white/45 max-w-sm mx-auto leading-relaxed mb-8 text-balance">
        Your strategy is ready. Now let AI turn it into a daily content engine — 
        posts planned, written, and scheduled automatically for your profile.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <motion.a
          href="/onboarding"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white transition-colors"
          style={{ background: "#16a34a" }}
        >
          Create Workspace
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </motion.a>
        <a
          href="/dashboard"
          className="text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          Explore dashboard first
        </a>
      </div>

      <p className="text-[10px] text-white/20 mt-5">
        Free to start. No credit card required.
      </p>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface FullReportProps {
  instant: Instant;
  teaser: Teaser;
  fullReport: FullReport;
  profileUrl?: string;
}

export default function FullReport({
  instant,
  teaser,
  fullReport,
}: FullReportProps) {
  const {
    creator_score,
    platform_detected,
    keywords_detected,
    posting_frequency_estimate,
    strengths,
    opportunities,
  } = instant;

  const { growth_insights: teaserInsights, ai_post_preview, benchmark_text } = teaser;

  const {
    creator_score_explanation,
    content_pillars,
    viral_post_ideas,
    posting_schedule,
    growth_insights,
  } = fullReport;

  // Combine growth insights (teaser + full report, deduplicated)
  const allInsights = [
    ...growth_insights,
    ...teaserInsights.filter((t) => !growth_insights.includes(t)),
  ];

  let sectionIndex = 0;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">

      {/* ── 1. Creator Score ──────────────────────────────────────────────── */}
      <motion.section
        custom={sectionIndex++}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="rounded-2xl overflow-hidden"
        style={CARD}
        aria-label="Creator Score"
      >
        <div
          className="px-5 py-4 flex items-center gap-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className={SECTION_HEADER_ICON}
            style={{ background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.25)" }}
          >
            <BarChart2 className="w-4 h-4 text-green-400" aria-hidden="true" />
          </div>
          <h2 className="text-sm font-bold text-white/90 tracking-tight">Creator Score</h2>
          <span
            className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}
          >
            {platform_detected}
          </span>
        </div>
        <div className="px-5 py-6 flex flex-col sm:flex-row items-center gap-6">
          <ScoreArc score={creator_score} />
          <div className="flex-1 min-w-0 space-y-4">
            {/* Score explanation */}
            {creator_score_explanation && (
              <p className="text-sm text-white/60 leading-relaxed">
                {creator_score_explanation}
              </p>
            )}
            {/* Keywords */}
            {keywords_detected.length > 0 && (
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">
                  Detected topics
                </p>
                <PillList items={keywords_detected} />
              </div>
            )}
            {/* Frequency */}
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-white/30" aria-hidden="true" />
              <span className="text-xs text-white/40">
                Estimated posting:{" "}
                <span className="text-white/70 font-medium capitalize">
                  {posting_frequency_estimate}
                </span>
              </span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── 2. Strengths ─────────────────────────────────────────────────── */}
      {strengths.length > 0 && (
        <Section
          index={sectionIndex++}
          icon={<CheckCircle2 className="w-4 h-4 text-green-400" />}
          label="Profile Strengths"
          badge={`${strengths.length} identified`}
        >
          <BulletList items={strengths} icon={CheckCircle2} />
        </Section>
      )}

      {/* ── 3. Opportunities ──────────────────────────────────────────────── */}
      {opportunities.length > 0 && (
        <Section
          index={sectionIndex++}
          icon={<TrendingUp className="w-4 h-4 text-green-400" />}
          label="Growth Opportunities"
          badge={`${opportunities.length} areas`}
        >
          <BulletList items={opportunities} icon={TrendingUp} />
        </Section>
      )}

      {/* ── 4. Content Pillars ───────────────────────────────────────────── */}
      {content_pillars.length > 0 && (
        <Section
          index={sectionIndex++}
          icon={<BookOpen className="w-4 h-4 text-green-400" />}
          label="Content Pillars"
          badge="AI Strategy"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {content_pillars.map((pillar, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl px-3.5 py-3"
                style={{
                  background: "rgba(255,255,255,0.035)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(22,163,74,0.2)" }}
                >
                  <Target className="w-3 h-3 text-green-400" aria-hidden="true" />
                </div>
                <span className="text-sm text-white/70 font-medium leading-snug">{pillar}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 5. Growth Insights ───────────────────────────────────────────── */}
      {allInsights.length > 0 && (
        <Section
          index={sectionIndex++}
          icon={<Lightbulb className="w-4 h-4 text-green-400" />}
          label="AI Growth Insights"
          badge="Full access"
        >
          <div className="space-y-3">
            {allInsights.map((insight, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span
                  className="text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                  style={{ background: "rgba(22,163,74,0.15)", color: "#4ade80" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-sm text-white/65 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 6. Posting Schedule ──────────────────────────────────────────── */}
      <Section
        index={sectionIndex++}
        icon={<Calendar className="w-4 h-4 text-green-400" />}
        label="Posting Schedule"
        badge="Optimised"
      >
        <PostingScheduleGrid
          postsPerWeek={posting_schedule.posts_per_week}
          bestDays={posting_schedule.best_days}
          bestTimes={posting_schedule.best_times}
        />
      </Section>

      {/* ── 7. Viral Post Ideas ───────────────────────────────────────────── */}
      {viral_post_ideas.length > 0 && (
        <Section
          index={sectionIndex++}
          icon={<FlameKindling className="w-4 h-4 text-green-400" />}
          label="Viral Post Ideas"
          badge={`${viral_post_ideas.length} ideas`}
        >
          <div className="space-y-3">
            {viral_post_ideas.map((idea, i) => (
              <ViralPostCard
                key={i}
                title={idea.title}
                hook={idea.hook}
                description={idea.description}
                index={i}
              />
            ))}
          </div>
        </Section>
      )}

      {/* ── 8. AI Post Preview ───────────────────────────────────────────── */}
      {ai_post_preview.caption && (
        <Section
          index={sectionIndex++}
          icon={<Sparkles className="w-4 h-4 text-green-400" />}
          label="AI Generated Post Preview"
          badge="Sample"
        >
          <AiPostCard
            title={ai_post_preview.title || "Sample Post"}
            caption={ai_post_preview.caption}
            hashtags={ai_post_preview.hashtags}
          />
        </Section>
      )}

      {/* ── 9. Benchmark Insight ─────────────────────────────────────────── */}
      <Section
        index={sectionIndex++}
        icon={<BarChart2 className="w-4 h-4 text-green-400" />}
        label="Benchmark Insight"
      >
        <BenchmarkBar score={creator_score} text={benchmark_text} />
      </Section>

      {/* ── 10. Final CTA ────────────────────────────────────────────────── */}
      <FinalCta index={sectionIndex++} />
    </div>
  );
}
