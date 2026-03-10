/**
 * usePlannerItems
 *
 * Data access hook for the Content Planner calendar.
 * Currently backed by mock data. Each section is annotated with the
 * real API call that should replace it when the backend is ready.
 *
 * Workspace support:
 *   All API calls should include a `workspaceId` parameter so that planner
 *   data is scoped per workspace. The workspaceId should come from a global
 *   workspace context (e.g. useWorkspace()) once that is implemented.
 */

"use client";

import { useState, useCallback } from "react";
import { MOCK_PLANNER_ITEMS } from "./mock-data";
import type { PlannerItem } from "./types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UsePlannerItemsOptions {
  /** ISO year-month string, e.g. "2026-03". Controls which month is fetched. */
  yearMonth: string;
  /**
   * TODO (workspace filtering): Pass workspaceId here once workspace context
   * is implemented. All API calls below should include this value.
   */
  // workspaceId?: string;
}

export interface UsePlannerItemsResult {
  /** Items keyed by ISO date string (YYYY-MM-DD) for the current month */
  itemsByDate: Record<string, PlannerItem[]>;
  isLoading: boolean;
  error: string | null;
  createItem: (date: string, item: Omit<PlannerItem, "id">) => void;
  updateItem: (id: string, patch: Partial<PlannerItem>) => void;
  deleteItem: (id: string) => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function usePlannerItems({ yearMonth }: UsePlannerItemsOptions): UsePlannerItemsResult {
  /**
   * TODO (fetch planner items by month):
   *
   * Replace the mock initialiser below with an SWR or React Query call:
   *
   *   const { data, error, isLoading } = useSWR(
   *     `/api/planner/items?month=${yearMonth}&workspaceId=${workspaceId}`,
   *     fetcher
   *   );
   *
   * The response shape should match: Record<string, PlannerItem[]>
   * (date string → items array), or a flat PlannerItem[] that is grouped
   * client-side using groupItemsByDate().
   */
  const [itemsByDate, setItemsByDate] = useState<Record<string, PlannerItem[]>>(() => {
    // Filter mock data to the requested year-month
    return Object.fromEntries(
      Object.entries(MOCK_PLANNER_ITEMS).filter(([date]) => date.startsWith(yearMonth))
    );
  });

  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  // ── Create ────────────────────────────────────────────────────────────────

  const createItem = useCallback((date: string, item: Omit<PlannerItem, "id">) => {
    /**
     * TODO (create planner item):
     *
     *   await fetch("/api/planner/items", {
     *     method: "POST",
     *     body: JSON.stringify({ ...item, date, workspaceId }),
     *   });
     *   mutate(); // revalidate SWR cache
     */
    const newItem: PlannerItem = {
      ...item,
      id: `item-${Date.now()}`,
    };
    setItemsByDate((prev) => ({
      ...prev,
      [date]: [...(prev[date] ?? []), newItem],
    }));
  }, []);

  // ── Update ────────────────────────────────────────────────────────────────

  const updateItem = useCallback((id: string, patch: Partial<PlannerItem>) => {
    /**
     * TODO (update planner item):
     *
     *   await fetch(`/api/planner/items/${id}`, {
     *     method: "PATCH",
     *     body: JSON.stringify({ ...patch, workspaceId }),
     *   });
     *   mutate(); // revalidate SWR cache
     */
    setItemsByDate((prev) => {
      const next = { ...prev };
      for (const [date, items] of Object.entries(next)) {
        const idx = items.findIndex((i) => i.id === id);
        if (idx !== -1) {
          const updated = [...items];
          updated[idx] = { ...updated[idx], ...patch };
          next[date] = updated;
          break;
        }
      }
      return next;
    });
  }, []);

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteItem = useCallback((id: string) => {
    /**
     * TODO (delete planner item):
     *
     *   await fetch(`/api/planner/items/${id}`, {
     *     method: "DELETE",
     *     body: JSON.stringify({ workspaceId }),
     *   });
     *   mutate(); // revalidate SWR cache
     */
    setItemsByDate((prev) => {
      const next = { ...prev };
      for (const [date, items] of Object.entries(next)) {
        const filtered = items.filter((i) => i.id !== id);
        if (filtered.length !== items.length) {
          next[date] = filtered;
          break;
        }
      }
      return next;
    });
  }, []);

  return { itemsByDate, isLoading, error, createItem, updateItem, deleteItem };
}
