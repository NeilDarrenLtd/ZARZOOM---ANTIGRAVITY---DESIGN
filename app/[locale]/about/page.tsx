"use client";

import SiteNavbar from "@/components/SiteNavbar";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Lightbulb,
  Rocket,
  Zap,
  CalendarCheck,
  Bot,
  Clock,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/* ─── Animation variants ─────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

/* ─── Network illustration (light-themed) ───────────────────────── */
function NetworkIllustration() {
  return (
    <svg
      viewBox="0 0 480 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#dcfce7" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f0fdf4" stopOpacity="0" />
        </radialGradient>
        <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#16a34a" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Background wash */}
      <ellipse cx="240" cy="180" rx="200" ry="155" fill="url(#bgGlow)" />

      {/* Connection lines */}
      <line x1="240" y1="180" x2="80"  y2="80"  stroke="#16a34a" strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="4 4" />
      <line x1="240" y1="180" x2="400" y2="80"  stroke="#16a34a" strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="4 4" />
      <line x1="240" y1="180" x2="60"  y2="265" stroke="#16a34a" strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="4 4" />
      <line x1="240" y1="180" x2="420" y2="265" stroke="#16a34a" strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="4 4" />
      <line x1="240" y1="180" x2="240" y2="38"  stroke="#16a34a" strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="4 4" />
      <line x1="240" y1="180" x2="240" y2="322" stroke="#16a34a" strokeWidth="1.5" strokeOpacity="0.2" strokeDasharray="4 4" />
      <line x1="80"  y1="80"  x2="400" y2="80"  stroke="#16a34a" strokeWidth="0.75" strokeOpacity="0.15" />
      <line x1="60"  y1="265" x2="420" y2="265" stroke="#16a34a" strokeWidth="0.75" strokeOpacity="0.15" />

      {/* Outer nodes */}
      {[
        { cx: 80,  cy: 80,  label: "TW" },
        { cx: 400, cy: 80,  label: "IG" },
        { cx: 60,  cy: 265, label: "LI" },
        { cx: 420, cy: 265, label: "FB" },
        { cx: 240, cy: 38,  label: "YT" },
        { cx: 240, cy: 322, label: "TK" },
      ].map(({ cx, cy, label }) => (
        <g key={label} filter="url(#nodeShadow)">
          <circle cx={cx} cy={cy} r={18} fill="white" stroke="#16a34a" strokeWidth="1.5" />
          <text x={cx} y={cy + 4} fill="#16a34a" fontSize="9" fontFamily="monospace" fontWeight="700" textAnchor="middle">
            {label}
          </text>
        </g>
      ))}

      {/* Central hub rings */}
      <circle cx="240" cy="180" r="50" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1.5" />
      <circle cx="240" cy="180" r="36" fill="#dcfce7" stroke="#86efac" strokeWidth="1.5" />
      <circle cx="240" cy="180" r="22" fill="#16a34a" filter="url(#nodeShadow)" />
      <text x="240" y="185" fill="white" fontSize="10" fontFamily="monospace" fontWeight="800" textAnchor="middle">
        AI
      </text>
    </svg>
  );
}

const STORY_ICONS = [Lightbulb, Rocket, Zap] as const;
const HELP_ICONS = [Bot, CalendarCheck, TrendingUp, Clock] as const;

