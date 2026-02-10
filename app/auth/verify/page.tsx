"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { resendVerificationEmail } from "../actions";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import DynamicSEO from "@/components/DynamicSEO";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";

export default function VerifyPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleResend() {
    if (!email || resending) return;
    setResending(true);
    await resendVerificationEmail(email);
    setResent(true);
    setResending(false);
  }

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <DynamicSEO />
      <SiteNavbar />

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-green-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900">
              {t("auth.verifyTitle")}
            </h1>

            <p className="text-sm text-gray-500 mt-3 leading-relaxed">
              {t("auth.verifySubtitle")}
            </p>

            {email && (
              <p className="mt-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg px-4 py-2">
                {email}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3">
              {email && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || resent}
                  className="w-full bg-gray-100 text-gray-700 font-medium py-3 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm"
                >
                  {resent
                    ? t("auth.verifyResent")
                    : resending
                      ? "..."
                      : t("auth.verifyResend")}
                </button>
              )}

              <Link
                href="/auth"
                className="flex items-center justify-center gap-2 w-full text-green-600 hover:text-green-700 font-medium py-3 rounded-lg hover:bg-green-50 transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("auth.verifyBack")}
              </Link>
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
