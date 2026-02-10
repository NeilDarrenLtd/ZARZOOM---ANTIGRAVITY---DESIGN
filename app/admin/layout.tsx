"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Settings, Globe, ShieldAlert } from "lucide-react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setIsAdmin(profile?.role === "admin");
    }
    checkAdmin();
  }, []);

  if (isAdmin === null) {
    return (
      <main className="bg-gray-50 min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center pt-20">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
        <Footer />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="bg-gray-50 min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center pt-20 px-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900">
              {t("admin.accessDenied")}
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              {t("admin.accessDeniedMessage")}
            </p>
            <Link
              href="/"
              className="mt-6 inline-block bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              {t("auth.backToLogin")}
            </Link>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  const navItems = [
    {
      href: "/admin/users",
      label: t("admin.users"),
      icon: Users,
    },
    {
      href: "/admin/settings",
      label: t("admin.settings"),
      icon: Settings,
    },
    {
      href: "/admin/languages",
      label: t("admin.languages"),
      icon: Globe,
    },
  ];

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex pt-20">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 p-4 flex-shrink-0 hidden md:block">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide px-3 mb-4">
            {t("admin.title")}
          </h2>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-green-50 text-green-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile nav */}
        <div className="md:hidden fixed bottom-16 left-0 right-0 z-40 bg-white border-t border-gray-200 px-4 py-2 flex justify-around">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 text-xs font-medium p-2 ${
                  isActive ? "text-green-700" : "text-gray-500"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto">{children}</div>
      </div>
      <Footer />
    </main>
  );
}
