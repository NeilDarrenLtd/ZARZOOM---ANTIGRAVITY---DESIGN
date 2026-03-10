"use client";

import { CalendarCheck2, CheckCircle2, AlertCircle, Zap } from "lucide-react";

interface MetricTile {
  icon: React.ElementType;
  title: string;
  value: number;
  subtitle: string;
  accent: "green" | "teal" | "amber" | "neutral";
}

const TILES: MetricTile[] = [
  {
    icon: CalendarCheck2,
    title: "Planned Posts",
    value: 13,
    subtitle: "Scheduled this month",
    accent: "neutral",
  },
  {
    icon: CheckCircle2,
    title: "Ready to Post",
    value: 5,
    subtitle: "Fully prepared & approved",
    accent: "green",
  },
  {
    icon: AlertCircle,
    title: "Needs Review",
    value: 4,
    subtitle: "Awaiting edits or sign-off",
    accent: "amber",
  },
  {
    icon: Zap,
    title: "Strong Viral Potential",
    value: 3,
    subtitle: "Predicted top performers",
    accent: "teal",
  },
];

const ACCENT_STYLES: Record<MetricTile["accent"], {
  card: string;
  icon: string;
  iconBg: string;
  value: string;
}> = {
  green: {
    card: "hover:border-green-200 hover:shadow-green-50",
    icon: "text-green-600",
    iconBg: "bg-green-50",
    value: "text-green-700",
  },
  teal: {
    card: "hover:border-teal-200 hover:shadow-teal-50",
    icon: "text-teal-600",
    iconBg: "bg-teal-50",
    value: "text-teal-700",
  },
  amber: {
    card: "hover:border-amber-200 hover:shadow-amber-50",
    icon: "text-amber-600",
    iconBg: "bg-amber-50",
    value: "text-amber-700",
  },
  neutral: {
    card: "hover:border-gray-200 hover:shadow-gray-100",
    icon: "text-gray-500",
    iconBg: "bg-gray-100",
    value: "text-gray-900",
  },
};

export default function PlannerSummaryStrip() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
      {TILES.map((tile) => {
        const styles = ACCENT_STYLES[tile.accent];
        const Icon = tile.icon;
        return (
          <div
            key={tile.title}
            className={`
              bg-white rounded-2xl border border-gray-100 px-5 py-4
              shadow-sm hover:shadow-md transition-all duration-200 cursor-default
              ${styles.card}
            `}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${styles.iconBg}`}>
                <Icon className={`w-4.5 h-4.5 ${styles.icon}`} style={{ width: 18, height: 18 }} />
              </div>
            </div>
            <p className={`text-2xl font-bold leading-none mb-1 ${styles.value}`}>
              {tile.value}
            </p>
            <p className="text-sm font-semibold text-gray-700 leading-snug mb-0.5">
              {tile.title}
            </p>
            <p className="text-xs text-gray-400 leading-relaxed">
              {tile.subtitle}
            </p>
          </div>
        );
      })}
    </div>
  );
}
