"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { ContentPerformanceRow, ProfileSnapshot } from "./mock-data";

// ─── Platform icon SVGs ───────────────────────────────────────────────────────

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
  Carousel:     { bg: "bg-amber-100",  text: "text-amber-700" },
  Article:      { bg: "bg-indigo-100", text: "text-indigo-700" },
  Thread:       { bg: "bg-sky-100",    text: "text-sky-700" },
  "Short Clip": { bg: "bg-green-100",  text: "text-green-700" },
  "Story Post": { bg: "bg-rose-100",   text: "text-rose-700" },
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

// ─── Profile Snapshot Block ───────────────────────────────────────────────────

interface ProfileSnapshotBlockProps {
  label: string;
  snapshot: ProfileSnapshot;
  accent?: boolean;
}

function ProfileSnapshotBlock({ label, snapshot, accent = false }: ProfileSnapshotBlockProps) {
  // TODO (real data): snapshot data comes from:
  //   profileAtPost  → GET /api/analytics/post/:id/profile-snapshots?type=at_post
  //   profileLatest  → GET /api/analytics/post/:id/profile-snapshots?type=latest
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide mb-3 ${accent ? "text-green-600" : "text-gray-400"}`}>
        {label}
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {[
          { key: "Followers",      val: fmt(snapshot.followers) },
          { key: "Following",      val: fmt(snapshot.following) },
          { key: "Total Posts",    val: fmt(snapshot.totalPosts) },
          { key: "Avg. ER",        val: snapshot.avgEngagementRate },
        ].map(({ key, val }) => (
          <div key={key}>
            <p className="text-[10px] text-gray-400 font-medium">{key}</p>
            <p className={`text-sm font-bold ${accent ? "text-green-700" : "text-gray-800"}`}>{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Post Detail Drawer ───────────────────────────────────────────────────────

interface DrawerProps {
  post: ContentPerformanceRow | null;
  onClose: () => void;
}

function PostDetailDrawer({ post, onClose }: DrawerProps) {
  // Animate open/close via CSS translate — drawer slides in from the right
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (post) {
      // Tiny delay lets React paint the panel first so the transition fires
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
    }
  }, [post]);

  // Trap Escape key
  useEffect(() => {
    if (!post) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [post, onClose]);

  if (!post && !visible) return null;

  const typeColour = TYPE_COLOURS[post?.type ?? ""] ?? { bg: "bg-gray-100", text: "text-gray-700" };
  const iconBg     = PLATFORM_ICON_BG[post?.platform ?? ""] ?? "bg-gray-100";

  // Derived metrics
  const totalEngagements = post
    ? post.likes + post.comments + post.shares + (post.saves ?? 0)
    : 0;

  const metrics = post
    ? [
        { label: "Views",        value: post.views,              icon: <EyeIcon /> },
        { label: "Likes",        value: post.likes,              icon: <HeartIcon /> },
        { label: "Comments",     value: post.comments,           icon: <CommentIcon /> },
        { label: "Shares",       value: post.shares,             icon: <ShareIcon /> },
        ...(post.saves != null
          ? [{ label: "Saves", value: post.saves, icon: <SaveIcon /> }]
          : []),
        { label: "Total Engagements", value: totalEngagements,  icon: <ZapIcon /> },
      ]
    : [];

  return (
    <>
      {/* Backdrop — fades in/out */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Slide-over panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={post ? `Post detail: ${post.snippet}` : "Post detail"}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col bg-white shadow-2xl
          transition-transform duration-300 ease-in-out will-change-transform
          ${visible ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* ── Thumbnail ───────────────────────────────────────────────────── */}
        {post && (
          <div className="relative w-full aspect-video flex-shrink-0 bg-gray-100">
            <Image
              src={post.thumbnail}
              alt={post.snippet}
              fill
              className="object-cover"
              sizes="440px"
              priority
            />
            {/* Gradient scrim for legible close button */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Close post detail"
            >
              <XIcon />
            </button>
          </div>
        )}

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        {post && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${iconBg}`}>
                  <PlatformIcon platform={post.platform} size={12} />
                  {post.platform}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${typeColour.bg} ${typeColour.text}`}>
                  {post.type}
                </span>
                {post.aiGenerated && (
                  <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-600">
                    AI-generated
                  </span>
                )}
              </div>

              {/* Title / hook */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Post Title
                </p>
                <p className="text-base font-semibold leading-relaxed text-gray-900 text-pretty">
                  {post.snippet}
                </p>
              </div>

              {/* Caption */}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Caption
                </p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
                  {post.caption}
                </p>
              </div>

              {/* Meta row — publish date + platform link */}
              <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Published
                  </p>
                  <p className="text-sm font-semibold text-gray-800">{post.publishedAt}</p>
                </div>
                {/* TODO (real data): replace href with actual post URL from API */}
                <a
                  href={post.platformUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:border-green-400 hover:text-green-600"
                  aria-label={`View post on ${post.platform}`}
                >
                  <ExternalLinkIcon />
                  View on {post.platform}
                </a>
              </div>

              {/* Engagement-rate highlight */}
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-600">
                  <TrendUpIcon />
                </div>
                <div>
                  <p className="text-xs font-medium text-green-700">Engagement Rate</p>
                  <p className="text-2xl font-bold text-green-700">{post.engagementRate}</p>
                </div>
              </div>

              {/* ── Platform-specific metrics ─────────────────────────────── */}
              {/* TODO (real data): populate metrics from GET /api/analytics/post/:id */}
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Platform Metrics
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {metrics.map(({ label, value, icon }) => (
                    <div
                      key={label}
                      className="flex flex-col gap-1 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                    >
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                        {icon}
                        {label}
                      </span>
                      <span className="text-lg font-bold text-gray-900">{fmt(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Profile snapshots ─────────────────────────────────────── */}
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Profile Snapshots
                </p>
                <div className="space-y-2.5">
                  <ProfileSnapshotBlock
                    label="At time of posting"
                    snapshot={post.profileAtPost}
                  />
                  <ProfileSnapshotBlock
                    label="Latest (current)"
                    snapshot={post.profileLatest}
                    accent
                  />
                </div>
              </div>

            </div>
          </div>
        )}
      </aside>
    </>
  );
}

// ─── Micro icon helpers (stroke-based, no CSS var issues) ────────────────────

function EyeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
function SaveIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function ZapIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function TrendUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
      <path d="m22 7-8.5 8.5-5-5L2 17" />
      <path d="M16 7h6v6" />
    </svg>
  );
}
function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
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
      className="group cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
      aria-label={`View details for: ${post.snippet}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        <Image
          src={post.thumbnail}
          alt={post.snippet}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <span className="absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[11px] font-bold text-white backdrop-blur-sm">
          {rank}
        </span>
        {post.aiGenerated && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            AI
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 p-4">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${iconBg}`}>
            <PlatformIcon platform={post.platform} size={11} />
            {post.platform}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeColour.bg} ${typeColour.text}`}>
            {post.type}
          </span>
        </div>

        {/* Hook */}
        <p className="line-clamp-2 text-sm font-semibold leading-relaxed text-gray-900 text-pretty">
          {post.snippet}
        </p>

        {/* Metric chips */}
        <div className="flex items-center gap-3 pt-0.5">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <EyeIcon /> {fmt(post.views)}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <HeartIcon /> {fmt(post.likes)}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <CommentIcon /> {fmt(post.comments)}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <ShareIcon /> {fmt(post.shares)}
          </span>
          <span className="ml-auto text-xs font-bold text-green-600">
            {post.engagementRate} ER
          </span>
        </div>

        {/* Date */}
        <p className="border-t border-gray-100 pt-2.5 text-[11px] text-gray-400">
          {post.publishedAt}
        </p>
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
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Top Performing Content</h2>
          <p className="text-sm leading-relaxed text-gray-500">
            Your strongest posts ranked by engagement rate — click any card for full details
          </p>
        </div>
        <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
          AI-ranked
        </span>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            rank={index + 1}
            onClick={() => setSelected(post)}
          />
        ))}
      </div>

      {/* Slide-over drawer */}
      <PostDetailDrawer
        post={selected}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
