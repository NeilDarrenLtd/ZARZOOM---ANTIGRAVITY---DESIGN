"use client";

import { useI18n } from "@/lib/i18n";
import { Mail } from "lucide-react";

export default function SupportPage() {
  const { t } = useI18n();

  const faqs = [
    { q: t("pages.support.faq1q"), a: t("pages.support.faq1a") },
    { q: t("pages.support.faq2q"), a: t("pages.support.faq2a") },
    { q: t("pages.support.faq3q"), a: t("pages.support.faq3a") },
    { q: t("pages.support.faq4q"), a: t("pages.support.faq4a") },
  ];

  return (
    <article className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight text-balance">
          {t("pages.support.title")}
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          {t("pages.support.subtitle")}
        </p>
      </header>

      <section className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">
          {t("pages.support.faqTitle")}
        </h2>
        <div className="flex flex-col gap-6">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-gray-50 p-6"
            >
              <h3 className="text-base font-semibold text-gray-900">
                {faq.q}
              </h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {t("pages.support.contactTitle")}
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          {t("pages.support.contactText")}
        </p>
        <a
          href={`mailto:${t("pages.support.contactEmail")}`}
          className="inline-flex items-center gap-2 bg-green-600 text-white font-bold text-sm px-6 py-3 rounded-full hover:bg-green-700 transition-colors"
        >
          <Mail className="w-4 h-4" />
          {t("pages.support.contactEmail")}
        </a>
      </section>
    </article>
  );
}
