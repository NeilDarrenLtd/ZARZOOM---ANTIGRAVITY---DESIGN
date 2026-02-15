import type { Metadata } from "next";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { PricingShell } from "@/components/pricing/pricing-shell";
import type { Currency, BillingInterval } from "@/lib/billing/types";
import { CURRENCIES } from "@/lib/billing/types";

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: "Pricing - ZARZOOM",
  description:
    "Explore ZARZOOM pricing plans. Choose Basic, Pro, or Advanced to automate your social media growth with AI-powered content generation.",
  openGraph: {
    title: "Pricing - ZARZOOM",
    description:
      "Explore ZARZOOM pricing plans for social media automation.",
  },
};

/* ------------------------------------------------------------------ */
/*  Data fetching                                                      */
/* ------------------------------------------------------------------ */

interface PlanRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  highlight: boolean;
  is_active: boolean;
  features: string[] | null;
  plan_prices: PriceRow[];
}

interface PriceRow {
  id: string;
  plan_id: string;
  currency: string;
  interval: string;
  unit_amount: number;
  is_active: boolean;
  billing_provider_price_id: string | null;
}

async function getActivePlansWithPrices() {
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from("subscription_plans")
    .select("id, name, slug, description, display_order, highlight, is_active, features, plan_prices(id, plan_id, currency, interval, unit_amount, is_active, billing_provider_price_id)")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;

  /* Filter only active prices and cast */
  return ((data ?? []) as PlanRow[]).map((plan) => ({
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    highlight: plan.highlight,
    features: (plan.features ?? []) as string[],
    prices: (plan.plan_prices ?? [])
      .filter((p) => p.is_active)
      .map((p) => ({
        id: p.id,
        currency: p.currency as Currency,
        interval: p.interval as BillingInterval,
        unit_amount: p.unit_amount,
        billing_provider_price_id: p.billing_provider_price_id,
      })),
  }));
}

async function getIsLoggedIn(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Derive available currencies from the prices that actually exist    */
/* ------------------------------------------------------------------ */

function deriveAvailableCurrencies(
  plans: Awaited<ReturnType<typeof getActivePlansWithPrices>>
): Currency[] {
  const seen = new Set<Currency>();
  for (const plan of plans) {
    for (const price of plan.prices) {
      seen.add(price.currency);
    }
  }
  /* Return in the canonical order */
  return CURRENCIES.filter((c) => seen.has(c));
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function PricingPage() {
  const [plans, isLoggedIn] = await Promise.all([
    getActivePlansWithPrices(),
    getIsLoggedIn(),
  ]);

  const availableCurrencies = deriveAvailableCurrencies(plans);

  return (
    <main className="min-h-screen bg-[hsl(var(--background))]">
      <PricingShell
        plans={plans}
        availableCurrencies={
          availableCurrencies.length > 0 ? availableCurrencies : ["GBP"]
        }
        isLoggedIn={isLoggedIn}
      />
    </main>
  );
}
