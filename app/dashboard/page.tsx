"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import DynamicSEO from "@/components/DynamicSEO";
import Link from "next/link";
import { User, Settings, Link2, Rocket, LogOut, RotateCcw } from "lucide-react";

export default function DashboardPage() {
  const { t } = useI18n();
  const [user, setUser] = useState<{ email?: string; created_at?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser({ email: user.email, created_at: user.created_at });
      }
      setLoading(false);
    }
    getUser();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function handleRestartOnboarding() {
    setRestarting(true);
    try {
      const res = await fetch("/api/v1/onboarding/restart", { method: "POST" });
      if (res.ok) {
        window.location.href = "/onboarding";
      } else {
        setRestarting(false);
      }
    } catch {
      setRestarting(false);
    }
  }

  if (loading) {
    return (
      <main className="bg-gray-50 min-h-screen flex flex-col">
        <SiteNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <DynamicSEO />
      <SiteNavbar />

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">
        {/* Welcome header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t("dashboard.title")}
            </h1>
            <p className="text-gray-500 mt-1">
              {t("dashboard.welcome")},{" "}
              <span className="text-green-600 font-medium">
                {user?.email ?? ""}
              </span>
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t("nav.logout")}
          </button>
        </div>

        {/* Dashboard cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Overview card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Rocket className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {t("dashboard.overview")}
              </h2>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {t("dashboard.comingSoon")}
            </p>
          </div>

          {/* Account settings card */}
          <Link
            href="/dashboard/profile"
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:border-green-300 hover:shadow-md transition-all block"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Settings className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {t("dashboard.profile")}
              </h2>
            </div>
            <div className="flex flex-col gap-2 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>{user?.email}</span>
              </div>
              {user?.created_at && (
                <p>
                  {t("dashboard.memberSince")}{" "}
                  {new Date(user.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </Link>

          {/* Connected accounts card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Link2 className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">
                {t("dashboard.connectedAccounts")}
              </h2>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {t("dashboard.comingSoon")}
            </p>
          </div>
        </div>

        {/* Quick links */}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={handleRestartOnboarding}
            disabled={restarting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${restarting ? "animate-spin" : ""}`} />
            {restarting ? "Restarting..." : "Restart Setup"}
          </button>
          <Link
            href="/support"
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
          >
            {t("nav.support")}
          </Link>
          <Link
            href="/privacy"
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
          >
            {t("nav.privacy")}
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  );
}
