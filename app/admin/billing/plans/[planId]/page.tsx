"use client";

import { use } from "react";
import useSWR from "swr";
import { Loader2, AlertCircle } from "lucide-react";
import { PlanEditorForm } from "@/components/admin/billing/plan-editor-form";
import type { PlanWithPrices } from "@/lib/billing/types";

/* ------------------------------------------------------------------ */
/*  Fetcher                                                            */
/* ------------------------------------------------------------------ */

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch plan");
    return r.json();
  });

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

interface PageProps {
  params: Promise<{ planId: string }>;
}

export default function EditPlanPage({ params }: PageProps) {
  const { planId } = use(params);

  const { data, error, isLoading, mutate } = useSWR<{ plan: PlanWithPrices }>(
    `/api/v1/admin/billing/plans/${planId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading plan...
        </div>
      </div>
    );
  }

  if (error || !data?.plan) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error?.message ?? "Plan not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PlanEditorForm plan={data.plan} onRefresh={() => mutate()} />
    </div>
  );
}