/* ─── Page ───────────────────────────────────────────────────────── */
export default function AboutPage() {
  const { t } = useI18n();

  const storySteps = [0, 1, 2].map((i) => ({
    icon: STORY_ICONS[i],
    title: t(`pages.about.storySteps.${i}.title`),
    text: t(`pages.about.storySteps.${i}.text`),
  }));

  const helpCards = [0, 1, 2, 3].map((i) => {
    const bullets: string[] = [];
    for (let j = 0; ; j++) {
      const v = t(`pages.about.helpCards.${i}.bullets.${j}`);
      if (!v || v === `pages.about.helpCards.${i}.bullets.${j}`) break;
      bullets.push(v);
    }
    return {
      icon: HELP_ICONS[i],
      title: t(`pages.about.helpCards.${i}.title`),
      text: t(`pages.about.helpCards.${i}.text`),
      bullets,
    };
  });

  return (
    <>
      <SiteNavbar />
      <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">

        {/* ── 1. HERO ──────────────────────────────────────────────── */}
        <section className="pt-28 pb-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

              {/* Left: Copy */}
              <div className="flex-1">
                <motion.div
                  initial="hidden"
                  animate="visible"
                  custom={0}
                  variants={fadeUp}
                  className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6"
                >
                  <Sparkles className="w-3 h-3" />
                  {t("pages.about.badge")}
                </motion.div>

                <motion.h1
                  initial="hidden"
                  animate="visible"
                  custom={1}
                  variants={fadeUp}
                  className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-gray-900 text-balance mb-6"
                >
                  {t("pages.about.heroTitle")}{" "}
                  <span className="text-green-600">{t("pages.about.heroTitleHighlight")}</span>
                </motion.h1>

                <motion.p
                  initial="hidden"
                  animate="visible"
                  custom={2}
                  variants={fadeUp}
                  className="text-lg text-gray-600 leading-relaxed text-pretty mb-8 max-w-lg"
                >
                  {t("pages.about.heroDescription")}
                </motion.p>

                <motion.div
                  initial="hidden"
                  animate="visible"
                  custom={3}
                  variants={fadeUp}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <Link
                    href="/login-launch"
                    className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl transition-colors duration-200 text-base shadow-lg shadow-green-200"
                  >
                    {t("pages.about.getStartedFree")}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/features"
                    className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold px-7 py-3.5 rounded-xl transition-colors duration-200 text-base border border-gray-200 shadow-sm"
                  >
                    {t("pages.about.viewFeatures")}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              </div>

              {/* Right: Network illustration */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="flex-1 w-full max-w-md lg:max-w-none"
              >
                <div className="relative bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden aspect-square max-w-md mx-auto p-6">
                  <NetworkIllustration />
                  {/* Live badge */}
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600" />
                    </span>
                    {t("pages.about.autopilotActive")}
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </section>

        {/* ── 2. OUR MISSION ───────────────────────────────────────── */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden flex flex-col md:flex-row">

              {/* Left: Text */}
              <div className="flex-1 p-8 md:p-14 flex flex-col justify-center">
                <motion.div
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-80px" }}
                  variants={{ hidden: {}, visible: {} }}
                >
                  <motion.p custom={0} variants={fadeUp} className="text-green-600 text-xs font-semibold uppercase tracking-widest mb-3">
                    {t("pages.about.mission.title")}
                  </motion.p>
                  <motion.h2 custom={1} variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-gray-900 text-balance mb-5">
                    {t("pages.about.mission.subtitle")}
                  </motion.h2>
                  <motion.p custom={2} variants={fadeUp} className="text-gray-600 leading-relaxed mb-4 text-pretty">
                    {t("pages.about.mission.para1")}
                  </motion.p>
                  <motion.p custom={3} variants={fadeUp} className="text-gray-600 leading-relaxed mb-4 text-pretty">
                    {t("pages.about.mission.para2")}
                  </motion.p>
                  <motion.p custom={4} variants={fadeUp} className="text-gray-700 font-medium leading-relaxed text-pretty">
                    {t("pages.about.mission.para3")}
                  </motion.p>
                </motion.div>
              </div>

              {/* Right: Visual panel */}
              <div className="flex-1 bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-8 md:p-14 min-h-[320px]">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full max-w-sm space-y-3"
                >
                  {[
                    { label: t("pages.about.missionStats.contentCreated"), value: "1,240 posts", pct: 88 },
                    { label: t("pages.about.missionStats.hoursSaved"), value: "620 hrs", pct: 74 },
                    { label: t("pages.about.missionStats.platformsActive"), value: "6 networks", pct: 100 },
                  ].map((row, i) => (
                    <motion.div
                      key={row.label}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.12, duration: 0.5 }}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{row.label}</span>
                        <span className="text-sm font-bold text-green-600">{row.value}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${row.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.12 + 0.3, duration: 0.7, ease: "easeOut" }}
                          className="h-full bg-green-500 rounded-full"
                        />
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>

            </div>
          </div>
        </section>

        {/* ── 3. OUR STORY ─────────────────────────────────────────── */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              custom={0}
              variants={fadeUp}
              className="text-center mb-14"
            >
              <p className="text-green-600 text-xs font-semibold uppercase tracking-widest mb-3">
                {t("pages.about.story.sectionTitle")}
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-balance max-w-2xl mx-auto">
                {t("pages.about.story.heading")}
              </h2>
            </motion.div>

            {/* Timeline cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {storySteps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.title}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-60px" }}
                    custom={i}
                    variants={fadeUp}
                    className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 flex flex-col gap-5"
                  >
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-green-700" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                      <p className="text-gray-600 text-sm leading-relaxed">{step.text}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Story paragraph card */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              custom={0}
              variants={fadeUp}
              className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 md:p-12 max-w-4xl mx-auto"
            >
              <p className="text-gray-600 leading-relaxed mb-4 text-pretty">
                {t("pages.about.story.para1")}
              </p>
              <p className="text-gray-600 leading-relaxed mb-4 text-pretty">
                {t("pages.about.story.para2")}
              </p>
              <p className="text-gray-700 font-medium leading-relaxed text-pretty">
                {t("pages.about.story.para3")}
              </p>
            </motion.div>
          </div>
        </section>

        {/* ── 4. HOW ZARZOOM HELPS ─────────────────────────────────── */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              custom={0}
              variants={fadeUp}
              className="text-center mb-14"
            >
              <p className="text-green-600 text-xs font-semibold uppercase tracking-widest mb-3">
                {t("pages.about.platform.badge")}
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-balance max-w-2xl mx-auto">
                {t("pages.about.platform.heading")}
              </h2>
            </motion.div>

            <div className="grid sm:grid-cols-2 gap-6">
              {helpCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.title}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-60px" }}
                    custom={i}
                    variants={fadeUp}
                    className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 flex flex-col gap-5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-green-700" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 text-balance">{card.title}</h3>
                    </div>
                    <p className="text-gray-600 leading-relaxed">{card.text}</p>
                    <div className="grid gap-2.5">
                      {card.bullets.map((b) => (
                        <div key={b} className="flex items-center gap-3">
                          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          </div>
                          <span className="text-gray-700 text-sm font-medium">{b}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── 5. LOOKING AHEAD ─────────────────────────────────────── */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="flex flex-col lg:flex-row items-center gap-0">

                {/* Left: large typography */}
                <div className="flex-1 p-10 md:p-16">
                  <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={{ hidden: {}, visible: {} }}
                  >
                    <motion.p custom={0} variants={fadeUp} className="text-green-600 text-xs font-semibold uppercase tracking-widest mb-4">
                      {t("pages.about.lookingAhead.badge")}
                    </motion.p>
                    <motion.h2 custom={1} variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 text-balance leading-tight mb-6">
                      {t("pages.about.lookingAhead.heading")}
                    </motion.h2>
                    <motion.p custom={2} variants={fadeUp} className="text-gray-600 leading-relaxed mb-4 text-pretty">
                      {t("pages.about.lookingAhead.para1")}
                    </motion.p>
                    <motion.p custom={3} variants={fadeUp} className="text-gray-600 leading-relaxed mb-4 text-pretty">
                      {t("pages.about.lookingAhead.para2")}
                    </motion.p>
                    <motion.p custom={4} variants={fadeUp} className="text-gray-700 font-semibold leading-relaxed text-pretty">
                      {t("pages.about.lookingAhead.para3")}
                    </motion.p>
                  </motion.div>
                </div>

                {/* Right: accent panel */}
                <div className="flex-1 bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-10 md:p-16 min-h-[320px] w-full">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center"
                  >
                    <div className="w-20 h-20 bg-white rounded-3xl shadow-lg flex items-center justify-center mx-auto mb-6 border border-green-100">
                      <Sparkles className="w-9 h-9 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mb-2 text-balance">{t("pages.about.intelligentAutomation.title")}</p>
                    <p className="text-gray-600 max-w-xs mx-auto text-sm leading-relaxed">
                      {t("pages.about.intelligentAutomation.subtitle")}
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {[0, 1, 2, 3].map((idx) => (
                        <span key={idx} className="bg-white text-green-700 text-xs font-semibold border border-green-200 px-3 py-1.5 rounded-full shadow-sm">
                          {t(`pages.about.intelligentAutomation.tags.${idx}`)}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* ── 6. CTA ───────────────────────────────────────────────── */}
        <section className="py-20 px-4 pb-24">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={{ hidden: {}, visible: {} }}
            >
              <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-3xl p-10 md:p-16 text-center shadow-2xl">
                <motion.p custom={0} variants={fadeUp} className="text-green-200 text-xs font-semibold uppercase tracking-widest mb-4">
                  {t("pages.about.cta.badge")}
                </motion.p>
                <motion.h2 custom={1} variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-white text-balance mb-4">
                  {t("pages.about.cta.title")}
                </motion.h2>
                <motion.p custom={2} variants={fadeUp} className="text-green-50 text-lg mb-10 max-w-xl mx-auto text-pretty leading-relaxed">
                  {t("pages.about.cta.description")}
                </motion.p>
                <motion.div
                  custom={3}
                  variants={fadeUp}
                  className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                  <Link
                    href="/login-launch"
                    className="inline-flex items-center gap-2 bg-white text-green-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors shadow-lg"
                  >
                    {t("pages.about.cta.getStarted")}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/features"
                    className="inline-flex items-center gap-2 border border-green-400/50 hover:border-white/60 text-white font-semibold px-8 py-4 rounded-xl transition-colors duration-200 text-lg"
                  >
                    {t("pages.about.cta.viewFeatures")}
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

      </main>
    </>
  );
}
