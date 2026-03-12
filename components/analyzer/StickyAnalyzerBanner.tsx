"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import SocialAnalyzerWidget from "./SocialAnalyzerWidget";

/**
 * StickyAnalyzerBanner
 *
 * Renders a centered sticky container directly below the fixed Navbar (h-16 on
 * mobile, h-20 on md+). The widget is horizontally centered and constrained to
 * 520 px on desktop / 90 vw on mobile, per the product spec.
 *
 * Visibility: visible on first render, dismissed when the user clicks close.
 * Session-level persistence: once dismissed, it won't reappear for the
 * duration of the browser session.
 */
export default function StickyAnalyzerBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if the user already dismissed it this session
    if (sessionStorage.getItem("_az_banner_dismissed") === "1") return;
    // Small delay so it doesn't flash during initial paint
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    sessionStorage.setItem("_az_banner_dismissed", "1");
  };

  return (
    <AnimatePresence>
      {visible && (
        <div
          className="sticky z-40 flex justify-center px-4 pointer-events-none"
          // sits flush under the fixed navbar
          style={{ top: "4rem" /* 64px = h-16 */ }}
        >
          {/* On md+ the navbar is h-20 (80px); compensate with a responsive offset */}
          <style>{`
            @media (min-width: 768px) {
              .az-sticky-wrap { top: 5rem !important; }
            }
          `}</style>
          <div
            className="az-sticky-wrap pointer-events-auto w-[90vw] md:w-[520px]"
            style={{ paddingTop: "0.625rem" }}
          >
            <SocialAnalyzerWidget onClose={handleClose} />
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
