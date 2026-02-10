"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  Settings,
  Mail,
  KeyRound,
  ShieldAlert,
  ChevronDown,
  LogOut,
  LayoutDashboard,
} from "lucide-react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith("/admin/settings")
  );

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
        .select("is_admin")
        .eq("id", user.id)
        .single();

      setIsAdmin(
        profile?.is_admin === true ||
          user.user_metadata?.is_admin === true
      );
    }
    checkAdmin();
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/admin/settings")) {
      setSettingsOpen(true);
    }
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  // Skip layout for the login page
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (isAdmin === null) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center px-4">
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
    );
  }

  const navItems = [
    {
      href: "/admin",
      label: t("admin.title"),
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: "/admin/users",
      label: t("admin.users"),
      icon: Users,
    },
  ];

  const settingsItems = [
    {
      href: "/admin/settings/email",
      label: t("admin.emailSettings"),
      icon: Mail,
    },
    {
      href: "/admin/settings/oauth",
      label: t("admin.oauthKeys"),
      icon: KeyRound,
    },
  ];

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  const linkClass = (href: string, exact?: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive(href, exact)
        ? "bg-green-50 text-green-700"
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
    }`;

  return (
    <div className="bg-gray-50 min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 hidden md:flex">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-gray-100">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              {t("admin.title")}
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(item.href, item.exact)}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}

          {/* Settings collapsible group */}
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
              pathname.startsWith("/admin/settings")
                ? "bg-green-50 text-green-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="flex-1">{t("admin.settings")}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                settingsOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {settingsOpen && (
            <div className="ml-4 flex flex-col gap-0.5 border-l border-gray-100 pl-3">
              {settingsItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={linkClass(item.href)}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            {t("nav.logout")}
          </button>
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors mt-1"
          >
            Back to site
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
            <ShieldAlert className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
            Admin
          </span>
        </Link>
        <button
          onClick={handleLogout}
          className="text-gray-500 hover:text-red-600 transition-colors"
          aria-label="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-2 py-2 flex justify-around">
        {[...navItems, { href: "/admin/settings/email", label: t("admin.settings"), icon: Settings }].map(
          (item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 text-xs font-medium p-1.5 rounded-lg ${
                isActive(item.href, (item as { exact?: boolean }).exact)
                  ? "text-green-700"
                  : "text-gray-500"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="truncate max-w-[4rem]">{item.label}</span>
            </Link>
          )
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8 md:pt-8 pt-16 pb-20 md:pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}
