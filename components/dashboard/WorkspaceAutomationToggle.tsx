"use client";

import { useState } from "react";
import { Play, Pause } from "lucide-react";

interface WorkspaceAutomationToggleProps {
  workspaceId: string;
  isPaused: boolean;
  onToggle: (workspaceId: string, isPaused: boolean) => Promise<void>;
}

/**
 * Toggle control for the workspace's automation service (Active / Paused).
 * Displayed near the top of the dashboard for the currently selected workspace.
 */
export default function WorkspaceAutomationToggle({
  workspaceId,
  isPaused,
  onToggle,
}: WorkspaceAutomationToggleProps) {
  const [toggling, setToggling] = useState(false);

  async function handleClick() {
    if (toggling) return;
    setToggling(true);
    try {
      await onToggle(workspaceId, !isPaused);
    } finally {
      setToggling(false);
    }
  }

  const isActive = !isPaused;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={toggling}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${
        isActive
          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
      } disabled:opacity-60 disabled:cursor-wait`}
      aria-label={isActive ? "Pause automation" : "Resume automation"}
    >
      {/* Toggle track */}
      <span
        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 ${
          isActive ? "bg-green-500" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 mt-0.5 ${
            isActive ? "translate-x-4 ml-0.5" : "translate-x-0.5"
          }`}
        />
      </span>

      {/* Status icon + label */}
      {isActive ? (
        <>
          <Play className="w-3 h-3 fill-current" />
          <span>Active</span>
        </>
      ) : (
        <>
          <Pause className="w-3 h-3" />
          <span>Paused</span>
        </>
      )}
    </button>
  );
}
