"use client";

import { useState, useEffect } from "react";
import { X, Trash2, Save, ChevronDown } from "lucide-react";
import {
  TYPE_COLORS,
  TYPE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type PlannerItem,
  type ContentType,
  type PlannerItemStatus,
} from "./mock-data";

interface SlideOverPanelProps {
  item: PlannerItem | null;
  onClose: () => void;
}

const ALL_TYPES: ContentType[] = [
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

const ALL_STATUSES: { value: PlannerItemStatus; label: string }[] = [
  { value: "draft",        label: "Draft" },
  { value: "planned",      label: "Planned" },
  { value: "ready",        label: "Ready" },
  { value: "scheduled",    label: "Scheduled" },
  { value: "needs_review", label: "Needs Review" },
  { value: "posted",       label: "Posted" },
];

const ALL_PLATFORMS = [
  "Multi-platform",
  "Instagram",
  "TikTok",
  "X (Twitter)",
  "LinkedIn",
  "Facebook",
  "YouTube",
  "Pinterest",
];

const VIRAL_LABELS: Record<number, string> = {
  1: "1 – Low",
  2: "2 – Moderate",
  3: "3 – Good",
  4: "4 – High",
  5: "5 – Strong",
};

// ─── Reusable field wrapper ───────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow";

const selectBase =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow appearance-none cursor-pointer";

// ─── Main component ───────────────────────────────────────────────────────────

export default function SlideOverPanel({ item, onClose }: SlideOverPanelProps) {
  const [form, setForm] = useState<PlannerItem | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync form when item changes
  useEffect(() => {
    if (item) {
      setForm({ ...item });
      setIsDirty(false);
      setShowDeleteConfirm(false);
    }
  }, [item]);

  function update<K extends keyof PlannerItem>(key: K, value: PlannerItem[K]) {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
    setIsDirty(true);
  }

  function handleTagsChange(raw: string) {
    const tags = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    update("hashtags", tags);
  }

  function handleCancel() {
    if (item) {
      setForm({ ...item });
      setIsDirty(false);
    }
    setShowDeleteConfirm(false);
  }

  if (!form && !item) {
    // Panel is closed — nothing to render inside
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ${
          item ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Edit planner item"
        className={`fixed top-0 right-0 z-40 h-full w-full max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col transition-transform duration-300 ease-in-out ${
          item ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white">
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Edit Content Item
            </h2>
            {form && (
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[240px]">
                {form.hook}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable form body ── */}
        {form ? (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

            {/* ── Section: Content ── */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Content
              </p>
              <div className="space-y-4">
                <FieldGroup label="Hook">
                  <input
                    type="text"
                    value={form.hook}
                    onChange={(e) => update("hook", e.target.value)}
                    placeholder="Enter your hook or headline..."
                    className={inputBase}
                  />
                </FieldGroup>

                <FieldGroup label="Brief / Summary">
                  <textarea
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="Describe the content idea, angle, or key message..."
                    rows={3}
                    className={`${inputBase} resize-none leading-relaxed`}
                  />
                </FieldGroup>

                <FieldGroup label="Notes">
                  <textarea
                    value={""}
                    onChange={() => {}}
                    placeholder="Internal notes, creative direction, references..."
                    rows={2}
                    className={`${inputBase} resize-none leading-relaxed`}
                  />
                </FieldGroup>

                <FieldGroup label="Call to Action">
                  <input
                    type="text"
                    placeholder="e.g. Link in bio, DM us, Comment below..."
                    className={inputBase}
                  />
                </FieldGroup>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* ── Section: Settings ── */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Settings
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="Content Type">
                    <div className="relative">
                      <select
                        value={form.type}
                        onChange={(e) => update("type", e.target.value as ContentType)}
                        className={selectBase}
                      >
                        {ALL_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </FieldGroup>

                  <FieldGroup label="Status">
                    <div className="relative">
                      <select
                        value={form.status}
                        onChange={(e) => update("status", e.target.value as PlannerItemStatus)}
                        className={selectBase}
                      >
                        {ALL_STATUSES.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </FieldGroup>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="Platform">
                    <div className="relative">
                      <select
                        value={form.platform}
                        onChange={(e) => update("platform", e.target.value)}
                        className={selectBase}
                      >
                        {ALL_PLATFORMS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </FieldGroup>

                  <FieldGroup label="Viral Strength">
                    <div className="relative">
                      <select
                        value={form.viralStrength}
                        onChange={(e) =>
                          update("viralStrength", Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
                        }
                        className={selectBase}
                      >
                        {[1, 2, 3, 4, 5].map((v) => (
                          <option key={v} value={v}>
                            {VIRAL_LABELS[v]}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </FieldGroup>
                </div>

                <FieldGroup label="Scheduled Date">
                  <input
                    type="date"
                    className={inputBase}
                    defaultValue={
                      (() => {
                        // Find this item's date from mock data key — just leave blank for now
                        return "";
                      })()
                    }
                  />
                </FieldGroup>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* ── Section: Metadata ── */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Metadata
              </p>
              <FieldGroup label="Tags (comma separated)">
                <input
                  type="text"
                  value={form.hashtags.join(", ")}
                  onChange={(e) => handleTagsChange(e.target.value)}
                  placeholder="#socialmedia, #zarzoom, #contentcreator"
                  className={inputBase}
                />
                {form.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {form.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </FieldGroup>
            </div>

            {/* ── Status badge preview ── */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${TYPE_COLORS[form.type]}`}
              >
                {TYPE_LABELS[form.type]}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[form.status]}`}
              >
                {STATUS_LABELS[form.status]}
              </span>
            </div>

            {/* ── Delete confirmation inline ── */}
            {showDeleteConfirm && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-red-700">Delete this item?</p>
                <p className="text-xs text-red-500 leading-relaxed">
                  This action cannot be undone. The item will be permanently removed from the calendar.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2 rounded-lg bg-red-600 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
                  >
                    Yes, delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="text-sm text-gray-400 text-center leading-relaxed">
              Select a content item from the calendar to edit it here.
            </p>
          </div>
        )}

        {/* ── Footer actions ── */}
        {form && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-white space-y-2">
            {/* Primary row */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isDirty}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isDirty
                    ? "bg-green-600 text-white hover:bg-green-700 shadow-sm"
                    : "bg-green-100 text-green-400 cursor-not-allowed"
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </button>
            </div>

            {/* Delete row */}
            {!showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Item
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
