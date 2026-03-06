import type { Metadata } from "next";
import { headers } from "next/headers";
import { fetchPlansServer, getDisplayablePlans } from "@/lib/pricing";
import { getServerTranslations } from "@/lib/i18n/server";
import { PricingPageClient } from "@/components/pricing/PricingPageClient";
import SiteNavbar from "@/components/SiteNavbar";

export const metadata: Metadata = {
  title: "Pricing - ZARZOOM",
  description: "Choose the perfect plan for your social media automation needs. Transparent pricing with no hidden fees.",
};

export default async function PricingPage() {
  // Server-side: Fetch plans and enrich with translations
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  const t = await getServerTranslations();
  const response = await fetchPlansServer(baseUrl);
  const displayablePlans = getDisplayablePlans(response.plans, t);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
      {/* Sticky Navigation Header */}
      <SiteNavbar />

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            {t("billing.pricing.page.title")}
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            {t("billing.pricing.page.subtitle")}
          </p>
        </div>

        {/* Client Component with Server Data */}
        <PricingPageClient plans={displayablePlans} />

        {/* FAQ Section */}
        <div className="mt-16 text-center">
          <p className="text-sm text-zinc-600">
            {t("billing.pricing.page.contactCtaPrefix")}
            <a href="/contact" className="text-green-600 hover:text-green-700 underline">{t("billing.pricing.page.contactLink")}</a>
            {t("billing.pricing.page.contactCtaSuffix")}
          </p>
        </div>
      </div>
    </div>
  );
}
