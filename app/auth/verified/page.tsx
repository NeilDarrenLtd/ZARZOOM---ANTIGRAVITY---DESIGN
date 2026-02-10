"use client";

import { useI18n } from "@/lib/i18n";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import DynamicSEO from "@/components/DynamicSEO";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default function VerifiedPage() {
  const { t } = useI18n();

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <DynamicSEO />
      <SiteNavbar />

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900">
              {t("auth.verifiedTitle")}
            </h1>

            <p className="text-sm text-gray-500 mt-3 leading-relaxed">
              {t("auth.verifiedSubtitle")}
            </p>

            <Link
              href="/auth"
              className="mt-6 inline-block w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors text-sm uppercase tracking-wide text-center"
            >
              {t("auth.verifiedContinue")}
            </Link>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
