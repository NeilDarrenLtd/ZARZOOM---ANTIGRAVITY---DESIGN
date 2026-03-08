"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Plus,
  Check,
  Building2,
  CreditCard,
  AlertCircle,
  Settings,
} from "lucide-react";
import { languages } from "@/lib/i18n";

export type WorkspaceStatus = "active" | "setup_incomplete" | "payment_required";

export interface Workspace {
  id: string;
  name: string;
  status: WorkspaceStatus;
  role?: "owner" | "admin" | "member" | "viewer";
  /** Content language code (e.g. en, fr) from onboarding; shown next to name as e.g. "ZARSK (English)" */
  content_language?: string | null;
}

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onSwitch: (workspaceId: string) => void;
  onAddWorkspace: () => void;
  /** When true, Add Workspace button is disabled (e.g. create in progress). */
  addWorkspaceLoading?: boolean;
}

function getStatusConfig(status: WorkspaceStatus) {
  switch (status) {
    case "active":
      return {
        label: "Paid",
        className: "bg-green-100 text-green-700",
        icon: Check,
      };
    case "setup_incomplete":
      return {
        label: "Setup Incomplete",
        className: "bg-amber-100 text-amber-700",
        icon: Settings,
      };
    case "payment_required":
      return {
        label: "Payment Required",
        className: "bg-red-100 text-red-700",
        icon: AlertCircle,
      };
    default:
      return {
        label: "Unknown",
        className: "bg-gray-100 text-gray-700",
        icon: Building2,
      };
  }
}

const MOBILE_BREAKPOINT = 640;

export default function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  onSwitch,
  onAddWorkspace,
  addWorkspaceLoading = false,
}: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mobileDropdownRect, setMobileDropdownRect] = useState<{
    top: number;
    left: number;
    right: number;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  // On mobile, position dropdown fixed so it stays on-screen
  const updateMobileRect = useCallback(() => {
    if (!isOpen || typeof window === "undefined") {
      setMobileDropdownRect(null);
      return;
    }
    if (window.innerWidth >= MOBILE_BREAKPOINT) {
      setMobileDropdownRect(null);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const padding = 8;
    setMobileDropdownRect({
      top: rect.bottom + 4,
      left: padding,
      right: padding,
    });
  }, [isOpen]);

  useEffect(() => {
    updateMobileRect();
    window.addEventListener("resize", updateMobileRect);
    return () => window.removeEventListener("resize", updateMobileRect);
  }, [updateMobileRect]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const activeStatusConfig = activeWorkspace
    ? getStatusConfig(activeWorkspace.status)
    : null;

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 min-w-[180px] max-w-[240px]"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Switch workspace"
      >
        {/* Workspace Icon */}
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-white" />
        </div>

        {/* Workspace Info */}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {activeWorkspace?.name || "Select workspace"}
          </p>
          {activeStatusConfig && (
            <p className="text-xs text-gray-500 truncate">
              {activeWorkspace?.role === "owner" ? "Owner" : activeWorkspace?.role || "Member"}
            </p>
          )}
        </div>

        {/* Chevron */}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={
              mobileDropdownRect
                ? "fixed w-[calc(100vw-1rem)] max-w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 max-h-[calc(100vh-8rem)] overflow-y-auto"
                : "absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
            }
            style={
              mobileDropdownRect
                ? {
                    top: mobileDropdownRect.top,
                    left: mobileDropdownRect.left,
                    right: mobileDropdownRect.right,
                  }
                : undefined
            }
            role="listbox"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Workspaces
              </p>
            </div>

            {/* Workspace List */}
            <div className="max-h-64 overflow-y-auto py-1">
              {workspaces.map((workspace) => {
                const statusConfig = getStatusConfig(workspace.status);
                const StatusIcon = statusConfig.icon;
                const isActive = workspace.id === activeWorkspaceId;

                return (
                  <button
                    key={workspace.id}
                    onClick={() => {
                      onSwitch(workspace.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ${
                      isActive
                        ? "bg-green-50"
                        : "hover:bg-gray-50"
                    }`}
                    role="option"
                    aria-selected={isActive}
                  >
                    {/* Workspace Icon */}
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isActive
                          ? "bg-gradient-to-br from-green-500 to-green-600"
                          : "bg-gray-100"
                      }`}
                    >
                      <Building2
                        className={`w-4 h-4 ${
                          isActive ? "text-white" : "text-gray-500"
                        }`}
                      />
                    </div>

                    {/* Workspace Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm font-medium truncate ${
                            isActive ? "text-green-700" : "text-gray-900"
                          }`}
                        >
                          {workspace.name}
                          {workspace.content_language && (
                            <span className="text-gray-500 font-normal">
                              {" "}
                              ({languages.find((l) => l.code === workspace.content_language)?.name ?? workspace.content_language})
                            </span>
                          )}
                        </p>
                        {isActive && (
                          <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        )}
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConfig.className}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Add Workspace Button */}
            <div className="border-t border-gray-100 p-2">
              <button
                onClick={() => {
                  onAddWorkspace();
                  setIsOpen(false);
                }}
                disabled={addWorkspaceLoading}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 transition-colors duration-150 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-9 h-9 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center group-hover:border-green-400 transition-colors">
                  <Plus className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" />
                </div>
                <span className="text-sm font-medium text-gray-600 group-hover:text-green-600 transition-colors">
                  Add Workspace
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
