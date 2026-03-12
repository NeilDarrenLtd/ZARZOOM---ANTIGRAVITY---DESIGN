"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, Sparkles } from "lucide-react";
import SocialAnalyzerWidget from "./SocialAnalyzerWidget";

export default function StickyAnalyzerBanner() {
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* DESKTOP: Left-positioned fixed panel */}
      <div className="hidden lg:block fixed z-50 left-6 xl:left-10" style={{ top: "6.5rem" }}>
        <AnimatePresence mode="wait">
          {expanded ? (
            <motion.div
              key="expanded-desktop"
              initial={{ opacity: 0, x: -20, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <button
                onClick={() => setExpanded(false)}
                className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-colors"
                style={{ background: "#1c2029", border: "1px solid rgba(255,255,255,0.1)" }}
                aria-label="Minimise analyzer"
              >
                <ChevronDown className="w-4 h-4 text-white/60" />
              </button>
              <SocialAnalyzerWidget />
            </motion.div>
          ) : (
            <motion.button
              key="minimised-desktop"
              onClick={() => setExpanded(true)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="group flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl transition-all hover:scale-[1.02]"
              style={{
                background: "linear-gradient(145deg, #0f1117 0%, #171c26 100%)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              aria-label="Expand analyzer"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(22,163,74,0.15)" }}>
                <Sparkles className="w-4 h-4 text-green-400" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold tracking-wide text-white">
                  FREE AI AUDIT
                  <span className="text-white/40 font-medium ml-2">• 5 sec</span>
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">Get Your Social Score</p>
              </div>
              <ChevronUp className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors ml-2" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* MOBILE + TABLET: Bottom-docked panel */}
      <div className="lg:hidden fixed z-50 inset-x-0 bottom-0 pointer-events-none">
        <AnimatePresence mode="wait">
          {expanded ? (
            <motion.div
              key="expanded-mobile"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto w-full px-3 pb-3"
            >
              <button
                onClick={() => setExpanded(false)}
                className="w-full flex items-center justify-center py-2 mb-1"
                aria-label="Minimise analyzer"
              >
                <div className="w-12 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
              </button>
              <div className="w-full max-w-[520px] mx-auto">
                <SocialAnalyzerWidget />
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="minimised-mobile"
              onClick={() => setExpanded(true)}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto w-full flex items-center justify-center gap-3 py-4 px-5 shadow-2xl"
              style={{
                background: "linear-gradient(180deg, #0f1117 0%, #171c26 100%)",
                borderTop: "1px solid rgba(255,255,255,0.1)",
              }}
              aria-label="Expand analyzer"
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(22,163,74,0.15)" }}>
                <Sparkles className="w-3.5 h-3.5 text-green-400" />
              </div>
              <p className="text-sm font-bold tracking-wide text-white">
                FREE AI AUDIT
                <span className="text-white/40 font-medium ml-2">• 5 sec</span>
              </p>
              <ChevronUp className="w-4 h-4 text-white/50 ml-auto" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {expanded && (
        <div className="lg:hidden h-[420px] pointer-events-none" aria-hidden="true" />
      )}
    </>
  );
}


  return (
    <>
      {/* ─────────────────────────────────────────────────────────────────────
          DESKTOP: Left-positioned fixed panel within hero area
         ───────────────────────────────────────────────────────────────────── */}
      <div className="hidden lg:block fixed z-50 left-6 xl:left-10"
        style={{ top: "6.5rem" /* below navbar */ }}>
        <AnimatePresence mode="wait">
          {expanded ? (
            <motion.div
              key="expanded-desktop"
              initial={{ opacity: 0, x: -20, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              {/* Minimise button */}
              <button
                onClick={handleMinimise}
                className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-colors"
                style={{ background: "#1c2029", border: "1px solid rgba(255,255,255,0.1)" }}
                aria-label="Minimise analyzer"
              >
                <ChevronDown className="w-4 h-4 text-white/60" />
              </button>
              <SocialAnalyzerWidget onClose={handleClose} />
            </motion.div>
          ) : (
            <motion.button
              key="minimised-desktop"
              onClick={handleExpand}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="group flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl transition-all hover:scale-[1.02]"
              style={{
                background: "linear-gradient(145deg, #0f1117 0%, #171c26 100%)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              aria-label="Expand analyzer"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(22,163,74,0.15)" }}>
                <Sparkles className="w-4 h-4 text-green-400" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold tracking-wide text-white">
                  FREE AI AUDIT
                  <span className="text-white/40 font-medium ml-2">• 5 sec</span>
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">Get Your Social Score</p>
              </div>
              <ChevronUp className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors ml-2" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          MOBILE + TABLET: Bottom-docked panel
         ───────────────────────────────────────────────────────────────────── */}
      <div className="lg:hidden fixed z-50 inset-x-0 bottom-0 pointer-events-none">
        <AnimatePresence mode="wait">
          {expanded ? (
            <motion.div
              key="expanded-mobile"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto w-full px-3 pb-3"
            >
              {/* Minimise handle bar */}
              <button
                onClick={handleMinimise}
                className="w-full flex items-center justify-center py-2 mb-1"
                aria-label="Minimise analyzer"
              >
                <div className="w-12 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
              </button>
              <div className="w-full max-w-[520px] mx-auto">
                <SocialAnalyzerWidget onClose={handleClose} />
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="minimised-mobile"
              onClick={handleExpand}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto w-full flex items-center justify-center gap-3 py-4 px-5 shadow-2xl"
              style={{
                background: "linear-gradient(180deg, #0f1117 0%, #171c26 100%)",
                borderTop: "1px solid rgba(255,255,255,0.1)",
              }}
              aria-label="Expand analyzer"
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(22,163,74,0.15)" }}>
                <Sparkles className="w-3.5 h-3.5 text-green-400" />
              </div>
              <p className="text-sm font-bold tracking-wide text-white">
                FREE AI AUDIT
                <span className="text-white/40 font-medium ml-2">• 5 sec</span>
              </p>
              <ChevronUp className="w-4 h-4 text-white/50 ml-auto" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Safe area spacer on mobile when expanded — prevents content from being hidden */}
      {expanded && (
        <div className="lg:hidden h-[420px] pointer-events-none" aria-hidden="true" />
      )}
    </>
  );
}
