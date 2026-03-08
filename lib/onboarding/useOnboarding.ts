"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { useActiveWorkspace, workspaceScopedKey } from "@/lib/workspace/context";

export type OnboardingStatus =
  | "not_started"
  | "in_progress"
  | "skipped"
  | "completed";

export interface OnboardingProfile {
  user_id: string;
  onboarding_status: OnboardingStatus;
  onboarding_step: number;
  business_name?: string | null;
  selected_plan?: string | null;
  [key: string]: unknown;
}

/**
 * SWR-backed hook that exposes the **active workspace's** onboarding status.
 * Must be used inside ActiveWorkspaceProvider (e.g. dashboard layout).
 * Sends X-Tenant-Id so the banner and completion state are scoped per workspace.
 *
 * Returns:
 *  - profile:    the full onboarding_profiles row (or null)
 *  - status:     shortcut to onboarding_status
 *  - isComplete: true when status === 'completed'
 *  - needsBanner: true when status is 'skipped' or 'in_progress' (only for active workspace)
 *  - isLoading:  SWR loading state
 *  - mutate:     SWR mutate to refetch after changes
 */
export function useOnboarding() {
  const activeWorkspaceId = useActiveWorkspace();

  const fetcher = useCallback(
    async (url: string): Promise<OnboardingProfile | null> => {
      const headers: HeadersInit = { credentials: "include" };
      if (activeWorkspaceId) {
        (headers as Record<string, string>)["X-Tenant-Id"] = activeWorkspaceId;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      const body = await res.json();
      return body.data ?? null;
    },
    [activeWorkspaceId]
  );

  const { data: profile, error, isLoading, mutate } = useSWR<OnboardingProfile | null>(
    workspaceScopedKey("/api/v1/onboarding", activeWorkspaceId),
    ([url]) => fetcher(url as string),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  const status: OnboardingStatus = profile?.onboarding_status ?? "not_started";
  const isComplete = status === "completed";
  const needsBanner = status === "skipped" || status === "in_progress";

  return {
    profile,
    status,
    isComplete,
    needsBanner,
    isLoading,
    isError: !!error,
    mutate,
  };
}
