"use client";

import { useI18n } from "@/lib/i18n";

export default function TermsWebsitePage() {
  const { t } = useI18n();

  const sections = [
    { title: t("pages.termsWebsite.s1Title"), text: t("pages.termsWebsite.s1Text") },
    { title: t("pages.termsWebsite.s2Title"), text: t("pages.termsWebsite.s2Text") },
    { title: t("pages.termsWebsite.s3Title"), text: t("pages.termsWebsite.s3Text") },
    { title: t("pages.termsWebsite.s4Title"), text: t("pages.termsWebsite.s4Text") },
    { title: t("pages.termsWebsite.s5Title"), text: t("pages.termsWebsite.s5Text") },
  ];

  return (
    <article className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight text-balance">
          {t("pages.termsWebsite.title")}
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          {t("pages.termsWebsite.subtitle")}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          {t("pages.termsWebsite.lastUpdated")}
        </p>
      </header>

      <div className="flex flex-col gap-10">
        {sections.map((section, i) => (
          <section key={i}>
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              {section.title}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {section.text}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}
