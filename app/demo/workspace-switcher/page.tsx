"use client";

import { useState } from "react";
import WorkspaceSwitcher, {
  Workspace,
} from "@/components/dashboard/WorkspaceSwitcher";
import { Building2, User, Bell, LogOut } from "lucide-react";
import Link from "next/link";

// Demo data showing various workspace statuses
const demoWorkspaces: Workspace[] = [
  {
    id: "ws-1",
    name: "Acme Corporation",
    status: "paid",
    role: "owner",
  },
  {
    id: "ws-2",
    name: "Startup Labs",
    status: "setup_incomplete",
    role: "admin",
  },
  {
    id: "ws-3",
    name: "Tech Ventures",
    status: "payment_required",
    role: "member",
  },
  {
    id: "ws-4",
    name: "Design Studio",
    status: "paid",
    role: "viewer",
  },
];

export default function WorkspaceSwitcherDemo() {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("ws-1");
  const [toast, setToast] = useState<string | null>(null);

  const handleSwitch = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    const workspace = demoWorkspaces.find((w) => w.id === workspaceId);
    setToast(`Switched to ${workspace?.name}`);
    setTimeout(() => setToast(null), 2000);
  };

  const handleAddWorkspace = () => {
    setToast("Create workspace modal would open here");
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mock Dashboard Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <img
                src="/images/zarzoom-logo-v4.png"
                alt="ZARZOOM"
                className="h-10 md:h-14 w-auto rounded-md"
              />
            </Link>

            {/* Right Side: Workspace Switcher + User Profile Area */}
            <div className="flex items-center gap-4">
              {/* Workspace Switcher */}
              <WorkspaceSwitcher
                workspaces={demoWorkspaces}
                activeWorkspaceId={activeWorkspaceId}
                onSwitch={handleSwitch}
                onAddWorkspace={handleAddWorkspace}
              />

              {/* Notification Bell */}
              <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <Bell className="w-5 h-5" />
              </button>

              {/* User Profile */}
              <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-green-600" />
                </div>
                <button className="hidden md:flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Demo Content */}
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Workspace Switcher Demo
          </h1>
          <p className="text-gray-500 mt-2">
            A polished workspace switcher UI for the ZARZOOM dashboard. Click the
            workspace selector in the header to see it in action.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Current Workspace Display
            </h3>
            <p className="text-sm text-gray-500">
              Shows the active workspace name and user role with a compact,
              minimal design that fits well in the header.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Status Badges
            </h3>
            <p className="text-sm text-gray-500">
              Visual indicators for workspace status: Active (paid), Setup
              incomplete, and Payment required states.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Add Workspace
            </h3>
            <p className="text-sm text-gray-500">
              Easy access to create new workspaces directly from the dropdown
              with a prominent action button.
            </p>
          </div>
        </div>

        {/* Status Legend */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Workspace Status Types
          </h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Active
              </span>
              <span className="text-sm text-gray-500">Paid and operational</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Setup incomplete
              </span>
              <span className="text-sm text-gray-500">Needs onboarding completion</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Payment required
              </span>
              <span className="text-sm text-gray-500">Billing action needed</span>
            </div>
          </div>
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4 fade-in duration-200">
          {toast}
        </div>
      )}
    </div>
  );
}
