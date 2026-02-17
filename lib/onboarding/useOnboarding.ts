"use client";

import useSWR from "swr";

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

const fetcher = async (url: string): Promise<OnboardingProfile | null> => {
  const res = await fetch(url);
  if (!res.ok) return null;
  const body = await res.json();
  return body.data ?? null;
};

/**
 * SWR-backed hook that exposes the current user's onboarding status.
 *
 * Returns:
 *  - profile:    the full onboarding_profiles row (or null)
 *  - status:     shortcut to onboarding_status
 *  - isComplete: true when status === 'completed'
 *  - needsBanner: true when status is 'skipped' or 'in_progress'
 *  - isLoading:  SWR loading state
 *  - mutate:     SWR mutate to refetch after changes
 */
export function useOnboarding() {
  const { data: profile, error, isLoading, mutate } = useSWR<OnboardingProfile | null>(
    "/api/v1/onboarding",
    fetcher,
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
