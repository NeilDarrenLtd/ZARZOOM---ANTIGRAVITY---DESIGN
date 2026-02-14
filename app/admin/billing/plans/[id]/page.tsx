"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PlanForm from "@/components/admin/PlanForm";
import { fetchPlan } from "../../actions";
import type { PlanWithPrices } from "@/lib/billing/types";

export default function EditPlanPage() {
  const params = useParams();
  const [plan, setPlan] = useState<PlanWithPrices | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const result = await fetchPlan(params.id as string);
      if (result.error) setError(result.error);
      setPlan(result.plan);
      setLoading(false);
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-sm text-gray-400">Loading plan...</div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
        {error || "Plan not found"}
      </div>
    );
  }

  return <PlanForm existingPlan={plan} />;
}
