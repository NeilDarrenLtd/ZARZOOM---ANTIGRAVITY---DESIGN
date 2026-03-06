"use client";

import SiteNavbar from "@/components/SiteNavbar";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Clock,
  TrendingDown,
  BrainCog,
  Sparkles,
  ArrowRight,
  Plug,
  Settings2,
  CalendarCheck,
  Bot,
  ChevronRight,
} from "lucide-react";

/* ─── Animation variants ─────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i: number = 0) => ({
    opacity: 1,
    transition: { duration: 0.7, delay: i * 0.1 },
  }),
};

/* ─── Data ───────────────────────────────────────────────────────── */
const problems = [
  {
    icon: Clock,
    title: "Time-consuming",
    text: "Creating fresh content every day takes hours of writing, editing, and planning.",
  },
  {
    icon: TrendingDown,
    title: "Inconsistent posting",
    text: "Many creators and businesses struggle to post regularly enough to grow.",
  },
  {
    icon: BrainCog,
    title: "Creative burnout",
    text: "Running out of ideas is one of the biggest barriers to maintaining an online presence.",
  },
];

const steps = [
  {
    step: "01",
    icon: Plug,
    title: "Connect your social accounts",
    text: "Link all your platforms in seconds.",
  },
  {
    step: "02",
    icon: Settings2,
    title: "Choose your topics and preferences",
    text: "Define your brand voice, niche, and goals.",
  },
  {
    step: "03",
    icon: Bot,
    title: "ZARZOOM generates AI-powered content",
    text: "Our AI crafts posts perfectly tuned to your audience.",
  },
  {
    step: "04",
    icon: CalendarCheck,
    title: "Content is automatically scheduled",
    text: "Posts go live at optimal times — zero manual effort.",
  },
];

/* ─── Decorative network SVG ─────────────────────────────────────── */
function NetworkIllustration() {
  return (
    <svg
      viewBox="0 0 480 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full opacity-90"
      aria-hidden="true"
    >
      {/* Glow filter */}
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background radial glow */}
      <ellipse cx="240" cy="180" rx="180" ry="140" fill="url(#centerGlow)" />

      {/* Connection lines */}
      <line x1="240" y1="180" x2="80" y2="80" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="240" y1="180" x2="400" y2="80" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="240" y1="180" x2="60" y2="260" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="240" y1="180" x2="420" y2="260" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="240" y1="180" x2="240" y2="40" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="240" y1="180" x2="240" y2="320" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="80" y1="80" x2="400" y2="80" stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.2" />
      <line x1="60" y1="260" x2="420" y2="260" stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.2" />

      {/* Outer nodes */}
      <circle cx="80" cy="80" r="8" fill="#0f1a14" stroke="#22c55e" strokeWidth="1.5" />
      <circle cx="80" cy="80" r="4" fill="#22c55e" filter="url(#glow)" />

      <circle cx="400" cy="80" r="8" fill="#0f1a14" stroke="#22c55e" strokeWidth="1.5" />
      <circle cx="400" cy="80" r="4" fill="#22c55e" filter="url(#glow)" />

      <circle cx="60" cy="260" r="8" fill="#0f1a14" stroke="#22c55e" strokeWidth="1.5" />
      <circle cx="60" cy="260" r="4" fill="#22c55e" filter="url(#glow)" />

      <circle cx="420" cy="260" r="8" fill="#0f1a14" stroke="#22c55e" strokeWidth="1.5" />
      <circle cx="420" cy="260" r="4" fill="#22c55e" filter="url(#glow)" />

      <circle cx="240" cy="40" r="8" fill="#0f1a14" stroke="#22c55e" strokeWidth="1.5" />
      <circle cx="240" cy="40" r="4" fill="#22c55e" filter="url(#glow)" />

      <circle cx="240" cy="320" r="8" fill="#0f1a14" stroke="#22c55e" strokeWidth="1.5" />
      <circle cx="240" cy="320" r="4" fill="#22c55e" filter="url(#glow)" />

      {/* Central hub */}
      <circle cx="240" cy="180" r="28" fill="#0f1a14" stroke="#22c55e" strokeWidth="1.5" />
      <circle cx="240" cy="180" r="18" fill="#16a34a" fillOpacity="0.25" />
      <circle cx="240" cy="180" r="10" fill="#22c55e" filter="url(#glow)" />

      {/* Label icons as text */}
      <text x="68" y="105" fill="#6ee7b7" fontSize="9" fontFamily="monospace" textAnchor="middle">TW</text>
      <text x="400" y="105" fill="#6ee7b7" fontSize="9" fontFamily="monospace" textAnchor="middle">IG</text>
      <text x="48" y="284" fill="#6ee7b7" fontSize="9" fontFamily="monospace" textAnchor="middle">LI</text>
      <text x="432" y="284" fill="#6ee7b7" fontSize="9" fontFamily="monospace" textAnchor="middle">FB</text>
      <text x="240" y="24" fill="#6ee7b7" fontSize="9" fontFamily="monospace" textAnchor="middle">YT</text>
      <text x="240" y="342" fill="#6ee7b7" fontSize="9" fontFamily="monospace" textAnchor="middle">TK</text>
    </svg>
  );
}

