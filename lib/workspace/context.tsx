"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getActiveWorkspaceIdFromCookie } from "@/lib/workspace/active";
import { logWorkspaceSwitch } from "@/lib/dev/workspace-guardrails";
import { workspaceScopedKey as workspaceScopedKeyImpl } from "@/lib/workspace/workspace-scoped-key";

const X_TENANT_ID = "x-tenant-id";

/** URLs that are workspace-scoped: must have X-Tenant-Id. */
function isWorkspaceScopedUrl(url: string): boolean {
  const path = typeof url === "string" ? url : String(url);
  if (!path.includes("/api/v1")) return false;
  const noWorkspacePaths = [
    "/api/v1/workspaces",
    "/api/v1/workspace/switch",
    "/api/v1/support/",
    "/api/v1/health",
    "/api/v1/contact",
  ];
  return !noWorkspacePaths.some((p) => path.startsWith(p) || path.includes(p));
}

type WorkspaceContextValue = {
  /** Single source of truth: active workspace id from cookie (synced on mount and after switch). */
  activeWorkspaceId: string | null;
  /** Increments on workspace switch so components can key off it and remount / clear stale state. */
  workspaceSwitchKey: number;
  /** Call after successful switch API: updates context and invalidates caches. */
  setActiveWorkspaceAndInvalidate: (workspaceId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export interface ActiveWorkspaceProviderProps {
  children: ReactNode;
  /** Set by server (dashboard layout) after resolving from cookie / first membership. */
  initialActiveWorkspaceId: string | null;
}

/**
 * Single source of truth for active workspace. Cookie is canonical; context syncs from it.
 * On workspace switch, call setActiveWorkspaceAndInvalidate(id) so all workspace-scoped
 * data is invalidated and components remount with fresh state.
 *
 * Frontend workspace-cleanup rules (avoid state leakage between workspaces):
 * - Data loader keys must include workspace_id (use workspaceScopedKey).
 * - Forms and modals: reset or remount when workspaceSwitchKey / activeWorkspaceId changes
 *   (e.g. useEffect that clears local state, or key={workspaceSwitchKey} on wrapper).
 * - localStorage/sessionStorage: use namespaced keys when workspace-scoped,
 *   e.g. workspace:${workspaceId}:key_name.
 * - Banner and wizard state: reset dismissed/step state when workspace changes so the
 *   UI reflects the current workspace's onboarding state.
 */
export function ActiveWorkspaceProvider({
  children,
  initialActiveWorkspaceId,
}: ActiveWorkspaceProviderProps) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    () => getActiveWorkspaceIdFromCookie() ?? initialActiveWorkspaceId
  );
  const [workspaceSwitchKey, setWorkspaceSwitchKey] = useState(0);
  const previousWorkspaceIdRef = useRef<string | null>(activeWorkspaceId);

  const setActiveWorkspaceAndInvalidate = useCallback((workspaceId: string) => {
    const previous = previousWorkspaceIdRef.current;
    logWorkspaceSwitch(previous, workspaceId, [
      "workspaceSwitchKey increment (remount keyed components)",
      "workspaceScopedKey change (SWR refetch for new workspace)",
    ]);
    previousWorkspaceIdRef.current = workspaceId;
    setActiveWorkspaceId(workspaceId);
    setWorkspaceSwitchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const fromCookie = getActiveWorkspaceIdFromCookie();
    if (fromCookie !== null) {
      previousWorkspaceIdRef.current = fromCookie;
      setActiveWorkspaceId(fromCookie);
    }
  }, []);

  const value: WorkspaceContextValue = {
    activeWorkspaceId,
    workspaceSwitchKey,
    setActiveWorkspaceAndInvalidate,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useActiveWorkspace must be used within ActiveWorkspaceProvider");
  }
  return ctx;
}

/**
 * Returns the active workspace id (single source of truth). May be null before layout has resolved.
 */
export function useActiveWorkspace(): string | null {
  return useWorkspaceContext().activeWorkspaceId;
}

/**
 * Returns the active workspace id, or throws in development if null.
 * Use on pages that are workspace-scoped and must never run without a workspace.
 */
export function useRequiredActiveWorkspace(): string {
  const id = useWorkspaceContext().activeWorkspaceId;
  if (id) return id;
  if (process.env.NODE_ENV === "development") {
    throw new Error(
      "[Workspace] activeWorkspaceId is null but this operation requires a workspace. " +
        "Ensure the user has at least one workspace and the active_workspace_id cookie is set."
    );
  }
  return ""; // Production: avoid throwing; caller should guard
}

/**
 * Returns workspace switch key. Use as React key so components remount and clear state on switch.
 */
export function useWorkspaceSwitchKey(): number {
  return useWorkspaceContext().workspaceSwitchKey;
}

/**
 * Call after successful POST /api/v1/workspace/switch to update context and invalidate caches.
 */
export function useSetActiveWorkspaceAndInvalidate(): (workspaceId: string) => void {
  return useWorkspaceContext().setActiveWorkspaceAndInvalidate;
}

/** Re-export for convenience; implementation in workspace-scoped-key.ts (testable without JSX). */
export const workspaceScopedKey = workspaceScopedKeyImpl;

/**
 * Returns a fetch function that adds X-Tenant-Id for the active workspace.
 * In development, throws if activeWorkspaceId is null and the URL is workspace-scoped.
 */
export function useWorkspaceFetch(): (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response> {
  const { activeWorkspaceId } = useWorkspaceContext();

  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const isScoped = isWorkspaceScopedUrl(url);
      if (isScoped && !activeWorkspaceId) {
        if (process.env.NODE_ENV === "development") {
          throw new Error(
            `[Workspace] Cannot call workspace-scoped API without activeWorkspaceId: ${url}`
          );
        }
      }
      const headers = new Headers(init?.headers);
      if (url.startsWith("/api/v1") || url.includes("/api/v1")) {
        if (activeWorkspaceId) {
          headers.set(X_TENANT_ID, activeWorkspaceId);
        }
      }
      return fetch(input, { ...init, headers, cache: "no-store" as RequestCache });
    },
    [activeWorkspaceId]
  );
}

/**
 * Returns a fetcher for useSWR. Key must include activeWorkspaceId (use workspaceScopedKey).
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
