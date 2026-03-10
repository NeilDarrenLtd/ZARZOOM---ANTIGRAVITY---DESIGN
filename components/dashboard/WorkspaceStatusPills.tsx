"use client";

import type { WorkspaceStatus } from "./WorkspaceSwitcher";

interface WorkspaceStatusPillsProps {
  status: WorkspaceStatus;
  isPaused: boolean;
}

interface PillDef {
  label: string;
  className: string;
}

/**
 * Compact coloured status pills for a workspace.
 * Shows one or more of: Active, Paused, Setup Incomplete, Subscription Required.
 */
export default function WorkspaceStatusPills({ status, isPaused }: WorkspaceStatusPillsProps) {
  const pills: PillDef[] = [];

  if (isPaused) {
    pills.push({ label: "Paused", className: "bg-gray-100 text-gray-600" });
  } else if (status === "active") {
    pills.push({ label: "Active", className: "bg-green-100 text-green-700" });
  }

  if (status === "setup_incomplete") {
    pills.push({ label: "Setup Incomplete", className: "bg-amber-100 text-amber-700" });
  }

  if (status === "payment_required") {
    pills.push({ label: "Subscription Required", className: "bg-red-100 text-red-700" });
  }

  if (pills.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {pills.map((pill) => (
        <span
          key={pill.label}
          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-tight ${pill.className}`}
        >
          {pill.label}
        </span>
      ))}
    </div>
  );
}
