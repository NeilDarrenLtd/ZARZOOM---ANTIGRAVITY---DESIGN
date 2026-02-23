import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PricingShell } from "@/components/pricing/pricing-shell";
import SiteNavbar from "@/components/SiteNavbar";
import { getServerTranslations } from "@/lib/i18n/server";
import { getDisplayablePlans } from "@/lib/billing/displayable-plans";
import { AlertCircle } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  ISR Configuration - Cache for 5 minutes                            */
/* ------------------------------------------------------------------ */

export const revalidate = 300; // 5 minutes
export const dynamic = "force-static";

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
/*  Helper: Check if user is logged in                                 */
/* ------------------------------------------------------------------ */

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
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function PricingPage() {
  const [t, isLoggedIn] = await Promise.all([
    getServerTranslations(),
    getIsLoggedIn(),
  ]);

  // Apply strict gating: only show plans that pass BOTH checks
  let displayablePlans;
  try {
    displayablePlans = await getDisplayablePlans(t);
    console.log("[v0] Pricing page: displaying", displayablePlans.length, "plans");
  } catch (error) {
    console.error("[v0] Failed to load displayable plans:", error);
    displayablePlans = [];
  }

  return (
    <>
      <SiteNavbar />
      <main className="min-h-screen bg-[hsl(var(--background))] pt-8">
        {displayablePlans.length > 0 ? (
          <PricingShell
            plans={displayablePlans}
            isLoggedIn={isLoggedIn}
          />
        ) : (
          <div className="max-w-2xl mx-auto px-4 py-20 text-center">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8">
              <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {t("pricing.fallback.title", "Pricing Temporarily Unavailable")}
              </h2>
              <p className="text-gray-600 leading-relaxed">
                {t(
                  "pricing.fallback.message",
                  "We're currently updating our pricing plans. Please check back shortly or contact support for assistance."
                )}
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
