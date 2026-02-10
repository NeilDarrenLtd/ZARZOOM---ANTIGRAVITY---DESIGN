"use client";

import { useI18n } from "@/lib/i18n";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function AuthErrorPage() {
  const { t } = useI18n();

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl font-bold">!</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {t("auth.authError")}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {t("auth.authErrorMessage")}
          </p>
          <Link
            href="/login-launch"
            className="mt-6 inline-block bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 transition-colors text-sm uppercase tracking-wide"
          >
            {t("auth.tryAgain")}
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}
