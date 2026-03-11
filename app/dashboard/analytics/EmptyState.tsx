"use client";

import Link from "next/link";

// ─── Icons ────────────────────────────────────────────────────────────────────

function LinkIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function AlertCircleIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" /><path d="M19 17v4" />
      <path d="M3 5h4" /><path d="M17 19h4" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmptyStateVariant =
  | "no-accounts"   // no social platforms connected yet
  | "no-posts"      // accounts connected but no content published
  | "partial"       // some data present but incomplete / missing metrics
  | "loading";      // skeleton placeholder

interface EmptyStateProps {
  variant: EmptyStateVariant;
  /** Override the default title */
  title?: string;
  /** Override the default description */
  description?: string;
  /** Optional CTA */
  ctaLabel?: string;
  ctaHref?: string;
  /** Render inline (for inside charts/cards) vs full section block */
  inline?: boolean;
  className?: string;
}

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<
  Exclude<EmptyStateVariant, "loading">,
  {
    icon: () => React.JSX.Element;
    iconBg: string;
    iconColor: string;
    defaultTitle: string;
    defaultDescription: string;
  }
> = {
  "no-accounts": {
    icon: LinkIcon,
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
    defaultTitle: "Connect your social accounts",
    defaultDescription:
      "Connect your social accounts to start tracking performance across platforms.",
  },
  "no-posts": {
    icon: FileTextIcon,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
    defaultTitle: "No content published yet",
    defaultDescription:
      "Your AI will begin tracking performance once content is published.",
  },
  partial: {
    icon: AlertCircleIcon,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    defaultTitle: "Partial data available",
    defaultDescription:
      "Some metrics are still syncing or are not available for this platform.",
  },
};

// ─── Skeleton bar (used for loading state) ────────────────────────────────────

function SkeletonBar({ w, h = "h-3" }: { w: string; h?: string }) {
  return (
    <div className={`${h} ${w} rounded-full bg-gray-200 animate-pulse`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-200 animate-pulse" />
        <div className="flex flex-col gap-2 flex-1">
          <SkeletonBar w="w-24" />
          <SkeletonBar w="w-16" h="h-2" />
        </div>
      </div>
      <div className="border-t border-gray-100" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <SkeletonBar w="w-12" h="h-2" />
            <SkeletonBar w="w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Partial metric placeholder ───────────────────────────────────────────────
// Renders a "—" dash with a subtle tooltip title when a metric value is missing.

export function MetricPlaceholder({ label }: { label: string }) {
  return (
    <span
      className="inline-block text-gray-300 font-semibold select-none"
      title={`${label} not available for this platform`}
      aria-label={`${label}: not available`}
    >
      —
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EmptyState({
  variant,
  title,
  description,
  ctaLabel,
  ctaHref,
  inline = false,
  className = "",
}: EmptyStateProps) {
  // Loading state — pure skeleton
  if (variant === "loading") {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-4 py-12 ${className}`}
        aria-label="Loading analytics data"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          <div className="w-12 h-12 rounded-2xl bg-gray-200 animate-pulse" />
          <SkeletonBar w="w-40" h="h-4" />
          <SkeletonBar w="w-56" h="h-3" />
          <SkeletonBar w="w-48" h="h-3" />
        </div>
      </div>
    );
  }

  const cfg = VARIANT_CONFIG[variant];
  const Icon = cfg.icon;

  const resolvedTitle = title ?? cfg.defaultTitle;
  const resolvedDesc  = description ?? cfg.defaultDescription;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-4
        ${inline ? "py-10 px-6" : "py-14 px-6"}
        ${className}`}
      role="status"
      aria-label={resolvedTitle}
    >
      {/* Icon badge */}
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center ${cfg.iconBg} ${cfg.iconColor}`}
        aria-hidden="true"
      >
        <Icon />
      </div>

      {/* Copy */}
      <div className="max-w-xs flex flex-col gap-1.5">
        <p className="text-[15px] font-bold text-gray-900 leading-snug text-balance">
          {resolvedTitle}
        </p>
        <p className="text-sm text-gray-500 leading-relaxed text-pretty">
          {resolvedDesc}
        </p>
      </div>

      {/* CTA */}
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-1 inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
