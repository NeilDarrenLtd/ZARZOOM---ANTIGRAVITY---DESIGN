"use client";

import { useState } from "react";
import { Loader2, Plus, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { CURRENCIES, INTERVALS, type Currency, type BillingInterval, type PlanPriceRow } from "@/lib/billing/types";
import { formatPrice } from "@/lib/billing/format";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PriceMatrixEditorProps {
  planId: string;
  prices: PlanPriceRow[];
  onAddPrice: (currency: Currency, interval: BillingInterval, unitAmount: number) => Promise<void>;
  onDeactivatePrice: (priceId: string) => Promise<void>;
}

type CellKey = `${Currency}_${BillingInterval}`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PriceMatrixEditor({
  planId,
  prices,
  onAddPrice,
  onDeactivatePrice,
}: PriceMatrixEditorProps) {
  const [editingCell, setEditingCell] = useState<CellKey | null>(null);
  const [draftAmount, setDraftAmount] = useState("");
  const [saving, setSaving] = useState<CellKey | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const activePrices = prices.filter((p) => p.is_active);

  function getActivePrice(currency: Currency, interval: BillingInterval): PlanPriceRow | undefined {
    return activePrices.find(
      (p) => p.currency === currency && p.interval === interval
    );
  }

  async function handleSavePrice(currency: Currency, interval: BillingInterval) {
    const key: CellKey = `${currency}_${interval}`;
    const cents = Math.round(parseFloat(draftAmount) * 100);
    if (isNaN(cents) || cents < 0) return;

    setSaving(key);
    try {
      await onAddPrice(currency, interval, cents);
      setEditingCell(null);
      setDraftAmount("");
    } finally {
      setSaving(null);
    }
  }

  async function handleDeactivate(priceId: string) {
    setDeactivating(priceId);
    try {
      await onDeactivatePrice(priceId);
    } finally {
      setDeactivating(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Currency
              </th>
              {INTERVALS.map((interval) => (
                <th
                  key={interval}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500"
                >
                  {interval === "monthly" ? "Monthly" : "Annual"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {CURRENCIES.map((currency) => (
              <tr key={currency}>
                <td className="px-4 py-3 font-medium text-zinc-700">
                  {currency}
                </td>
                {INTERVALS.map((interval) => {
                  const key: CellKey = `${currency}_${interval}`;
                  const activePrice = getActivePrice(currency, interval);
                  const isEditing = editingCell === key;
                  const isSaving = saving === key;

                  return (
                    <td key={key} className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={draftAmount}
                            onChange={(e) => setDraftAmount(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSavePrice(currency, interval);
                              if (e.key === "Escape") {
                                setEditingCell(null);
                                setDraftAmount("");
                              }
                            }}
                            className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            disabled={isSaving || !draftAmount}
                            onClick={() => handleSavePrice(currency, interval)}
                            className={cn(
                              "rounded-md px-2 py-1.5 text-xs font-medium text-white transition-colors",
                              isSaving || !draftAmount
                                ? "cursor-not-allowed bg-zinc-300"
                                : "bg-emerald-600 hover:bg-emerald-700"
                            )}
                          >
                            {isSaving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCell(null);
                              setDraftAmount("");
                            }}
                            className="rounded-md px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : activePrice ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-zinc-800">
                            {formatPrice(activePrice.unit_amount, currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCell(key);
                              setDraftAmount(
                                (activePrice.unit_amount / 100).toFixed(2)
                              );
                            }}
                            className="rounded px-1.5 py-0.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={deactivating === activePrice.id}
                            onClick={() => handleDeactivate(activePrice.id)}
                            className="rounded px-1.5 py-0.5 text-xs text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            aria-label="Deactivate price"
                          >
                            {deactivating === activePrice.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Ban className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCell(key);
                            setDraftAmount("");
                          }}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600"
                        >
                          <Plus className="h-3 w-3" />
                          Add price
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Price history (collapsed) */}
      {prices.filter((p) => !p.is_active).length > 0 && (
        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer select-none py-1 font-medium hover:text-zinc-700">
            Previous price versions ({prices.filter((p) => !p.is_active).length})
          </summary>
          <ul className="mt-2 space-y-1">
            {prices
              .filter((p) => !p.is_active)
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded bg-zinc-50 px-3 py-1.5"
                >
                  <span className="font-mono">
                    {formatPrice(p.unit_amount, p.currency)}
                  </span>
                  <span className="text-zinc-400">
                    {p.currency} / {p.interval}
                  </span>
                  <span className="text-zinc-400">
                    {p.effective_from
                      ? new Date(p.effective_from).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : ""}
                    {p.effective_to
                      ? ` - ${new Date(p.effective_to).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`
                      : ""}
                  </span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}
