"use client";

import { useI18n } from "@/lib/i18n";

export default function TermsUserPage() {
  const { t } = useI18n();

  const sections = [
    { title: t("pages.termsUser.s1Title"), text: t("pages.termsUser.s1Text") },
    { title: t("pages.termsUser.s2Title"), text: t("pages.termsUser.s2Text") },
    { title: t("pages.termsUser.s3Title"), text: t("pages.termsUser.s3Text") },
    { title: t("pages.termsUser.s4Title"), text: t("pages.termsUser.s4Text") },
    { title: t("pages.termsUser.s5Title"), text: t("pages.termsUser.s5Text") },
    { title: t("pages.termsUser.s6Title"), text: t("pages.termsUser.s6Text") },
    { title: t("pages.termsUser.s7Title"), text: t("pages.termsUser.s7Text") },
  ];

  return (
    <article className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight text-balance">
          {t("pages.termsUser.title")}
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          {t("pages.termsUser.subtitle")}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          {t("pages.termsUser.lastUpdated")}
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
