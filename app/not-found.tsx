"use client";

import { useI18n } from "@/lib/i18n";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { Rocket } from "lucide-react";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <SiteNavbar />

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <Rocket className="w-10 h-10 text-green-600" />
            </div>
          </div>

          <h1 className="text-7xl font-black text-green-600 tracking-tight">
            404
          </h1>
          <h2 className="mt-4 text-2xl font-bold text-gray-900 text-balance">
            {"Houston, we have a problem"}
          </h2>
          <p className="mt-3 text-gray-500 leading-relaxed text-pretty">
            {"The page you're looking for has drifted into deep space. Let's get you back on course."}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="bg-green-600 text-white text-sm font-bold px-8 py-3 rounded-full hover:bg-green-700 transition-colors tracking-wide uppercase"
            >
              {"Back to Home"}
            </Link>
            <Link
              href="/support"
              className="px-8 py-3 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-sm font-bold text-gray-700 transition-colors tracking-wide uppercase"
            >
              {t("nav.support")}
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
