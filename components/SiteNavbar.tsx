"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SiteNavbar() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSubMenuOpen, setDesktopSubMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const subMenuRef = useRef<HTMLDivElement>(null);

  // Check authentication status on mount
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      setIsLoading(false);
    }
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const navLinks = isLoggedIn
    ? [
        { labelKey: "nav.pricing", href: "/#pricing" },
        { labelKey: "nav.support", href: "/support" },
        { labelKey: "nav.contact", href: "/#contact" },
      ]
    : [
        { labelKey: "nav.about", href: "/#about" },
        { labelKey: "nav.features", href: "/#features" },
        { labelKey: "nav.pricing", href: "/#pricing" },
        { labelKey: "nav.contact", href: "/#contact" },
      ];

  const subMenuLinks = [
    { labelKey: "nav.userTerms", href: "/terms-user" },
    { labelKey: "nav.websiteTerms", href: "/terms-website" },
    { labelKey: "nav.privacy", href: "/privacy" },
    { labelKey: "nav.cookies", href: "/cookies" },
  ];

  const isOnDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  const getTopRightButton = () => {
    if (isLoading) {
      return null;
    }

    if (isOnDashboard && isLoggedIn) {
      return {
        label: "LOGOUT",
        onClick: async () => {
          await supabase.auth.signOut();
          router.push("/");
        },
        href: null,
      };
    }

    if (isLoggedIn) {
      return {
        label: "DASHBOARD",
        onClick: null,
        href: "/dashboard",
      };
    }

    return {
      label: "LOGIN-LAUNCH",
      onClick: null,
      href: "/auth",
    };
  };

  const topRightButton = getTopRightButton();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        subMenuRef.current &&
        !subMenuRef.current.contains(event.target as Node)
      ) {
        setDesktopSubMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-md">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <img
              src="/images/zarzoom-logo-v4.png"
              alt="ZARZOOM - Autopilot Your Socials in Seconds"
              className="h-10 md:h-14 w-auto rounded-md"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.labelKey}
                href={link.href}
                className="text-sm font-semibold tracking-wide uppercase transition-colors duration-200 text-green-600 hover:text-green-700"
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </div>

          {/* Desktop Right Side: Language + CTA + Submenu */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />

            {topRightButton && (
              topRightButton.onClick ? (
                <button
                  onClick={topRightButton.onClick}
                  className="bg-green-600 text-white text-sm font-bold px-6 py-2.5 rounded-full hover:bg-green-700 transition-colors duration-200 tracking-wide uppercase"
                >
                  {topRightButton.label}
                </button>
              ) : (
                <Link
                  href={topRightButton.href || "/auth"}
                  className="bg-green-600 text-white text-sm font-bold px-6 py-2.5 rounded-full hover:bg-green-700 transition-colors duration-200 tracking-wide uppercase"
                >
                  {topRightButton.label}
                </Link>
              )
            )}

            {/* Desktop 3-line submenu toggle */}
            <div ref={subMenuRef} className="relative">
              <button
                onClick={() => setDesktopSubMenuOpen(!desktopSubMenuOpen)}
                className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                aria-label={desktopSubMenuOpen ? "Close submenu" : "Open submenu"}
              >
                {desktopSubMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>

              <AnimatePresence>
                {desktopSubMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-100 overflow-hidden"
                  >
                    <div className="py-2">
                      {subMenuLinks.map((link) => (
                        <Link
                          key={link.labelKey}
                          href={link.href}
                          onClick={() => setDesktopSubMenuOpen(false)}
                          className="block px-4 py-2.5 text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors"
                        >
                          {t(link.labelKey)}
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg transition-colors text-green-600 hover:bg-green-50"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-white/95 backdrop-blur-md border-t border-gray-100 overflow-hidden"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.labelKey}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-green-600 hover:text-green-700 hover:bg-green-50 font-semibold text-sm tracking-wide uppercase px-4 py-3 rounded-lg transition-colors"
                >
                  {t(link.labelKey)}
                </Link>
              ))}

              <div className="my-2 mx-4 border-t border-green-600/20" />

              {subMenuLinks.map((link) => (
                <Link
                  key={link.labelKey}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-green-600/70 hover:text-green-700 hover:bg-green-50 font-medium text-xs tracking-wide uppercase px-4 py-2.5 rounded-lg transition-colors"
                >
                  {t(link.labelKey)}
                </Link>
              ))}

              <div className="my-2 mx-4 border-t border-green-600/20" />

              <div className="px-4 pb-1">
                <LanguageSwitcher />
              </div>

              <div className="pt-2 px-4">
                {topRightButton && (
                  topRightButton.onClick ? (
                    <button
                      onClick={topRightButton.onClick}
                      className="block w-full bg-green-600 text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-green-700 transition-colors text-center tracking-wide uppercase"
                    >
                      {topRightButton.label}
                    </button>
                  ) : (
                    <Link
                      href={topRightButton.href || "/auth"}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full bg-green-600 text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-green-700 transition-colors text-center tracking-wide uppercase"
                    >
                      {topRightButton.label}
                    </Link>
                  )
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
