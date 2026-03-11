"use client";

import { useState } from "react";
import Image from "next/image";
import type { ContentPerformanceRow } from "./mock-data";

// ─── Platform icon SVGs (inline, computed colours — no CSS variable issues) ───

function PlatformIcon({ platform, size = 14 }: { platform: string; size?: number }) {
  const s = size;
  switch (platform) {
    case "Instagram":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-label="Instagram">
          <rect x="2" y="2" width="20" height="20" rx="5" stroke="#E1306C" strokeWidth="2" />
          <circle cx="12" cy="12" r="4" stroke="#E1306C" strokeWidth="2" />
          <circle cx="17.5" cy="6.5" r="1" fill="#E1306C" />
        </svg>
      );
    case "LinkedIn":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="#0A66C2" aria-label="LinkedIn">
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </svg>
      );
    case "X / Twitter":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="#14171A" aria-label="X / Twitter">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "TikTok":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="#010101" aria-label="TikTok">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
        </svg>
      );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-label={platform}>
          <circle cx="12" cy="12" r="10" stroke="#9CA3AF" strokeWidth="2" />
        </svg>
      );
  }
}

// ─── Colour maps ──────────────────────────────────────────────────────────────

const TYPE_COLOURS: Record<string, { bg: string; text: string }> = {
  Carousel:    { bg: "bg-amber-100",  text: "text-amber-700" },
  Article:     { bg: "bg-indigo-100", text: "text-indigo-700" },
  Thread:      { bg: "bg-sky-100",    text: "text-sky-700" },
  "Short Clip":{ bg: "bg-green-100",  text: "text-green-700" },
  "Story Post":{ bg: "bg-rose-100",   text: "text-rose-700" },
};

const PLATFORM_ICON_BG: Record<string, string> = {
  Instagram:    "bg-pink-50",
  LinkedIn:     "bg-blue-50",
  "X / Twitter":"bg-gray-100",
  TikTok:       "bg-gray-100",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Post Detail Drawer ───────────────────────────────────────────────────────

interface DrawerProps {
  post: ContentPerformanceRow | null;
  onClose: () => void;
}

function PostDetailDrawer({ post, onClose }: DrawerProps) {
  if (!post) return null;

  const typeColour = TYPE_COLOURS[post.type] ?? { bg: "bg-gray-100", text: "text-gray-700" };
  const iconBg     = PLATFORM_ICON_BG[post.platform] ?? "bg-gray-100";
  const totalEngagements = post.likes + post.comments + post.shares;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Post detail: ${post.snippet}`}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col"
      >
        {/* Thumbnail */}
        <div className="relative w-full aspect-video flex-shrink-0 bg-gray-100">
          <Image
            src={post.thumbnail}
            alt={post.snippet}
            fill
            className="object-cover"
            sizes="(max-width: 448px) 100vw, 448px"
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Close detail panel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${iconBg}`}>
              <PlatformIcon platform={post.platform} size={12} />
              {post.platform}
            </span>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${typeColour.bg} ${typeColour.text}`}>
              {post.type}
            </span>
            {post.aiGenerated && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-600 border border-green-200">
                AI-generated
              </span>
            )}
          </div>

          {/* Hook */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Hook / Headline</p>
            <p className="text-base font-semibold text-gray-900 leading-relaxed text-pretty">
              {post.snippet}
            </p>
          </div>

          {/* Publish date */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Published</p>
            <p className="text-sm text-gray-700">{post.publishedAt}</p>
          </div>

          {/* Engagement rate highlight */}
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="m22 7-8.5 8.5-5-5L2 17" />
                <path d="M16 7h6v6" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-green-700 font-medium">Engagement Rate</p>
              <p className="text-2xl font-bold text-green-700">{post.engagementRate}</p>
            </div>
          </div>

          {/* Metrics grid */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Performance Metrics</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Views",        value: post.views,    icon: "👁" },
                { label: "Likes",        value: post.likes,    icon: "♡" },
                { label: "Comments",     value: post.comments, icon: "💬" },
                { label: "Shares",       value: post.shares,   icon: "↗" },
                { label: "Engagements",  value: totalEngagements, icon: "⚡" },
              ].map(({ label, value, icon }) => (
                <div
                  key={label}
                  className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex flex-col gap-0.5"
                >
                  <p className="text-xs text-gray-400 font-medium">{icon} {label}</p>
                  <p className="text-lg font-bold text-gray-900">{fmt(value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: ContentPerformanceRow;
  rank: number;
  onClick: () => void;
}

function PostCard({ post, rank, onClick }: PostCardProps) {
  const typeColour = TYPE_COLOURS[post.type] ?? { bg: "bg-gray-100", text: "text-gray-700" };
  const iconBg     = PLATFORM_ICON_BG[post.platform] ?? "bg-gray-100";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      className="group bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
      aria-label={`View details for: ${post.snippet}`}
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-gray-100 overflow-hidden">
        <Image
          src={post.thumbnail}
          alt={post.snippet}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {/* Rank badge */}
        <span className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full bg-black/60 text-white text-[11px] font-bold flex items-center justify-center backdrop-blur-sm">
          {rank}
        </span>
        {/* AI badge */}
        {post.aiGenerated && (
          <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-600 text-white shadow-sm">
            AI
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-3">
        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${iconBg}`}>
            <PlatformIcon platform={post.platform} size={11} />
            {post.platform}
          </span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${typeColour.bg} ${typeColour.text}`}>
            {post.type}
          </span>
        </div>

        {/* Hook */}
        <p className="text-sm font-semibold text-gray-900 leading-relaxed line-clamp-2 text-pretty">
          {post.snippet}
        </p>

        {/* Metric chips */}
        <div className="flex items-center gap-3 pt-0.5">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            {fmt(post.views)}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {fmt(post.likes)}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {fmt(post.comments)}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            {fmt(post.shares)}
          </span>
          <span className="ml-auto text-xs font-bold text-green-600">
            {post.engagementRate} ER
          </span>
        </div>

        {/* Publish date */}
        <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-2.5">{post.publishedAt}</p>
      </div>
    </article>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface ContentPerformanceProps {
  /**
   * Array of top-performing posts.
   * TODO (real data): replace TOP_CONTENT mock with SWR-fetched data:
   *   const { data: rows } = useSWR(["/api/analytics/top-content", workspaceId, filters])
   */
  rows: ContentPerformanceRow[];
}

export default function ContentPerformance({ rows }: ContentPerformanceProps) {
  const [selected, setSelected] = useState<ContentPerformanceRow | null>(null);

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Top Performing Content</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your strongest AI-generated posts ranked by engagement rate
          </p>
        </div>
        <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-1">
          AI-ranked
        </span>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {rows.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            rank={index + 1}
            onClick={() => setSelected(post)}
          />
        ))}
      </div>

      {/* Detail drawer */}
      <PostDetailDrawer
        post={selected}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
