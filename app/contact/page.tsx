"use client";

import { useState } from "react";
import { ArrowLeft, Mail, Phone, MapPin, Loader } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import SiteNavbar from "@/components/SiteNavbar";

export default function ContactPage() {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.subject.trim() || !formData.message.trim()) {
      setError(t("contact.form.errors.required"));
      return;
    }

    if (formData.message.length < 10) {
      setError(t("contact.form.messageHint"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t("contact.form.errors.failed"));
      }

      setSubmitted(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
      
      // Reset success message after 5 seconds
      setTimeout(() => setSubmitted(false), 5000);
    } catch (err: any) {
      setError(err.message || t("contact.form.errors.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SiteNavbar />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 text-balance">
            Get in Touch
          </h1>
          <p className="text-lg text-gray-600 text-balance max-w-2xl">
            Have a question or need support? We're here to help. Send us a message and we'll respond as soon as possible.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Contact Info Cards */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <Mail className="w-6 h-6 text-green-600" />
              </div>
              <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Email
            </h3>
                <a
                  href="mailto:support@zarzoom.com"
                  className="text-green-600 hover:text-green-700 font-medium transition-colors"
                >
                  support@zarzoom.com
                </a>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <Phone className="w-6 h-6 text-green-600" />
              </div>
              <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Phone
            </h3>
                <a
                  href="tel:+441234567890"
                  className="text-green-600 hover:text-green-700 font-medium transition-colors"
                >
                  +44 (0) 123 456 7890
                </a>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <MapPin className="w-6 h-6 text-green-600" />
              </div>
              <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Office
            </h3>
                <p className="text-gray-600 text-sm">
                  123 Business Street<br />
                  London, UK EC1A 1AA
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Send us a Message
          </h2>
          <p className="text-gray-600 mb-8">
            We typically respond to all inquiries within 24 hours during business days.
          </p>

          {submitted && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-semibold mb-1">
                Message Sent Successfully!
              </p>
              <p className="text-green-700 text-sm">
                Thank you for contacting us. We'll get back to you as soon as possible.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-semibold">
                Error
              </p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-900 mb-2">
                Your Name
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="John Doe"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                Your Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="john@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="subject" className="block text-sm font-semibold text-gray-900 mb-2">
                Subject
              </label>
              <input
                id="subject"
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                placeholder="How can we help you?"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-sm font-semibold text-gray-900 mb-2">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                placeholder="Tell us more about your inquiry..."
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                Minimum 10 characters
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Message"
              )}
            </button>
          </form>
        </div>
      </div>
      </div>
    </>
  );
}
