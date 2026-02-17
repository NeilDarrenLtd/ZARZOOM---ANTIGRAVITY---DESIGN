"use client";

import { useI18n } from "@/lib/i18n";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import DynamicSEO from "@/components/DynamicSEO";
import Link from "next/link";
import { Ticket, List, HelpCircle } from "lucide-react";

export default function SupportLandingPage() {
  const { t } = useI18n();

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <DynamicSEO />
      <SiteNavbar />

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <HelpCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            {t("support.landing.title")}
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            {t("support.landing.subtitle")}
          </p>
          <p className="text-gray-500">
            {t("support.landing.description")}
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Create Ticket Card */}
          <Link
            href="/dashboard/support/tickets/new"
            className="bg-white rounded-2xl border-2 border-green-200 shadow-sm p-8 hover:border-green-400 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <Ticket className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                {t("support.landing.createTicketBtn")}
              </h2>
            </div>
            <p className="text-gray-600">
              Submit a new support request with detailed information and screenshots.
            </p>
          </Link>

          {/* My Tickets Card */}
          <Link
            href="/dashboard/support/tickets"
            className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm p-8 hover:border-gray-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <List className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                {t("support.landing.myTicketsBtn")}
              </h2>
            </div>
            <p className="text-gray-600">
              View and manage your existing support tickets and their status.
            </p>
          </Link>
        </div>

        {/* Back Link */}
        <div className="text-center">
          <Link
            href="/dashboard"
            className="text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-2"
          >
            ← {t("support.nav.backToDashboard")}
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  );
}
