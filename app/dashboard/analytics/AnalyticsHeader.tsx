"use client";

import { Building2, ChevronRight } from "lucide-react";

interface AnalyticsHeaderProps {
  workspaceName: string | null;
}

export default function AnalyticsHeader({ workspaceName }: AnalyticsHeaderProps) {
  return (
    <header className="mb-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-gray-400 mb-5">
        <a href="/dashboard" className="hover:text-green-600 transition-colors font-medium">
          Dashboard
        </a>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-600 font-medium">Analytics</span>
      </nav>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Title block */}
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              {/* Bar chart icon rendered inline via SVG */}
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <rect x="3" y="12" width="4" height="9" rx="1" />
                <rect x="10" y="7" width="4" height="14" rx="1" />
                <rect x="17" y="3" width="4" height="18" rx="1" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 leading-tight text-balance">
                Analytics
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                See how your AI-powered content is performing.
              </p>
            </div>
          </div>

          {/* Workspace indicator */}
          {workspaceName && (
            <div className="flex items-center gap-1.5 mt-3 ml-[52px]">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200">
                <Building2 className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs font-semibold text-green-700">
                  {workspaceName}
                </span>
                <span className="text-xs text-green-500 font-medium">· Workspace Analytics</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
