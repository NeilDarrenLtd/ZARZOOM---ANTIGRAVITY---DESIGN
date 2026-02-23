import type { Metadata } from "next";
import { PricingProvider } from "@/components/pricing/PricingProvider";
import { CurrencyToggle } from "@/components/pricing/CurrencyToggle";
import { IntervalToggle } from "@/components/pricing/IntervalToggle";
import { PricingGrid } from "@/components/pricing/PricingGrid";

export const metadata: Metadata = {
  title: "Pricing - ZARZOOM",
  description: "Choose the perfect plan for your social media automation needs. Transparent pricing with no hidden fees.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            Choose the plan that's right for you. All plans include a 14-day free trial.
          </p>
        </div>

        {/* Pricing System */}
        <PricingProvider defaultCurrency="GBP" defaultInterval="monthly">
          {/* Controls */}
          <div className="mb-12 flex flex-col items-center justify-center gap-6 sm:flex-row">
            <CurrencyToggle />
            <IntervalToggle />
          </div>

          {/* Plans Grid */}
          <PricingGrid
            onChoosePlan={(planKey, priceId) => {
              console.log("[v0] Selected plan:", { planKey, priceId });
              // TODO: Navigate to checkout or signup
            }}
          />
        </PricingProvider>

        {/* FAQ Section */}
        <div className="mt-16 text-center">
          <p className="text-sm text-zinc-600">
            Questions? <a href="/contact" className="text-green-600 hover:text-green-700 underline">Contact us</a> and we'll help you find the right plan.
          </p>
        </div>
      </div>
    </div>
  );
}
