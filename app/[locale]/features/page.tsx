"use client";

import SiteNavbar from "@/components/SiteNavbar";
import Image from "next/image";
import {
  Sparkles,
  Calendar,
  Network,
  BarChart3,
  FolderOpen,
  Plug,
  HeadphonesIcon,
  Check,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

const FEATURE_KEYS = [
  "aiContent",
  "smartScheduling",
  "multiPlatform",
  "analytics",
  "contentLibrary",
  "openClawIntegration",
  "support",
] as const;

const FEATURE_ICONS = [
  Sparkles,
  Calendar,
  Network,
  BarChart3,
  FolderOpen,
  Plug,
  HeadphonesIcon,
] as const;

const FEATURE_IMAGES = [
  "/images/features/ai-content.jpg",
  "/images/features/smart-scheduling.jpg",
  "/images/features/multi-platform.jpg",
  "/images/features/analytics.jpg",
  "/images/features/content-library.jpg",
  "/images/features/integrations.jpg",
  "/images/features/support.jpg",
];

export default function FeaturesPage() {
  const { t } = useI18n();

  return (
    <>
      <SiteNavbar />
      <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center mb-20">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl mb-6 text-balance">
              {t("pages.features.hero.title")}
            </h1>
            <p className="mt-4 text-lg text-gray-600 max-w-4xl mx-auto text-balance">
              {t("pages.features.hero.subtitle")}
            </p>
          </div>

          {/* Features Grid */}
          <div className="space-y-16 mb-20">
            {FEATURE_KEYS.map((key, index) => {
              const Icon = FEATURE_ICONS[index];
              const isEven = index % 2 === 0;
              const title = t(`pages.features.${key}.title`);
              const description = t(`pages.features.${key}.description`);
              const features: string[] = [];
              for (let i = 0; ; i++) {
                const v = t(`pages.features.${key}.features.${i}`);
                if (!v || v === `pages.features.${key}.features.${i}`) break;
                features.push(v);
              }

              return (
                <div
                  key={key}
                  className={`bg-white rounded-3xl shadow-lg overflow-hidden border border-gray-100 ${
                    isEven ? "md:flex-row" : "md:flex-row-reverse"
                  } flex flex-col md:flex`}
                >
                  <div className="flex-1 p-8 md:p-12 flex flex-col justify-center">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-green-700" />
                      </div>
                      <h2 className="text-xl font-bold text-gray-900 text-balance">
                        {title}
                      </h2>
                    </div>

                    <p className="text-lg text-gray-600 leading-relaxed mb-6">
                      {description}
                    </p>

                    <div className="grid gap-3">
                      {features.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-4 h-4 text-green-600" />
                          </div>
                          <span className="text-gray-700 font-medium">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-8 md:p-12">
                    <div
                      className={`relative aspect-square w-full max-w-md rounded-3xl overflow-hidden shadow-lg ${
                        index < 7
                          ? "ring-2 ring-green-500 shadow-green-500/30"
                          : "border border-gray-200 shadow-sm"
                      }`}
                    >
                      <Image
                        src={FEATURE_IMAGES[index]}
                        alt={title}
                        fill
                        className={
                          index < 7 ? "object-cover" : "object-contain p-10"
                        }
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority={index < 2}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA Section */}
          <section>
            <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-3xl p-8 md:p-12 text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">
                {t("pages.features.cta.title")}
              </h2>
              <p className="text-lg text-green-50 mb-8 max-w-2xl mx-auto">
                {t("pages.features.cta.description")}
              </p>
              <Link
                href="/login-launch"
                className="inline-flex items-center gap-2 bg-white text-green-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors shadow-lg"
              >
                {t("pages.features.cta.button")}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
