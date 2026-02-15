"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeaturesEditorProps {
  value: string[];
  onChange: (v: string[]) => void;
}

export function FeaturesEditor({ value, onChange }: FeaturesEditorProps) {
  const [draft, setDraft] = useState("");

  function addFeature() {
    const trimmed = draft.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setDraft("");
  }

  function removeFeature(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addFeature();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add a feature bullet..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={addFeature}
          disabled={!draft.trim()}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-white transition-colors",
            draft.trim()
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "cursor-not-allowed bg-zinc-300"
          )}
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((feature, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-md border border-zinc-100 bg-white px-3 py-2 text-sm text-zinc-800"
            >
              <span>{feature}</span>
              <button
                type="button"
                onClick={() => removeFeature(i)}
                className="rounded p-0.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                aria-label={`Remove "${feature}"`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
