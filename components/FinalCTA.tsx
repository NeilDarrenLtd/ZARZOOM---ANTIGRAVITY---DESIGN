"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function FinalCTA() {
    return (
        <section className="min-h-[80vh] flex items-center justify-center bg-white relative z-10">
            <div className="text-center max-w-4xl px-6">
                <motion.h2
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    className="text-6xl md:text-8xl font-bold text-green-600 mb-8 tracking-tight"
                >
                    Ready to Blast Off?
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl text-gray-500 mb-12"
                >
                    Start your 14-day free trial. No credit card required.
                </motion.p>
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ delay: 0.5 }}
                    className="bg-green-600 text-white text-xl md:text-2xl px-12 py-6 rounded-full font-bold hover:bg-green-700 transition-colors flex items-center gap-3 mx-auto group"
                >
                    Get Started Now
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </motion.button>
            </div>
        </section>
    );
}
