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
    offset: ["start start", "end end"]
  });

  // Beat A: 0-20%
  const opacityA = useTransform(scrollYProgress, [0, 0.15, 0.2], [1, 1, 0]);
  const yA = useTransform(scrollYProgress, [0, 0.2], [0, -50]);

  // Beat B: 25-50%
  const opacityB = useTransform(scrollYProgress, [0.2, 0.25, 0.45, 0.5], [0, 1, 1, 0]);
  const yB = useTransform(scrollYProgress, [0.2, 0.35], [50, 0]);

  // Beat C: 55-75%
  const opacityC = useTransform(scrollYProgress, [0.5, 0.55, 0.7, 0.75], [0, 1, 1, 0]);
  const scaleC = useTransform(scrollYProgress, [0.5, 0.6], [0.8, 1]);

  // Beat D: 80-100%
  const opacityD = useTransform(scrollYProgress, [0.75, 0.8, 0.95, 1], [0, 1, 1, 1]); // Stays visible? Or fades out? Usually fades out or transitions to footer.
  // Actually Beat D (80-100%) Final CTA usually comes AFTER. But user said "Beat D: Audit Your Success".
  // Let's keep Beat D visible until the end of the scroll section.

  return (
    <main className="bg-white min-h-screen">
      {/* Sticky Navigation Bar */}
      <Navbar />

      {/* Scroll Track - 500vh */}
      <div ref={containerRef} className="h-[500vh] relative">

        {/* Sticky Canvas Background */}
        <div className="sticky top-0 h-screen overflow-hidden">
          <RocketCanvas className="z-0" />
        </div>

        {/* Text Overlays - Fixed Position relative to viewport, but controlled by scroll */}
        <div className="fixed top-0 left-0 w-full h-screen pointer-events-none z-10 flex flex-col justify-center items-center text-center px-4">

          {/* Beat A: Introduction */}
          <motion.div style={{ opacity: opacityA, y: yA }} className="absolute mb-32 flex flex-col items-center">

            {/* Title Container */}
            <div className="bg-white/80 backdrop-blur-md border-2 border-green-500/30 rounded-[2.5rem] px-16 py-8 shadow-2xl shadow-green-900/5 mb-8 transform hover:scale-105 transition-transform duration-500">
              <h1 className="text-6xl md:text-9xl font-black text-green-600 tracking-tighter drop-shadow-sm">ZARZOOM</h1>
            </div>

            {/* Subtitle */}
            <p className="text-3xl md:text-4xl text-gray-800 font-bold tracking-tight mb-2">Social Media on Autopilot.</p>

            {/* Scroll Indicator */}
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="mt-12"
            >
              <div className="bg-white/60 backdrop-blur-sm border-2 border-green-500/30 rounded-2xl px-8 py-4 shadow-lg flex flex-col items-center gap-2">
                <span className="text-xs md:text-sm text-gray-700 font-bold tracking-[0.2em] uppercase">Scroll to Launch</span>
                <ArrowDown className="w-5 h-5 text-green-600 stroke-[3px]" />
              </div>
            </motion.div>
          </motion.div>

          {/* Beat B: Features */}
          <motion.div style={{ opacity: opacityB, y: yB }} className="absolute max-w-4xl">
            <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-8">Engineered for Growth.</h2>
            <div className="grid md:grid-cols-3 gap-8 text-left">
              {[
                { title: "AI Gen", desc: "Content created instantly." },
                { title: "Smart Schedule", desc: "Post at peak times." },
                { title: "Auto-Engage", desc: "Reply to fans 24/7." }
              ].map((f, i) => (
                <div key={i} className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-gray-100 shadow-sm">
                  <h3 className="text-xl font-bold text-green-600 mb-2">{f.title}</h3>
                  <p className="text-gray-600">{f.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Beat C: Social Proof */}
          <motion.div style={{ opacity: opacityC, scale: scaleC }} className="absolute">
            <h2 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 tracking-tight">The Results are Explosive.</h2>
            <div className="bg-white/90 backdrop-blur shadow-2xl p-8 rounded-2xl max-w-2xl mx-auto border-l-4 border-green-500">
              <p className="text-2xl italic text-gray-700 mb-4">"ZARZOOM doubled our reach in 30 days. It's like having a team of 10 working 24/7."</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
                  <img src="/avatars/user1.jpg" alt="Marketing Pro" className="w-full h-full object-cover" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900">Alex Morgan</p>
                  <p className="text-sm text-green-600">Marketing Director</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Beat D: Audit */}
          <motion.div style={{ opacity: opacityD }} className="absolute">
            <h2 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">Audit Your Success.</h2>
            <p className="text-2xl text-gray-500 mb-8">Join the ranks of world-class social media campaigns.</p>
            <div className="flex gap-4 justify-center">
              <div className="bg-black text-white px-6 py-3 rounded-lg font-mono">Reach: +240%</div>
              <div className="bg-green-600 text-white px-6 py-3 rounded-lg font-mono">ROI: 12x</div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* Additional Sections below the 500vh scroll container */}
      <div className="relative z-10 bg-white">
        <TestimonialGrid />
        <FinalCTA />

        <footer className="py-12 text-center text-gray-400 text-sm border-t border-gray-100">
          © {new Date().getFullYear()} ZARZOOM. All rights reserved.
        </footer>
      </div>

    </main>
  );
}
