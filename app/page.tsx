"use client";

import Navbar from "@/components/Navbar";
import RocketCanvas from "@/components/RocketCanvas";
import TestimonialGrid from "@/components/TestimonialGrid";
import FinalCTA from "@/components/FinalCTA";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowDown } from "lucide-react";

export default function Home() {
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
    <main className="bg-white min-h-screen">
      {/* Sticky Navigation Bar */}
      <Navbar />

      {/* Scroll Track - 500vh */}
      <div ref={containerRef} className="relative" style={{ height: "500vh" }}>
        {/* Rocket Canvas (Sticky Background) */}
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          <RocketCanvas />

          {/* Text Overlay: Hero */}
          <motion.div
            style={{ opacity: heroOpacity, scale: heroScale }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
          >
            <h1 className="text-5xl md:text-7xl font-bold text-green-600 text-center tracking-tight drop-shadow-lg">
              ZARZOOM
            </h1>
            <p className="mt-4 text-xl md:text-2xl text-green-600/80 text-center max-w-xl drop-shadow-md">
              Autopilot Your Socials in Seconds
            </p>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="mt-12"
            >
              <ArrowDown className="w-8 h-8 text-white/60" />
            </motion.div>
          </motion.div>

          {/* Text Overlay: Tagline */}
          <motion.div
            style={{ opacity: taglineOpacity, y: taglineY }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
          >
            <h2 className="text-4xl md:text-6xl font-bold text-white text-center max-w-3xl drop-shadow-lg">
              AI-Powered Social Media Growth
            </h2>
            <p className="mt-6 text-lg md:text-xl text-white/70 text-center max-w-xl drop-shadow-md">
              Generate, schedule, and post — all on autopilot.
            </p>
          </motion.div>

          {/* Text Overlay: Feature Highlight */}
          <motion.div
            style={{ opacity: featureOpacity, y: featureY }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
          >
            <h2 className="text-4xl md:text-6xl font-bold text-white text-center max-w-3xl drop-shadow-lg">
              One Click. Explosive Growth.
            </h2>
          </motion.div>

          {/* Text Overlay: CTA Teaser */}
          <motion.div
            style={{ opacity: ctaOpacity, y: ctaY }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-auto"
          >
            <h2 className="text-4xl md:text-6xl font-bold text-white text-center max-w-3xl drop-shadow-lg mb-8">
              Ready to Transform Your Social Presence?
            </h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-green-600 text-white text-lg px-10 py-4 rounded-full font-bold hover:bg-green-700 transition-colors shadow-2xl"
            >
              Start Free Trial
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Below the Scroll Animation */}
      <TestimonialGrid />
      <FinalCTA />
    </main>
  );
}
