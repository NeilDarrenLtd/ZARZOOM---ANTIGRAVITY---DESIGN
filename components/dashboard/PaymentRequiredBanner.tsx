"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import {
  useActiveWorkspace,
  useWorkspaceFetch,
  useWorkspaceSwitchKey,
} from "@/lib/workspace/context";

interface PaymentRequiredBannerProps {
  /** Server-rendered initial subscription status for the active workspace. */
  initialStatus: string;
}

const SHOW_STATUSES = new Set(["none", "incomplete", "canceled"]);

/**
 * Subscription-required banner. Uses the server-rendered initial status to avoid
 * flicker on first paint, then re-fetches from /api/v1/billing/status whenever
 * the active workspace changes so the banner always reflects the selected workspace.
 */
export default function PaymentRequiredBanner({ initialStatus }: PaymentRequiredBannerProps) {
  const activeWorkspaceId = useActiveWorkspace();
  const workspaceFetch = useWorkspaceFetch();
  const workspaceSwitchKey = useWorkspaceSwitchKey();
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await workspaceFetch("/api/v1/billing/status");
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.status) {
          setStatus(data.status);
        }
      } catch {
        // keep existing status on error
      }
    })();
    return () => { cancelled = true; };
  }, [activeWorkspaceId, workspaceSwitchKey, workspaceFetch]);

  if (!SHOW_STATUSES.has(status)) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto max-w-5xl px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Subscription Required
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Choose a plan to unlock content creation, publishing, and social connections.
            </p>
          </div>
        </div>
        <Link
          href="/pricing"
          className="flex-shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 transition-colors"
        >
          View Plans
        </Link>
      </div>
    </div>
  );
}
