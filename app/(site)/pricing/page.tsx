import { getPlans } from "@/lib/billing/queries";
import PricingSection from "@/components/PricingSection";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - ZARZOOM",
  description:
    "Choose the right plan for your social media automation needs. Start free, upgrade anytime.",
};

export default async function PricingPage() {
  const plans = await getPlans({ status: "active" });

  return (
    <div className="min-h-screen bg-white">
      <PricingSection plans={plans} />
    </div>
  );
}
