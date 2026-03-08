"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveWorkspaceIdFromCookie } from "@/lib/workspace/active";

/**
 * Detects `?uploadpost=success` in the URL, triggers a router refresh + status
 * sync, returns a visible flag for 4 s, then cleans the param from history.
 */
export function useUploadPostSuccess(): boolean {
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("uploadpost") !== "success") return;

    // Remove the param from the URL immediately so a refresh doesn't re-trigger
    params.delete("uploadpost");
    const cleaned =
      window.location.pathname +
      (params.toString() ? `?${params.toString()}` : "") +
      window.location.hash;
    window.history.replaceState({}, "", cleaned);

    setShow(true);

    // Sync status to DB, then refresh RSC cache so panels reflect new state
    const tenantId = getActiveWorkspaceIdFromCookie();
    const headers: HeadersInit = tenantId ? { "X-Tenant-Id": tenantId } : {};
    fetch("/api/v1/onboarding/social-connect/status", { method: "GET", headers })
      .catch(() => {/* non-fatal */})
      .finally(() => router.refresh());

    // Auto-dismiss after 4 s
    const timer = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(timer);
  }, [router]);

  return show;
}
