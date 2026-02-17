"use client";

import { useI18n } from "@/lib/i18n";
import { GOAL_OPTIONS } from "@/lib/validation/onboarding";
import type { OnboardingUpdate, Goal } from "@/lib/validation/onboarding";
import {
  Globe,
  Users,
  ShoppingBag,
  TrendingUp,
  Award,
  Search,
  BookOpen,
  Share2,
} from "lucide-react";

interface Step3Props {
  data: OnboardingUpdate;
  onChange: (patch: Partial<OnboardingUpdate>) => void;
}

const GOAL_ICONS: Record<Goal, React.ReactNode> = {
  increase_website_traffic: <Globe className="w-5 h-5" />,
  get_more_subscribers_leads: <Users className="w-5 h-5" />,
  promote_product_or_service: <ShoppingBag className="w-5 h-5" />,
  increase_sales: <TrendingUp className="w-5 h-5" />,
  build_brand_authority: <Award className="w-5 h-5" />,
  improve_seo: <Search className="w-5 h-5" />,
  educate_audience: <BookOpen className="w-5 h-5" />,
  generate_social_content: <Share2 className="w-5 h-5" />,
};

export default function Step3Goals({ data, onChange }: Step3Props) {
  const { t } = useI18n();

  const inputClass =
    "w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors text-sm";

  const goals = data.goals ?? [];

  function toggleGoal(goal: Goal) {
    if (goals.includes(goal)) {
      onChange({ goals: goals.filter((g) => g !== goal) });
    } else {
      onChange({ goals: [...goals, goal] });
    }
  }

  const needsWebsite =
    goals.includes("increase_website_traffic") ||
    goals.includes("get_more_subscribers_leads");

  const needsProduct =
    goals.includes("promote_product_or_service") ||
    goals.includes("increase_sales");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {t("onboarding.step3.title")}
        </h2>
        <p className="text-gray-500 text-sm mt-1 leading-relaxed">
          {t("onboarding.step3.subtitle")}
        </p>
      </div>

      {/* Goals grid */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          {t("onboarding.step3.goals.label")}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GOAL_OPTIONS.map((goal) => {
            const isSelected = goals.includes(goal);
            return (
              <button
                key={goal}
                type="button"
                onClick={() => toggleGoal(goal)}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-green-500 bg-green-50 ring-1 ring-green-500/20"
                    : "border-gray-200 bg-white hover:border-green-300"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {GOAL_ICONS[goal]}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isSelected ? "text-green-700" : "text-gray-700"
                  }`}
                >
                  {t(`onboarding.step3.goals.options.${goal}`)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {t("onboarding.step3.goals.help")}
        </p>
      </div>

      {/* Conditional: Website URL */}
      {needsWebsite && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {t("onboarding.step3.websiteUrl.label")}
          </label>
          <input
            type="url"
            value={data.website_or_landing_url ?? ""}
            onChange={(e) =>
              onChange({ website_or_landing_url: e.target.value || null })
            }
            className={inputClass}
            placeholder={t("onboarding.step3.websiteUrl.placeholder")}
          />
          <p className="text-xs text-gray-400 mt-1">
            {t("onboarding.step3.websiteUrl.help")}
          </p>
        </div>
      )}

      {/* Conditional: Product URL */}
      {needsProduct && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {t("onboarding.step3.productUrl.label")}
          </label>
          <input
            type="url"
            value={data.product_or_sales_url ?? ""}
            onChange={(e) =>
              onChange({ product_or_sales_url: e.target.value || null })
            }
            className={inputClass}
            placeholder={t("onboarding.step3.productUrl.placeholder")}
          />
          <p className="text-xs text-gray-400 mt-1">
            {t("onboarding.step3.productUrl.help")}
          </p>
        </div>
      )}
    </div>
  );
}
