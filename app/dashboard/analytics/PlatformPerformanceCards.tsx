"use client";

import type { PlatformCard, PlatformMetrics } from "./mock-data";
import EmptyState, { SkeletonCard } from "./EmptyState";

// ─── Platform SVG Icons ───────────────────────────────────────────────────────
// Inline SVGs — no external icon package dependency required.

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34l-.01-8.54a8.22 8.22 0 0 0 4.79 1.53V4.84a4.85 4.85 0 0 1-1.01-.15z" />
    </svg>
  );
}

function YouTubeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.55 31.55 0 0 0 0 12a31.55 31.55 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14C4.5 20.5 12 20.5 12 20.5s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 16.34 24 12 24 12a31.55 31.55 0 0 0-.5-5.81zM9.75 15.5V8.5l6.5 3.5-6.5 3.5z" />
    </svg>
  );
}

function LinkedInIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45z" />
    </svg>
  );
}

function FacebookIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

function XTwitterIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function PinterestIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  );
}

function ThreadsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.878-6.43 2.523-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 1.367-.012 2.558-.23 3.551-.65 1.161-.481 1.85-1.197 2.01-2.085.18-1.012-.044-1.813-.656-2.374-.575-.527-1.338-.833-2.296-.913-.149 1.045-.505 1.872-1.064 2.463-.665.702-1.547 1.062-2.624 1.072-1.215.012-2.237-.39-2.96-1.16-.697-.742-1.053-1.771-1.004-2.895.054-1.222.59-2.253 1.557-2.99.932-.711 2.14-1.08 3.591-1.097 1.12-.012 2.134.154 3.02.495-.224-1.463-.916-2.312-2.065-2.53-.317-.06-.658-.09-1.012-.087-.937.007-1.73.254-2.364.735-.544.413-.968 1.027-1.256 1.825l-1.957-.677c.37-1.047.955-1.903 1.74-2.545.89-.726 2.038-1.116 3.414-1.126.457-.003.9.039 1.32.121 2.594.49 4.108 2.44 4.108 5.332 0 .08-.002.16-.004.239.965.447 1.75 1.103 2.322 1.951.69 1.02.966 2.257.72 3.636-.335 1.885-1.546 3.319-3.48 4.154C15.133 23.699 13.76 24 12.186 24zm-.02-9.7c-.85.009-1.534.2-2.04.567-.471.347-.728.85-.752 1.458-.025.572.157 1.05.522 1.44.382.407.943.615 1.67.607.884-.008 1.547-.286 1.967-.826.355-.459.566-1.122.623-1.97-.633-.188-1.296-.283-1.99-.276z" />
    </svg>
  );
}

const PLATFORM_ICONS: Record<string, (props: { size?: number; color: string }) => React.JSX.Element> = {
  Instagram: ({ size, color }) => <span style={{ color }}><InstagramIcon size={size} /></span>,
  TikTok: ({ size, color }) => <span style={{ color }}><TikTokIcon size={size} /></span>,
  YouTube: ({ size, color }) => <span style={{ color }}><YouTubeIcon size={size} /></span>,
  LinkedIn: ({ size, color }) => <span style={{ color }}><LinkedInIcon size={size} /></span>,
  Facebook: ({ size, color }) => <span style={{ color }}><FacebookIcon size={size} /></span>,
  "X / Twitter": ({ size, color }) => <span style={{ color }}><XTwitterIcon size={size} /></span>,
  Pinterest: ({ size, color }) => <span style={{ color }}><PinterestIcon size={size} /></span>,
  Threads: ({ size, color }) => <span style={{ color }}><ThreadsIcon size={size} /></span>,
};

// ─── Metric Chip ──────────────────────────────────────────────────────────────

interface MetricChipProps {
  label: string;
  value: string | number;
  accent?: string;
  highlight?: boolean;
}

