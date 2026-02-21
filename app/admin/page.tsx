"use client";

import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { Mail, KeyRound, Users, CreditCard, HelpCircle, Sparkles } from "lucide-react";

export default function AdminDashboardPage() {
  const { t } = useI18n();

  const cards = [
    {
      href: "/admin/users",
      icon: Users,
      title: t("admin.userManagement"),
      description: "View and manage platform users and roles.",
      color: "bg-blue-50 text-blue-600",
    },
    {
      href: "/admin/support",
      icon: HelpCircle,
      title: t("admin.supportManagement"),
      description: t("admin.supportManagementDesc"),
      color: "bg-green-50 text-green-600",
    },
    {
      href: "/admin/settings/email",
      icon: Mail,
      title: t("admin.emailSettings"),
      description: t("admin.emailSettingsDesc"),
      color: "bg-amber-50 text-amber-600",
    },
    {
      href: "/admin/settings/oauth",
      icon: KeyRound,
      title: t("admin.oauthKeys"),
      description: t("admin.oauthSettingsDesc"),
      color: "bg-violet-50 text-violet-600",
    },
    {
      href: "/admin/settings/openrouter-prompts",
      icon: Sparkles,
      title: "OpenRouter Prompts",
      description: "Configure AI prompts, API key, and model for wizard auto-fill.",
      color: "bg-pink-50 text-pink-600",
    },
    {
      href: "/admin/billing",
      icon: CreditCard,
      title: t("billing.admin.title"),
      description: t("billing.admin.subtitle"),
      color: "bg-purple-50 text-purple-600",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("admin.settingsDashboard")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("admin.manageSettings")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-green-300 hover:shadow-sm transition-all group"
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${card.color}`}
            >
              <card.icon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 group-hover:text-green-700 transition-colors">
              {card.title}
            </h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {card.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
