"use client";

import { useI18n } from "@/lib/i18n";
import Link from "next/link";

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <h3 className="text-green-500 text-2xl font-bold tracking-tight">
              ZARZOOM
            </h3>
            <p className="mt-2 text-sm text-gray-400">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wide mb-4">
              {t("footer.product")}
            </h4>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/#features"
                  className="text-sm text-gray-400 hover:text-green-400 transition-colors"
                >
                  {t("footer.features")}
                </Link>
              </li>
              <li>
                <Link
                  href="/#pricing"
                  className="text-sm text-gray-400 hover:text-green-400 transition-colors"
                >
                  {t("footer.pricing")}
                </Link>
              </li>
              <li>
                <Link
                  href="/support"
                  className="text-sm text-gray-400 hover:text-green-400 transition-colors"
                >
                  {t("footer.support")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wide mb-4">
              {t("footer.company")}
            </h4>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/#about"
                  className="text-sm text-gray-400 hover:text-green-400 transition-colors"
                >
                  {t("footer.about")}
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-gray-400 hover:text-green-400 transition-colors"
                >
                  {t("footer.contact")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wide mb-4">
              {t("footer.legal")}
            </h4>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-gray-400 hover:text-green-400 transition-colors"
                >
                  {t("footer.privacy")}
                </Link>
              </li>
              <li>
                <Link
                  href="/user-terms"
                  className="text-sm text-gray-400 hover:text-green-400 transition-colors"
                >
                  {t("footer.userTerms")}
                </Link>
              </li>
              <li>
                <Link
                  href="/website-terms"
                  className="text-sm text-gray-400 hover:text-green-400 transition-colors"
                >
                  {t("footer.websiteTerms")}
                </Link>
              </li>
              <li>
                <Link
                  href="/cookies"
                  className="text-sm text-gray-400 hover:text-green-400 transition-colors"
                >
                  {t("footer.cookies")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-800 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} {t("footer.copyright")}
        </div>
      </div>
    </footer>
  );
}