function MetricChip({ label, value, accent, highlight }: MetricChipProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide leading-none">
        {label}
      </span>
      <span
        className={`text-sm font-bold leading-snug ${highlight ? "" : "text-gray-900"}`}
        style={highlight && accent ? { color: accent } : undefined}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

// ─── Platform Card ────────────────────────────────────────────────────────────

function PlatformPerformanceCard({ card }: { card: PlatformCard }) {
  const Icon = PLATFORM_ICONS[card.platform];
  const m: PlatformMetrics = card.metrics;

  // Build the dynamic metric list — only include keys that are present
  const metricChips: { label: string; value: string | number; highlight?: boolean }[] = [];

  if (m.followers !== undefined)
    metricChips.push({ label: "Followers", value: m.followers });

  if (m.exposure !== undefined && m.exposureLabel)
    metricChips.push({ label: m.exposureLabel, value: m.exposure, highlight: true });

  if (m.likes !== undefined)
    metricChips.push({ label: "Likes", value: m.likes });

  if (m.comments !== undefined)
    metricChips.push({ label: "Comments", value: m.comments });

  if (m.shares !== undefined)
    metricChips.push({ label: "Shares", value: m.shares });

  if (m.saves !== undefined)
    metricChips.push({ label: "Saves", value: m.saves });

  if (m.views !== undefined)
    metricChips.push({ label: "Views", value: m.views });

  if (m.clickThroughs !== undefined)
    metricChips.push({ label: "Link Clicks", value: m.clickThroughs });

  return (
    <article
      className={`bg-white rounded-2xl border shadow-sm flex flex-col gap-4 p-5 transition-shadow hover:shadow-md ${
        card.connected ? "border-gray-200" : "border-gray-100 opacity-60"
      }`}
    >
      {/* Card header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${card.colorClass}`}
          >
            {Icon ? (
              <Icon size={20} color={card.accent} />
            ) : (
              <span className="text-sm font-bold" style={{ color: card.accent }}>
                {card.platform.slice(0, 2)}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 leading-tight">{card.platform}</h3>
            {card.connected ? (
              <span className="text-[11px] font-medium text-green-600">Connected</span>
            ) : (
              <span className="text-[11px] font-medium text-gray-400">Not connected</span>
            )}
          </div>
        </div>

        {card.connected && m.engagementRate && (
          <div
            className="px-2.5 py-1 rounded-lg text-xs font-bold"
            style={{ backgroundColor: `${card.accent}14`, color: card.accent }}
          >
            {m.engagementRate} ER
          </div>
        )}
      </div>

      {/* Metrics grid — adapts to how many chips exist */}
      {card.connected && metricChips.length > 0 ? (
        <>
          {/* Divider */}
          <div className="border-t border-gray-100" />

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {metricChips.map((chip) => (
              <MetricChip
                key={chip.label}
                label={chip.label}
                value={chip.value}
                accent={card.accent}
                highlight={chip.highlight}
              />
            ))}
          </div>
        </>
      ) : !card.connected ? (
        <p className="text-xs text-gray-400 leading-relaxed">
          Connect this platform to start tracking performance metrics.
        </p>
      ) : null}
    </article>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface PlatformPerformanceCardsProps {
  cards: PlatformCard[];
  /**
   * "no-accounts"  → show full empty state (no platforms connected at all)
   * "loading"      → show skeleton placeholders
   * undefined      → normal render
   */
  emptyVariant?: "no-accounts" | "loading";
}

export default function PlatformPerformanceCards({ cards, emptyVariant }: PlatformPerformanceCardsProps) {
  const connected    = cards.filter((c) => c.connected);
  const disconnected = cards.filter((c) => !c.connected);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Platform Performance</h2>
          <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
            Per-platform breakdown — metrics shown are native to each platform.
          </p>
        </div>
        {!emptyVariant && (
          <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">
            {connected.length} connected
          </span>
        )}
      </div>

      {/* ── Loading skeleton ───────────────────────────────────────────────── */}
      {emptyVariant === "loading" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* ── No accounts empty state ────────────────────────────────────────── */}
      {emptyVariant === "no-accounts" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <EmptyState
            variant="no-accounts"
            ctaLabel="Connect a platform"
            ctaHref="/dashboard/settings"
          />
        </div>
      )}

      {/* ── Normal render ──────────────────────────────────────────────────── */}
      {!emptyVariant && (
        <>
          {/* Connected platforms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {connected.map((card) => (
              <PlatformPerformanceCard key={card.id} card={card} />
            ))}
          </div>

          {/* Disconnected platforms — smaller, greyed out */}
          {disconnected.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {disconnected.map((card) => (
                <PlatformPerformanceCard key={card.id} card={card} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
