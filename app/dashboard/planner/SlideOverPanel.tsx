"use client";

import { X, Clock, Tag, Globe, AlignLeft, Hash } from "lucide-react";
import { TYPE_COLORS, STATUS_COLORS, type PlannerItem } from "./mock-data";

interface SlideOverPanelProps {
  item: PlannerItem | null;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  post: "Post",
  story: "Story",
  reel: "Reel",
  article: "Article",
  campaign: "Campaign",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  review: "In Review",
};

export default function SlideOverPanel({ item, onClose }: SlideOverPanelProps) {
  return (
    <>
      {/* Backdrop */}
      {item && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Planner item details"
        className={`fixed top-0 right-0 z-40 h-full w-full max-w-sm bg-white shadow-2xl border-l border-gray-200 flex flex-col transition-transform duration-300 ease-in-out ${
          item ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
            Item Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {item ? (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Title */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Title
              </p>
              <p className="text-base font-bold text-gray-900 text-pretty">
                {item.title}
              </p>
            </div>

            {/* Type & Status badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold capitalize ${TYPE_COLORS[item.type]}`}
              >
                <Tag className="w-3 h-3" />
                {TYPE_LABELS[item.type]}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[item.status]}`}
              >
                {STATUS_LABELS[item.status]}
              </span>
            </div>

            {/* Divider */}
            <hr className="border-gray-100" />

            {/* Platform */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0 w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 text-green-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                  Platform
                </p>
                <p className="text-sm font-medium text-gray-800">{item.platform}</p>
              </div>
            </div>

            {/* Scheduled time */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0 w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-green-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                  Scheduled Time
                </p>
                <p className="text-sm font-medium text-gray-800">{item.time}</p>
              </div>
            </div>

            {/* Description */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0 w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
                <AlignLeft className="w-3.5 h-3.5 text-green-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                  Description
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>

            {/* Hashtags */}
            {item.hashtags.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
                  <Hash className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    Hashtags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="text-sm text-gray-400 text-center leading-relaxed">
              Select a content item from the calendar to view its details here.
            </p>
          </div>
        )}

        {/* Footer actions (reserved for future edit/save) */}
        {item && (
          <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
            <button
              type="button"
              disabled
              className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold opacity-40 cursor-not-allowed"
            >
              Edit Item
            </button>
            <button
              type="button"
              disabled
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 opacity-40 cursor-not-allowed"
            >
              Duplicate
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
