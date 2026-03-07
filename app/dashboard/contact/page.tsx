"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useWorkspaceFetch } from "@/lib/workspace/context";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import DynamicSEO from "@/components/DynamicSEO";
import { ArrowLeft, Mail, Phone, MapPin, Send, Check, AlertCircle } from "lucide-react";

export default function ContactPage() {
  const { t } = useI18n();
  const workspaceFetch = useWorkspaceFetch();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.subject.trim() || !formData.message.trim()) {
      setError(t("pages.contact.form.errors.required"));
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      console.log("[v0] Submitting contact form");
      
      const res = await workspaceFetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        console.log("[v0] Contact form error:", data);
        throw new Error(data.error?.message || data.message || "Failed to send message");
      }

      console.log("[v0] Contact form success");
      setSuccess(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (err: any) {
      console.error("[v0] Contact form submission failed:", err);
      setError(err.message || t("pages.contact.form.errors.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DynamicSEO
        title={t("pages.contact.seo.title")}
        description={t("pages.contact.seo.description")}
      />
      <SiteNavbar />
      
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-8 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back to Dashboard */}
          <div className="mb-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>

          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              {t("pages.contact.title")}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t("pages.contact.subtitle")}
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-12">
            {/* Contact Information */}
            <div className="lg:col-span-1 space-y-8">
              {/* Company Info Card */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {t("pages.contact.info.title")}
                </h2>
                
                <div className="space-y-6">
                  {/* Email */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">
                        {t("pages.contact.info.email.label")}
                      </p>
                      <a
                        href="mailto:support@zarzoom.com"
                        className="text-green-600 hover:text-green-700 font-medium"
                      >
                        support@zarzoom.com
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Business Hours */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border border-green-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  {t("pages.contact.hours.title")}
                </h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span className="font-medium">{t("pages.contact.hours.weekdays")}</span>
                    <span>{t("pages.contact.hours.weekdaysTime")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">{t("pages.contact.hours.saturday")}</span>
                    <span>{t("pages.contact.hours.saturdayTime")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">{t("pages.contact.hours.sunday")}</span>
                    <span>{t("pages.contact.hours.closed")}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-4">
                  {t("pages.contact.hours.note")}
                </p>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
<h2 className="text-2xl font-bold text-gray-900 mb-6">
                {t("pages.contact.form.title")}
                </h2>

                {/* Success Message */}
                {success && (
                  <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-green-900">
                        {t("pages.contact.form.success.title")}
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        {t("pages.contact.form.success.message")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-900">
                        {t("pages.contact.form.error.title")}
                      </p>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div>
                      <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                        {t("pages.contact.form.name")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder={t("pages.contact.form.namePlaceholder")}
                        required
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                        {t("pages.contact.form.email")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder={t("pages.contact.form.emailPlaceholder")}
                        required
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label htmlFor="subject" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t("pages.contact.form.subject")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="subject"
                      name="subject"
                      type="text"
                      value={formData.subject}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder={t("pages.contact.form.subjectPlaceholder")}
                      required
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t("pages.contact.form.message")} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={6}
                      value={formData.message}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                      placeholder={t("pages.contact.form.messagePlaceholder")}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1.5">
                      {t("pages.contact.form.messageHint")}
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-green-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t("pages.contact.form.sending")}
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        {t("pages.contact.form.submit")}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
