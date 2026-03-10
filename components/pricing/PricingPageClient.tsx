"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DisplayablePlan } from "@/lib/pricing";
import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import { getActiveWorkspaceIdFromCookie } from "@/lib/workspace/active";
import { createClient } from "@/lib/supabase/client";
import { PricingClient } from "./PricingClient";
import { X } from "lucide-react";

const PENDING_CHECKOUT_KEY = "pendingCheckout";

interface PricingPageClientProps {
  plans: DisplayablePlan[];
}

export function PricingPageClient({ plans }: PricingPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPlanKey, setSelectedPlanKey] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [showCanceled, setShowCanceled] = useState(false);
  const resumeTriggered = useRef(false);

  useEffect(() => {
    if (searchParams.get("checkout") === "canceled") {
      setShowCanceled(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [searchParams]);

  const triggerCheckout = useCallback(async (planKey: string, currency: string, interval: string) => {
    setSelectedPlanKey(planKey);
    setIsLoading(true);

    try {
      const tenantId = getActiveWorkspaceIdFromCookie();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (tenantId) headers["X-Tenant-Id"] = tenantId;

      const response = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({
          plan_code: planKey,
          currency,
          interval,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("Checkout error:", error);
        alert("Failed to start checkout. Please try again.");
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Failed to create checkout session.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("An error occurred. Please try again.");
      setIsLoading(false);
    }
  }, []);

  // Resume pending checkout after auth redirect
  useEffect(() => {
    if (resumeTriggered.current) return;
    if (searchParams.get("resumeCheckout") !== "1") return;
    resumeTriggered.current = true;

    const url = new URL(window.location.href);
    url.searchParams.delete("resumeCheckout");
    window.history.replaceState({}, "", url.pathname + url.search);

    const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);

    try {
      const pending = JSON.parse(raw);
      if (pending.planKey && pending.currency && pending.interval) {
        triggerCheckout(pending.planKey, pending.currency, pending.interval);
      }
    } catch { /* malformed data */ }
  }, [searchParams, triggerCheckout]);

  const handleChoosePlan = async (planKey: string, priceId: string) => {
    const plan = plans.find(p => p.planKey === planKey);
    if (!plan) return;
    const price = plan.prices?.find(p => p.id === priceId);
    if (!price) return;

    const currency = price.currency;
    const interval = price.interval === "annual" ? "year" : "month";

    // Check if user is logged in
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({ planKey, currency, interval }));
      window.location.href = "/auth";
      return;
    }

    await triggerCheckout(planKey, currency, interval);
  };

  return (
    <>
      {showCanceled && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <span>Checkout was cancelled. You can select a plan whenever you&apos;re ready.</span>
          <button
            type="button"
            onClick={() => setShowCanceled(false)}
            className="ml-4 rounded-lg p-1 hover:bg-amber-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <PricingClient
        plans={plans}
        defaultCurrency="GBP"
        defaultInterval="monthly"
        defaultDiscount={true}
        onChoosePlan={handleChoosePlan}
        selectedPlanKey={selectedPlanKey}
      />
    </>
  );
}
