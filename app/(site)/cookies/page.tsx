"use client";

import { useI18n } from "@/lib/i18n";

export default function CookiesPage() {
  const { t } = useI18n();

  return (
    <article className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight text-balance">
          {t("pages.cookies.title")}
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          {t("pages.cookies.subtitle")}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          {t("pages.cookies.lastUpdated")}
        </p>
      </header>

      <div className="flex flex-col gap-10">
        {/* Section 1 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            {t("pages.cookies.s1Title")}
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {t("pages.cookies.s1Text")}
          </p>
        </section>

        {/* Section 2: Cookie Types */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {t("pages.cookies.s2Title")}
          </h2>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <h3 className="text-sm font-semibold text-gray-900">
                {t("pages.cookies.s2Essential")}
              </h3>
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
                {t("pages.cookies.s2EssentialText")}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <h3 className="text-sm font-semibold text-gray-900">
                {t("pages.cookies.s2Analytics")}
              </h3>
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
                {t("pages.cookies.s2AnalyticsText")}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <h3 className="text-sm font-semibold text-gray-900">
                {t("pages.cookies.s2Preference")}
              </h3>
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
                {t("pages.cookies.s2PreferenceText")}
              </p>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            {t("pages.cookies.s3Title")}
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {t("pages.cookies.s3Text")}
          </p>
        </section>

        {/* Section 4 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            {t("pages.cookies.s4Title")}
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {t("pages.cookies.s4Text")}
          </p>
        </section>

        {/* Section 5 */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            {t("pages.cookies.s5Title")}
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {t("pages.cookies.s5Text")}
          </p>
        </section>
      </div>
    </article>
  );
}
