"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function TestimonialGrid() {
  const { translations } = useI18n();
  const { t } = useI18n();

  const testimonials =
    (translations as Record<string, Record<string, unknown>>)?.testimonials
      ?.items as Array<{ name: string; role: string; content: string }> ?? [];

  return (
    <section className="py-24 bg-white relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-green-600 mb-4 text-balance">
            {t("testimonials.heading")}
          </h2>
          <p className="text-xl text-gray-600 text-balance">
            {t("testimonials.subheading")}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-8 bg-gray-50 rounded-2xl hover:shadow-lg transition-shadow"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star
                    key={j}
                    className="w-5 h-5 fill-green-500 text-green-500"
                  />
                ))}
              </div>
              <p className="text-gray-700 mb-6 text-lg leading-relaxed">
                {`"${testimonial.content}"`}
              </p>
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center"
                  aria-hidden="true"
                >
                  <span className="text-green-600 font-bold text-lg">
                    {testimonial.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">
                    {testimonial.name}
                  </h4>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
