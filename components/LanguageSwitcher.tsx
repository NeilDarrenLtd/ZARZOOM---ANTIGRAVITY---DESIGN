"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n, languages } from "@/lib/i18n";
import { ROUTED_LOCALES } from "@/lib/i18n/routing";

export default function LanguageSwitcher() {
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isOnLocaleRoute = ROUTED_LOCALES.some((code) => pathname === `/${code}` || pathname.startsWith(`/${code}/`));
  const routedLangs = languages.filter((l) => ROUTED_LOCALES.includes(l.code as "en" | "fr"));
  const options = isOnLocaleRoute ? routedLangs : languages;
  const currentLang = options.find((l) => l.code === locale) ?? options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (code: string) => {
    setLocale(code);
    setOpen(false);
    if (isOnLocaleRoute) {
      const match = pathname.match(/^\/[a-z]{2}(\/.*)?$/);
      const pathWithoutLocale = match ? (match[1] ?? "") : pathname;
      router.push(`/${code}${pathWithoutLocale || ""}`);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-green-600 text-green-600 text-xs font-semibold hover:bg-green-50 transition-colors uppercase tracking-wide"
        aria-label={t("nav.selectLanguage")}
      >
        <span>{currentLang?.nativeName ?? "English"}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-52 max-h-72 overflow-y-auto bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-100 z-50"
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
        )}
      </AnimatePresence>
    </div>
  );
}
