"use client";

import Navbar from "@/components/Navbar";
import RocketCanvas from "@/components/RocketCanvas";
import TestimonialGrid from "@/components/TestimonialGrid";
import FinalCTA from "@/components/FinalCTA";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import DynamicSEO from "@/components/DynamicSEO";

export default function Home() {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);


  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);

  const taglineOpacity = useTransform(scrollYProgress, [0.15, 0.25, 0.35], [0, 1, 0]);
  const taglineY = useTransform(scrollYProgress, [0.15, 0.25], [40, 0]);

  const featureOpacity = useTransform(scrollYProgress, [0.35, 0.45, 0.55], [0, 1, 0]);
  const featureY = useTransform(scrollYProgress, [0.35, 0.45], [40, 0]);

  const ctaOpacity = useTransform(scrollYProgress, [0.55, 0.65, 0.75], [0, 1, 0]);
  const ctaY = useTransform(scrollYProgress, [0.55, 0.65], [40, 0]);

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#f5f5f0" }}>
      <DynamicSEO />
      <Navbar />

      <div ref={containerRef} className="relative" style={{ height: "500vh" }}>
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          <RocketCanvas />

          {/* Text Overlay: Hero */}
          <motion.div
            style={{ opacity: heroOpacity, scale: heroScale }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
          >
            <div className="rounded-2xl border border-green-600 backdrop-blur-sm px-10 py-6 md:px-16 md:py-8" style={{ backgroundColor: "rgba(245, 245, 240, 0.5)" }}>
              <h1 className="text-7xl md:text-9xl font-bold text-green-600 text-center tracking-tight drop-shadow-lg">
                {t("hero.title")}
              </h1>
            </div>
            <div className="mt-4 rounded-2xl border border-green-600 backdrop-blur-sm px-8 py-4 md:px-12 md:py-5" style={{ backgroundColor: "rgba(245, 245, 240, 0.5)" }}>
              <p className="text-2xl md:text-5xl text-black text-center max-w-3xl drop-shadow-md text-balance">
                {t("hero.subtitle")}
              </p>
            </div>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="mt-10 flex flex-col items-center"
            >
              <div className="rounded-xl border border-green-600 px-8 py-3" style={{ backgroundColor: "rgba(245, 245, 240, 0.4)" }}>
                <span className="text-black font-semibold text-lg tracking-wide">
                  {t("hero.scrollToLaunch")}
                </span>
              </div>
              <ArrowDown className="w-8 h-8 text-green-600 mt-3" />
            </motion.div>
          </motion.div>

          {/* Text Overlay: Tagline */}
          <motion.div
            style={{ opacity: taglineOpacity, y: taglineY }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
          >
            <h2 className="text-4xl md:text-6xl font-bold text-black text-center max-w-3xl drop-shadow-lg text-balance">
              {t("tagline.heading")}
            </h2>
            <p className="mt-6 text-lg md:text-xl text-black text-center max-w-xl drop-shadow-md text-balance">
              {t("tagline.subheading")}
            </p>
          </motion.div>

          {/* Text Overlay: Feature Highlight */}
          <motion.div
            style={{ opacity: featureOpacity, y: featureY }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
          >
            <h2 className="text-4xl md:text-6xl font-bold text-black text-center max-w-3xl drop-shadow-lg text-balance">
              {t("feature.heading")}
            </h2>
          </motion.div>

          {/* Text Overlay: CTA Teaser */}
          <motion.div
            style={{ opacity: ctaOpacity, y: ctaY }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-auto"
          >
            <h2 className="text-4xl md:text-6xl font-bold text-black text-center max-w-3xl drop-shadow-lg mb-8 text-balance">
              {t("cta.heading")}
            </h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-green-600 text-white text-lg px-10 py-4 rounded-full font-bold hover:bg-green-700 transition-colors shadow-2xl"
            >
              {t("cta.button")}
            </motion.button>
          </motion.div>
        </div>
      </div>

      <TestimonialGrid />
      <FinalCTA />
    </main>
  );
}
