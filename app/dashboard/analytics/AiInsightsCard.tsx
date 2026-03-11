"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Clock,
  TrendingUp,
  BookOpen,
  Zap,
  LayoutGrid,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import type { AiInsight, InsightCategory } from "./mock-data";

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  InsightCategory,
  { icon: React.ElementType; iconColor: string; badgeClass: string; label: string }
> = {
  timing:     { icon: Clock,          iconColor: "#16a34a", badgeClass: "bg-green-50 text-green-700 border-green-200",   label: "Timing"     },
  growth:     { icon: TrendingUp,     iconColor: "#16a34a", badgeClass: "bg-green-50 text-green-700 border-green-200",   label: "Growth"     },
  content:    { icon: BookOpen,       iconColor: "#2563eb", badgeClass: "bg-blue-50 text-blue-700 border-blue-200",      label: "Content"    },
  engagement: { icon: Zap,            iconColor: "#9333ea", badgeClass: "bg-purple-50 text-purple-700 border-purple-200",label: "Engagement" },
  platform:   { icon: LayoutGrid,     iconColor: "#0891b2", badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200",      label: "Platform"   },
  warning:    { icon: AlertTriangle,  iconColor: "#d97706", badgeClass: "bg-amber-50 text-amber-700 border-amber-200",   label: "Attention"  },
};

// ─── Inline highlight helper ──────────────────────────────────────────────────
// Wraps the first occurrence of `highlight` in the body string with a styled span.

function HighlightedBody({ body, highlight }: { body: string; highlight?: string }) {
  if (!highlight) return <span>{body}</span>;

  const idx = body.indexOf(highlight);
  if (idx === -1) return <span>{body}</span>;

  return (
    <>
      {body.slice(0, idx)}
      <span className="inline-block bg-green-100 text-green-800 font-semibold rounded px-1 py-0.5 text-[13px] leading-snug mx-0.5">
        {highlight}
      </span>
      {body.slice(idx + highlight.length)}
    </>
  );
}

// ─── Single insight row ───────────────────────────────────────────────────────

function InsightRow({ insight }: { insight: AiInsight }) {
  const cfg = CATEGORY_CONFIG[insight.category];
  const Icon = cfg.icon;

  return (
    <li className="group flex gap-4 py-4 border-b border-gray-100 last:border-0 last:pb-0 first:pt-0">
      {/* Icon badge */}
      <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 border border-gray-200 group-hover:bg-green-50 group-hover:border-green-200 transition-colors">
        <Icon size={15} color={cfg.iconColor} strokeWidth={2} aria-hidden />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold tracking-wide uppercase leading-none px-1.5 py-0.5 rounded border text-gray-500 bg-gray-50 border-gray-200">
            {cfg.label}
          </span>
          <span className="text-sm font-semibold text-gray-900 leading-snug">
            {insight.title}
          </span>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed">
          <HighlightedBody body={insight.body} highlight={insight.highlight} />
        </p>

        {insight.ctaLabel && insight.ctaHref && (
          <Link
            href={insight.ctaHref}
            className="inline-flex items-center gap-1 mt-2 text-[13px] font-medium text-green-700 hover:text-green-800 transition-colors"
          >
            {insight.ctaLabel}
            <ChevronRight size={13} strokeWidth={2.5} aria-hidden />
          </Link>
        )}
      </div>
    </li>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

interface AiInsightsCardProps {
  insights: AiInsight[];
  /** How many insights to show before "Show more" — defaults to 3 */
  initialVisible?: number;
}

export default function AiInsightsCard({
  insights,
  initialVisible = 3,
}: AiInsightsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? insights : insights.slice(0, initialVisible);
  const hasMore = insights.length > initialVisible;

  return (
    <section
      aria-labelledby="ai-insights-heading"
      className="mb-8 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
    >
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-green-50/60 to-white">
        <div className="flex items-center gap-3">
          {/* AI spark icon */}
          <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center shadow-sm">
            <Sparkles size={17} color="#ffffff" strokeWidth={2} aria-hidden />
          </div>
          <div>
            <h2
              id="ai-insights-heading"
              className="text-[15px] font-bold text-gray-900 leading-none"
            >
              AI Insights
            </h2>
            <p className="text-[12px] text-gray-500 mt-0.5 leading-none">
              Generated from your last 30 days of activity
            </p>
          </div>
        </div>

        {/* Live badge */}
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1 leading-none">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden />
          Updated now
        </span>
      </div>

      {/* Insight list */}
      <ul className="px-6 py-2" role="list">
        {visible.map((insight) => (
          <InsightRow key={insight.id} insight={insight} />
        ))}
      </ul>

      {/* Show more / less toggle */}
      {hasMore && (
        <div className="px-6 pb-4">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[13px] font-medium text-gray-500 hover:text-green-700 transition-colors flex items-center gap-1"
          >
            {expanded ? "Show fewer insights" : `Show ${insights.length - initialVisible} more insights`}
            <ChevronRight
              size={13}
              strokeWidth={2.5}
              aria-hidden
              className={`transition-transform ${expanded ? "rotate-90" : "rotate-0"}`}
            />
          </button>
        </div>
      )}

      {/* Footer note */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          {/* TODO (real data): replace static disclaimer with insight confidence scores + last-updated timestamp */}
          These insights are generated by analysing engagement patterns, posting schedules, and content types across your connected accounts. Real-time insights will be available once live data is connected.
        </p>
      </div>
    </section>
  );
}
