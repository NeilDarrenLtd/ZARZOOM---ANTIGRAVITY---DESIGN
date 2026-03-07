"use client";

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";

const X_TENANT_ID = "x-tenant-id";

const ActiveWorkspaceContext = createContext<string | null>(null);

export interface ActiveWorkspaceProviderProps {
  children: ReactNode;
  /** Set by server (dashboard layout) after resolving from cookie / first membership */
  initialActiveWorkspaceId: string | null;
}

export function ActiveWorkspaceProvider({
  children,
  initialActiveWorkspaceId,
}: ActiveWorkspaceProviderProps) {
  return (
    <ActiveWorkspaceContext.Provider value={initialActiveWorkspaceId}>
      {children}
    </ActiveWorkspaceContext.Provider>
  );
}

export function useActiveWorkspace(): string | null {
  return useContext(ActiveWorkspaceContext);
}

/**
 * Returns a fetch function that adds X-Tenant-Id for the active workspace.
 * Use this for all dashboard API calls so data is scoped to the active workspace.
 */
export function useWorkspaceFetch(): (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response> {
  const activeWorkspaceId = useActiveWorkspace();

  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const isApiV1 = url.startsWith("/api/v1") || url.includes("/api/v1");
      const headers = new Headers(init?.headers);
      if (isApiV1 && activeWorkspaceId) {
        headers.set(X_TENANT_ID, activeWorkspaceId);
      }
      return fetch(input, { ...init, headers });
    },
    [activeWorkspaceId]
  );
}

/**
 * Returns a fetcher suitable for useSWR that includes X-Tenant-Id.
 * Usage: const fetcher = useWorkspaceFetcher(); useSWR(key, fetcher);
 */
export function useWorkspaceFetcher<T = unknown>(): (url: string) => Promise<T> {
  const workspaceFetch = useWorkspaceFetch();
  return useCallback(
    async (url: string): Promise<T> => {
      const res = await workspaceFetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<T>;
    },
    [workspaceFetch]
  );
}
