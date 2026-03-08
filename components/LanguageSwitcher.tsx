"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n, languages } from "@/lib/i18n";
import { ROUTED_LOCALES, type RoutedLocale } from "@/lib/i18n/routing";

const MOBILE_BREAKPOINT = 640;

export default function LanguageSwitcher() {
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT
  );
  const [mobileDropdownRect, setMobileDropdownRect] = useState<{
    bottom: number;
    left: number;
    right: number;
    maxHeight: number;
  } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isOnLocaleRoute = ROUTED_LOCALES.some((code) => pathname === `/${code}` || pathname.startsWith(`/${code}/`));
  const options = languages;
  const currentLang = options.find((l) => l.code === locale) ?? options[0];

  const updateMobileRect = useCallback(() => {
    if (!open || typeof window === "undefined") {
      setMobileDropdownRect(null);
      return;
    }
    if (window.innerWidth >= MOBILE_BREAKPOINT) {
      setMobileDropdownRect(null);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const padding = 8;
    // Position above the trigger so dropdown opens upward and stays on screen
    const spaceAbove = rect.top - padding;
    const maxHeight = Math.min(288, Math.max(120, spaceAbove));
    setMobileDropdownRect({
      bottom: window.innerHeight - rect.top + 4,
      left: padding,
      right: padding,
      maxHeight,
    });
  }, [open]);

  useLayoutEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      updateMobileRect();
    };
    setIsMobile(typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT);
    updateMobileRect();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateMobileRect]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      const el = target as Element;
      if (el.nodeType === 1 && el.closest?.("[data-language-dropdown]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (code: string) => {
    setLocale(code);
    setOpen(false);
    if (isOnLocaleRoute && ROUTED_LOCALES.includes(code as RoutedLocale)) {
      const match = pathname.match(/^\/[a-z]{2}(\/.*)?$/);
      const pathWithoutLocale = match ? (match[1] ?? "") : pathname;
      router.push(`/${code}${pathWithoutLocale || ""}`);
    }
  };

  const dropdownContent = open && (
    <AnimatePresence>
      <motion.div
        data-language-dropdown
        initial={{ opacity: 0, y: isMobile ? 8 : -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: isMobile ? 8 : -8 }}
        transition={{ duration: 0.15 }}
        className={
          mobileDropdownRect
            ? "fixed w-[calc(100vw-1rem)] max-w-52 overflow-y-auto bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-100"
            : "absolute right-0 top-full mt-2 w-52 max-h-72 overflow-y-auto bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-100 z-50"
        }
        style={
          mobileDropdownRect
            ? {
                bottom: mobileDropdownRect.bottom,
                left: mobileDropdownRect.left,
                right: mobileDropdownRect.right,
                maxHeight: mobileDropdownRect.maxHeight,
                zIndex: 9999,
              }
            : undefined
        }
      >
        <div className="py-1">
          {options.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                lang.code === locale
                  ? "bg-green-50 text-green-700 font-semibold"
                  : "text-green-600 hover:bg-green-50 hover:text-green-700"
              }`}
            >
              {lang.nativeName}
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-green-600 text-green-600 text-xs font-semibold hover:bg-green-50 transition-colors uppercase tracking-wide"
        aria-label={t("nav.selectLanguage")}
      >
        <span>{currentLang?.nativeName ?? "English"}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (isMobile && mobileDropdownRect && typeof document !== "undefined"
        ? createPortal(dropdownContent, document.body)
        : !isMobile
          ? dropdownContent
          : null)}
    </div>
  );
}
