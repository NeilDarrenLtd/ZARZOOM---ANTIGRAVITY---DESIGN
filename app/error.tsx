"use client";

import { useEffect } from "react";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * App-level error boundary. Catches uncaught errors in the app tree
 * and shows a minimal recovery UI without exposing stack traces.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("[App Error]", error.message, error.digest ?? "");
  }, [error]);

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <SiteNavbar />

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-amber-700" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 text-balance">
            {t("error.title")}
          </h1>
          <p className="mt-3 text-gray-500 leading-relaxed text-pretty">
            {t("error.description")}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="bg-green-600 text-white text-sm font-bold px-8 py-3 rounded-full hover:bg-green-700 transition-colors tracking-wide uppercase"
            >
              {t("error.tryAgain")}
            </button>
            <Link
              href="/"
              className="px-8 py-3 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-sm font-bold text-gray-700 transition-colors tracking-wide uppercase"
            >
              {t("error.backHome")}
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