/* ─── Animated dot grid background ──────────────────────────────── */
function DotGrid() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(34,197,94,0.12) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
      aria-hidden="true"
    />
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default function AboutPage() {
  return (
    <>
      <SiteNavbar />
      <main className="min-h-screen bg-[#080d0a] text-white">

        {/* ── 1. HERO ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-32 pb-24 px-4">
          <DotGrid />
          {/* Green ambient glow */}
          <div
            className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse, rgba(22,163,74,0.18) 0%, transparent 70%)",
            }}
            aria-hidden="true"
          />

          <div className="relative max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Copy */}
              <div>
                <motion.div
                  initial="hidden"
                  animate="visible"
                  custom={0}
                  variants={fadeUp}
                  className="inline-flex items-center gap-2 border border-emerald-800 bg-emerald-950/50 text-emerald-400 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6"
                >
                  <Sparkles className="w-3 h-3" />
                  Our Story
                </motion.div>

                <motion.h1
                  initial="hidden"
                  animate="visible"
                  custom={1}
                  variants={fadeUp}
                  className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-balance mb-6"
                >
                  The Story Behind{" "}
                  <span className="text-emerald-400">ZARZOOM</span>
                </motion.h1>

                <motion.p
                  initial="hidden"
                  animate="visible"
                  custom={2}
                  variants={fadeUp}
                  className="text-lg text-zinc-400 leading-relaxed mb-4 text-pretty"
                >
                  ZARZOOM was built to solve one of the hardest problems in
                  online growth: consistently creating high-quality social media
                  content.
                </motion.p>
                <motion.p
                  initial="hidden"
                  animate="visible"
                  custom={3}
                  variants={fadeUp}
                  className="text-zinc-500 leading-relaxed mb-4 text-pretty"
                >
                  Most people know they should post more online — but creating
                  engaging content every day is time-consuming, expensive, and
                  difficult to maintain.
                </motion.p>
                <motion.p
                  initial="hidden"
                  animate="visible"
                  custom={4}
                  variants={fadeUp}
                  className="text-zinc-400 leading-relaxed font-medium text-pretty"
                >
                  Using AI-powered automation, ZARZOOM helps you generate,
                  schedule, and publish content across your social platforms —
                  automatically.
                </motion.p>
              </div>

              {/* Right: Illustration */}
              <motion.div
                initial="hidden"
                animate="visible"
                custom={2}
                variants={fadeIn}
                className="relative flex items-center justify-center"
              >
                <div className="w-full max-w-md aspect-square relative">
                  <div className="absolute inset-0 rounded-3xl border border-emerald-900/60 bg-[#0c1710]/60 backdrop-blur-sm" />
                  <div className="absolute inset-0 rounded-3xl overflow-hidden">
                    <NetworkIllustration />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── 2. THE PROBLEM ───────────────────────────────────────── */}
        <section className="relative py-24 px-4 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              custom={0}
              variants={fadeUp}
              className="text-center mb-16"
            >
              <p className="text-emerald-500 text-xs font-semibold uppercase tracking-widest mb-3">
                The Problem
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-balance">
                Social Media Growth Is Hard
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {problems.map((p, i) => {
                const Icon = p.icon;
                return (
                  <motion.div
                    key={p.title}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-60px" }}
                    custom={i}
                    variants={fadeUp}
                    className="group relative rounded-2xl border border-white/8 bg-white/4 backdrop-blur-sm p-8 overflow-hidden hover:border-emerald-800/60 transition-all duration-300"
                  >
                    {/* Hover glow */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                      style={{ background: "radial-gradient(ellipse at top left, rgba(22,163,74,0.08) 0%, transparent 65%)" }}
                      aria-hidden="true"
                    />
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-emerald-950/70 border border-emerald-900/50 flex items-center justify-center mb-5">
                        <Icon className="w-5 h-5 text-emerald-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-3">{p.title}</h3>
                      <p className="text-zinc-400 text-sm leading-relaxed">{p.text}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── 3. THE SOLUTION ──────────────────────────────────────── */}
        <section className="relative py-24 px-4 border-t border-white/5 overflow-hidden">
          {/* Ambient glow */}
          <div
            className="absolute right-[-200px] top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(ellipse, rgba(22,163,74,0.1) 0%, transparent 70%)" }}
            aria-hidden="true"
          />
          <div className="relative max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left: Copy */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={{ hidden: {}, visible: {} }}
              >
                <motion.p
                  custom={0} variants={fadeUp}
                  className="text-emerald-500 text-xs font-semibold uppercase tracking-widest mb-3"
                >
                  The Solution
                </motion.p>
                <motion.h2
                  custom={1} variants={fadeUp}
                  className="text-3xl sm:text-4xl font-bold text-balance mb-6"
                >
                  Meet <span className="text-emerald-400">ZARZOOM</span>
                </motion.h2>
                <motion.p custom={2} variants={fadeUp} className="text-zinc-400 leading-relaxed mb-4 text-pretty">
                  ZARZOOM is an AI-powered content automation platform designed
                  to remove the hardest parts of social media.
                </motion.p>
                <motion.p custom={3} variants={fadeUp} className="text-zinc-400 leading-relaxed mb-4 text-pretty">
                  Instead of struggling to come up with ideas, write posts, and
                  manage scheduling, ZARZOOM handles the heavy lifting.
                </motion.p>
                <motion.p custom={4} variants={fadeUp} className="text-zinc-300 leading-relaxed font-medium text-pretty">
                  You simply define your topics, brand voice, and platforms —
                  and ZARZOOM generates and publishes content for you.
                </motion.p>
              </motion.div>

              {/* Right: Visual pipeline */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                custom={1}
                variants={fadeUp}
                className="relative"
              >
                <div className="rounded-2xl border border-white/8 bg-white/4 backdrop-blur-sm p-8 space-y-4">
                  {[
                    { label: "Brand Voice", value: "Defined", color: "bg-emerald-500" },
                    { label: "Topics", value: "AI-Matched", color: "bg-emerald-400" },
                    { label: "Content", value: "Generated", color: "bg-emerald-300" },
                    { label: "Schedule", value: "Published", color: "bg-emerald-200" },
                  ].map((row, i) => (
                    <motion.div
                      key={row.label}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.12, duration: 0.5, ease: "easeOut" }}
                      className="flex items-center justify-between rounded-xl border border-white/6 bg-white/4 px-5 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${row.color}`} />
                        <span className="text-sm text-zinc-300 font-medium">{row.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-900/50 px-3 py-1 rounded-full">
                        {row.value}
                      </span>
                    </motion.div>
                  ))}

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Autopilot active</span>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      Live
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── 4. HOW IT WORKS ──────────────────────────────────────── */}
        <section className="py-24 px-4 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              custom={0}
              variants={fadeUp}
              className="text-center mb-16"
            >
              <p className="text-emerald-500 text-xs font-semibold uppercase tracking-widest mb-3">
                How It Works
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-balance">
                Four Steps to Full Autopilot
              </h2>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.step}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-60px" }}
                    custom={i}
                    variants={fadeUp}
                    className="relative rounded-2xl border border-white/8 bg-white/4 p-7 flex flex-col gap-4 group hover:border-emerald-800/60 transition-all duration-300"
                  >
                    {/* Step number */}
                    <span className="text-5xl font-black text-white/6 leading-none absolute top-5 right-5 select-none">
                      {s.step}
                    </span>
                    <div className="w-11 h-11 rounded-xl bg-emerald-950/70 border border-emerald-900/50 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white mb-1.5 text-balance">{s.title}</h3>
                      <p className="text-zinc-500 text-sm leading-relaxed">{s.text}</p>
                    </div>
                    {/* Connector arrow (not on last) */}
                    {i < steps.length - 1 && (
                      <div className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                        <div className="w-8 h-8 rounded-full border border-white/10 bg-[#080d0a] flex items-center justify-center">
                          <ChevronRight className="w-4 h-4 text-zinc-600" />
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── 5. THE VISION ────────────────────────────────────────── */}
        <section className="relative py-28 px-4 border-t border-white/5 overflow-hidden">
          <DotGrid />
          {/* Central glow */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="w-[800px] h-[400px] rounded-full"
              style={{ background: "radial-gradient(ellipse, rgba(22,163,74,0.12) 0%, transparent 65%)" }}
            />
          </div>

          <div className="relative max-w-4xl mx-auto text-center">
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              custom={0}
              variants={fadeUp}
              className="text-emerald-500 text-xs font-semibold uppercase tracking-widest mb-4"
            >
              Our Vision
            </motion.p>
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              custom={1}
              variants={fadeUp}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-balance mb-8"
            >
              The Future of{" "}
              <span className="text-emerald-400">Content Creation</span>
            </motion.h2>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={{ hidden: {}, visible: {} }}
              className="space-y-4 text-zinc-400 text-lg leading-relaxed max-w-2xl mx-auto"
            >
              <motion.p custom={2} variants={fadeUp} className="text-pretty">
                We believe the future of online growth will be powered by
                intelligent automation.
              </motion.p>
              <motion.p custom={3} variants={fadeUp} className="text-pretty">
                ZARZOOM is designed to help entrepreneurs, creators, and
                businesses build a powerful online presence without the constant
                pressure of manual content creation.
              </motion.p>
              <motion.p custom={4} variants={fadeUp} className="text-zinc-300 font-medium text-pretty">
                Our goal is simple: give everyone the ability to grow their
                audience effortlessly.
              </motion.p>
            </motion.div>
          </div>
        </section>

        {/* ── 6. FINAL CTA ─────────────────────────────────────────── */}
        <section className="py-24 px-4 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={{ hidden: {}, visible: {} }}
              className="relative rounded-3xl overflow-hidden border border-emerald-900/40 bg-[#0c1710] p-12 text-center"
            >
              {/* Corner glow */}
              <div
                className="absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[200px] pointer-events-none"
                style={{ background: "radial-gradient(ellipse, rgba(22,163,74,0.25) 0%, transparent 70%)" }}
                aria-hidden="true"
              />

              <motion.p
                custom={0} variants={fadeUp}
                className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-4"
              >
                Get Started Today
              </motion.p>
              <motion.h2
                custom={1} variants={fadeUp}
                className="text-3xl sm:text-4xl font-bold text-white text-balance mb-4"
              >
                Start Autopiloting Your Socials Today
              </motion.h2>
              <motion.p
                custom={2} variants={fadeUp}
                className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto text-pretty"
              >
                Join thousands of creators and businesses growing on autopilot.
              </motion.p>

              <motion.div
                custom={3} variants={fadeUp}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <Link
                  href="/login-launch"
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-7 py-3.5 rounded-xl transition-colors duration-200 text-base"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/features"
                  className="inline-flex items-center gap-2 border border-white/15 hover:border-white/30 text-zinc-200 font-semibold px-7 py-3.5 rounded-xl transition-colors duration-200 text-base"
                >
                  View Features
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

      </main>
    </>
  );
}
