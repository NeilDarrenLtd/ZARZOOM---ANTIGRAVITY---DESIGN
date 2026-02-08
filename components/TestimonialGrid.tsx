"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
    {
        name: "Sarah Jenkins",
        role: "CMO, TechFlow",
        content: "ZARZOOM doubled our reach in 30 days. The AI content generation is indistinguishable from human writing.",
        avatar: "/avatars/sarah.jpg", // Placeholder
    },
    {
        name: "David Chen",
        role: "Founder, GrowthStack",
        content: "The autopilot feature is a game changer. I spend 5 minutes a week on social now.",
        avatar: "/avatars/david.jpg",
    },
    {
        name: "Elena Rodriguez",
        role: "Influence Lead",
        content: "Explosive growth indeed. Our engagement metrics are up 400% across all platforms.",
        avatar: "/avatars/elena.jpg",
    }
];

export default function TestimonialGrid() {
    return (
        <section className="py-24 bg-white relative z-10">
            <div className="max-w-7xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-4xl font-bold text-green-600 mb-4">Trusted by Industry Leaders</h2>
                    <p className="text-xl text-gray-600">Join 10,000+ marketers scaling with ZARZOOM.</p>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-8">
                    {testimonials.map((t, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="p-8 bg-gray-50 rounded-2xl hover:shadow-lg transition-shadow"
                        >
                            <div className="flex gap-1 mb-4">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-5 h-5 fill-green-500 text-green-500" />
                                ))}
                            </div>
                            <p className="text-gray-700 mb-6 text-lg leading-relaxed">"{t.content}"</p>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gray-300 rounded-full" />
                                {/* Fallback avatar if image missing */}
                                <div>
                                    <h4 className="font-bold text-gray-900">{t.name}</h4>
                                    <p className="text-sm text-gray-500">{t.role}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
