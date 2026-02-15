"use client";

import { QUOTA_KEYS } from "@/lib/billing/types";
import type { QuotaKey } from "@/lib/billing/types";

const QUOTA_LABELS: Record<QuotaKey, string> = {
  images_per_month: "Images / month",
  videos_per_month: "Videos / month",
  articles_per_month: "Articles / month",
  scripts_per_month: "Scripts / month",
  social_posts_per_month: "Social posts / month",
  social_profiles: "Social profiles",
  research_per_month: "Research / month",
  max_api_keys: "Max API keys",
};

interface QuotasEditorProps {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}

export function QuotasEditor({ value, onChange }: QuotasEditorProps) {
  function handleChange(key: QuotaKey, raw: string) {
    const next = { ...value };
    if (raw === "" || raw === "-1") {
      next[key] = -1;
    } else {
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num >= 0) next[key] = num;
    }
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        {"Set -1 or leave blank for unlimited."}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {QUOTA_KEYS.map((key) => {
          const current = value[key];
          const display =
            current === -1 || current === undefined || current === null
              ? ""
              : String(current);

          return (
            <div key={key}>
              <label
                htmlFor={`quota-${key}`}
                className="mb-1 block text-xs font-medium text-zinc-700"
              >
                {QUOTA_LABELS[key]}
              </label>
              <input
                id={`quota-${key}`}
                type="number"
                min={-1}
                step={1}
                placeholder="Unlimited"
                value={display}
                onChange={(e) => handleChange(key, e.target.value)}
                className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
