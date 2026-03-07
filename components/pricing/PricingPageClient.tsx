"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DisplayablePlan } from "@/lib/pricing";
import type { Currency, BillingInterval } from "@/lib/billing/api-types";
import { getActiveWorkspaceIdFromCookie } from "@/lib/workspace/active";
import { PricingClient } from "./PricingClient";

interface PricingPageClientProps {
  plans: DisplayablePlan[];
}

export function PricingPageClient({ plans }: PricingPageClientProps) {
  const router = useRouter();
  const [selectedPlanKey, setSelectedPlanKey] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const handleChoosePlan = async (planKey: string, priceId: string) => {
    setSelectedPlanKey(planKey);
    setIsLoading(true);

    try {
      // Find the plan to get currency and interval info
      const plan = plans.find(p => p.planKey === planKey);
      if (!plan) {
        console.error("Plan not found:", planKey);
        setIsLoading(false);
        return;
      }

      // Find the price to get currency and interval
      const price = plan.prices?.find(p => p.id === priceId);
      if (!price) {
        console.error("Price not found:", priceId);
        setIsLoading(false);
        return;
      }

      // Call checkout endpoint (send active workspace so billing is workspace-scoped)
      const tenantId = getActiveWorkspaceIdFromCookie();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (tenantId) headers["X-Tenant-Id"] = tenantId;
      const response = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({
          plan_code: planKey,
          currency: price.currency,
          interval: price.interval === "annual" ? "year" : "month",
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
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned");
        alert("Failed to create checkout session.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <PricingClient
      plans={plans}
      defaultCurrency="GBP"
      defaultInterval="monthly"
      defaultDiscount={true}
      onChoosePlan={handleChoosePlan}
      selectedPlanKey={selectedPlanKey}
    />
  );
}
