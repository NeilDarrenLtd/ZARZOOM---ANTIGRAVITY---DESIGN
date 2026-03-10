// ─── Core domain types ─────────────────────────────────────────────────────────

/**
 * The 12 supported content formats.
 * Extend this union as new formats are introduced.
 */
export type ContentType =
  | "Article"
  | "Carousel"
  | "Talking Head Video"
  | "Faceless Video"
  | "B-Roll Video"
  | "Short Clip"
  | "Story Post"
  | "Promotional Post"
  | "Educational Post"
  | "Testimonial"
  | "Announcement"
  | "Trend Reaction";

/**
 * Viral strength rating: 1 (low potential) → 5 (strong viral potential).
 */
export type ViralStrength = 1 | 2 | 3 | 4 | 5;

/**
 * Planning lifecycle status for a content item.
 */
export type PlannerItemStatus =
  | "draft"
  | "planned"
  | "ready"
  | "scheduled"
  | "needs_review"
  | "posted";

/**
 * A single content item on the planner calendar.
 */
export interface PlannerItem {
  id: string;
  /** Short attention-grabbing headline / hook */
  hook: string;
  type: ContentType;
  status: PlannerItemStatus;
  platform: string;
  /** Scheduled time string, e.g. "09:00" */
  time: string;
  /** Longer content brief or description */
  description: string;
  viralStrength: ViralStrength;
  hashtags: string[];
}

// ─── Display tokens ────────────────────────────────────────────────────────────

/** Tailwind classes for each content type pill: bg, text, border */
export const TYPE_COLORS: Record<ContentType, string> = {
  "Article":            "bg-amber-50   text-amber-700   border-amber-200",
  "Carousel":           "bg-violet-50  text-violet-700  border-violet-200",
  "Talking Head Video": "bg-sky-50     text-sky-700     border-sky-200",
  "Faceless Video":     "bg-indigo-50  text-indigo-700  border-indigo-200",
  "B-Roll Video":       "bg-cyan-50    text-cyan-700    border-cyan-200",
  "Short Clip":         "bg-teal-50    text-teal-700    border-teal-200",
  "Story Post":         "bg-pink-50    text-pink-700    border-pink-200",
  "Promotional Post":   "bg-rose-50    text-rose-700    border-rose-200",
  "Educational Post":   "bg-green-50   text-green-700   border-green-200",
  "Testimonial":        "bg-lime-50    text-lime-700    border-lime-200",
  "Announcement":       "bg-orange-50  text-orange-700  border-orange-200",
  "Trend Reaction":     "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
};

/** Abbreviated display labels for compact calendar pills */
export const TYPE_LABELS: Record<ContentType, string> = {
  "Article":            "Article",
  "Carousel":           "Carousel",
  "Talking Head Video": "Talking Head",
  "Faceless Video":     "Faceless",
  "B-Roll Video":       "B-Roll",
  "Short Clip":         "Short Clip",
  "Story Post":         "Story",
  "Promotional Post":   "Promo",
  "Educational Post":   "Edu",
  "Testimonial":        "Testimonial",
  "Announcement":       "Announce",
  "Trend Reaction":     "Trend",
};

/** Tailwind classes for status badges: bg, text */
export const STATUS_COLORS: Record<PlannerItemStatus, string> = {
  draft:        "bg-gray-100  text-gray-500",
  planned:      "bg-blue-50   text-blue-600",
  ready:        "bg-teal-50   text-teal-700",
  scheduled:    "bg-indigo-50 text-indigo-700",
  needs_review: "bg-amber-50  text-amber-700",
  posted:       "bg-green-100 text-green-700",
};

/** Small dot color class for status indicator on calendar pills */
export const STATUS_DOT: Record<PlannerItemStatus, string> = {
  draft:        "bg-gray-300",
  planned:      "bg-blue-400",
  ready:        "bg-teal-400",
  scheduled:    "bg-indigo-400",
  needs_review: "bg-amber-400",
  posted:       "bg-green-500",
};

/** Human-readable status labels */
export const STATUS_LABELS: Record<PlannerItemStatus, string> = {
  draft:        "Draft",
  planned:      "Planned",
  ready:        "Ready",
  scheduled:    "Scheduled",
  needs_review: "Needs Review",
  posted:       "Posted",
};

/** Human-readable viral strength labels */
export const VIRAL_STRENGTH_LABELS: Record<ViralStrength, string> = {
  1: "1 – Low",
  2: "2 – Moderate",
  3: "3 – Good",
  4: "4 – High",
  5: "5 – Strong",
};

/** Supported publishing platforms */
export const ALL_PLATFORMS: string[] = [
  "Multi-platform",
  "Instagram",
  "TikTok",
  "X (Twitter)",
  "LinkedIn",
  "Facebook",
  "YouTube",
  "Pinterest",
];

/** Ordered list of all content types for selects */
export const ALL_TYPES: ContentType[] = [
  "Article",
  "Carousel",
  "Talking Head Video",
  "Faceless Video",
  "B-Roll Video",
  "Short Clip",
  "Story Post",
  "Promotional Post",
  "Educational Post",
  "Testimonial",
  "Announcement",
  "Trend Reaction",
];

/** Ordered list of all statuses with labels for selects */
export const ALL_STATUSES: { value: PlannerItemStatus; label: string }[] = [
  { value: "draft",        label: "Draft" },
  { value: "planned",      label: "Planned" },
  { value: "ready",        label: "Ready" },
  { value: "scheduled",    label: "Scheduled" },
  { value: "needs_review", label: "Needs Review" },
  { value: "posted",       label: "Posted" },
];
