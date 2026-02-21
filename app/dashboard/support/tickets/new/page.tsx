"use client";

import { useState, useRef, ChangeEvent, FormEvent } from "react";
import { useI18n } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import DynamicSEO from "@/components/DynamicSEO";
import Link from "next/link";
import { Upload, X, Check, AlertCircle } from "lucide-react";

export default function CreateTicketPage() {
  const { t } = useI18n();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    subject: "",
    category: "",
    priority: "",
    description: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);

    // Validate file count
    if (files.length + selectedFiles.length > 3) {
      setError(t("support.attachments.fileCountError"));
      return;
    }

    // Validate file types and sizes
    const validFiles: File[] = [];
    for (const file of selectedFiles) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        setError(t("support.attachments.fileTypeError"));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(t("support.attachments.fileSizeError"));
        return;
      }
      validFiles.push(file);
    }

    setFiles([...files, ...validFiles]);
    setError(null);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.description.trim()) {
      setError("Subject and description are required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Step 1: Create ticket with initial comment
      const ticketRes = await fetch("/api/v1/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: formData.subject,
          category: formData.category || undefined,
          priority: formData.priority || undefined,
          description: formData.description,
        }),
      });

      if (!ticketRes.ok) {
        const errorData = await ticketRes.json();
        throw new Error(errorData.message || "Failed to create ticket");
      }

      const ticketData = await ticketRes.json();
      const ticketId = ticketData.ticket.id;
      const firstCommentId = ticketData.ticket.first_comment_id;

      // Step 2: Upload attachments if any
      if (files.length > 0 && firstCommentId) {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));

        const uploadRes = await fetch(
          `/api/v1/support/tickets/${ticketId}/comments/${firstCommentId}/attachments`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!uploadRes.ok) {
          console.warn("Failed to upload some attachments");
        }
      }

      setCreatedTicketId(ticketId);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || t("support.errors.createFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (success && createdTicketId) {
    return (
      <main className="bg-gray-50 min-h-screen flex flex-col">
        <DynamicSEO />
        <SiteNavbar />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 max-w-md w-full text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {t("support.create.success.title")}
            </h2>
            <p className="text-gray-600 mb-6">
              {t("support.create.success.message")}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push(`/dashboard/support/tickets/${createdTicketId}`)}
                className="bg-green-600 text-white px-6 py-3 rounded-full font-bold hover:bg-green-700 transition-colors"
              >
                {t("support.create.success.viewTicket")}
              </button>
              <button
                onClick={() => {
                  setSuccess(false);
                  setCreatedTicketId(null);
                  setFormData({ subject: "", category: "", priority: "", description: "" });
                  setFiles([]);
                }}
                className="border border-gray-300 text-gray-700 px-6 py-3 rounded-full font-medium hover:bg-gray-50 transition-colors"
              >
                {t("support.create.success.createAnother")}
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <DynamicSEO />
      <SiteNavbar />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t("support.create.title")}
          </h1>
          <p className="text-gray-600">{t("support.create.subtitle")}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
          {/* Subject */}
          <div className="mb-6">
            <label htmlFor="subject" className="block text-sm font-bold text-gray-900 mb-2">
              {t("support.create.form.subject")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              placeholder={t("support.create.form.subjectPlaceholder")}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">{t("support.create.form.subjectHelp")}</p>
          </div>

          {/* Category */}
          <div className="mb-6">
            <label htmlFor="category" className="block text-sm font-bold text-gray-900 mb-2">
              {t("support.create.form.category")}
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">{t("support.category.none") || "Select a category"}</option>
              <option value="technical">{t("support.category.technical")}</option>
              <option value="billing">{t("support.category.billing")}</option>
              <option value="bug_report">{t("support.category.bug_report") || "Bug Report"}</option>
              <option value="feature_request">{t("support.category.feature_request")}</option>
              <option value="general">{t("support.category.general") || "General"}</option>
              <option value="other">{t("support.category.other")}</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">{t("support.create.form.categoryHelp")}</p>
          </div>

          {/* Priority */}
          <div className="mb-6">
            <label htmlFor="priority" className="block text-sm font-bold text-gray-900 mb-2">
              {t("support.create.form.priority")}
            </label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">{t("support.priority.none")}</option>
              <option value="low">{t("support.priority.low")}</option>
              <option value="medium">{t("support.priority.medium") || "Medium"}</option>
              <option value="high">{t("support.priority.high")}</option>
              <option value="urgent">{t("support.priority.urgent")}</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">{t("support.create.form.priorityHelp")}</p>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-bold text-gray-900 mb-2">
              {t("support.create.form.description")} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder={t("support.create.form.descriptionPlaceholder")}
              rows={8}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              required
            />
            <p className="text-xs text-gray-500 mt-1">{t("support.create.form.descriptionHelp")}</p>
          </div>

          {/* Attachments */}
          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-900 mb-2">
              {t("support.create.form.attachments")}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= 3}
              className="border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 hover:border-green-500 hover:bg-green-50 transition-colors flex items-center gap-2 text-gray-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-5 h-5" />
              {t("support.create.form.attachmentsBtn")}
              {files.length > 0 && ` (${files.length}/3)`}
            </button>
            <p className="text-xs text-gray-500 mt-1">{t("support.create.form.attachmentsHelp")}</p>

            {/* File previews */}
            {files.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="relative border border-gray-200 rounded-lg p-3 bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="flex-shrink-0 text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <Link
              href="/dashboard/support/tickets"
              className="border border-gray-300 text-gray-700 px-6 py-3 rounded-full font-medium hover:bg-gray-50 transition-colors text-center"
            >
              {t("support.create.form.cancel")}
            </Link>
            <button
              type="submit"
              disabled={submitting || !formData.subject.trim() || !formData.description.trim()}
              className="bg-green-600 text-white px-6 py-3 rounded-full font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-initial"
            >
              {submitting ? t("support.create.form.submitting") : t("support.create.form.submit")}
            </button>
          </div>
        </form>

        {/* Back Link */}
        <div className="mt-8">
          <Link
            href="/dashboard/support/tickets"
            className="text-green-600 hover:text-green-700 font-medium inline-flex items-center gap-2"
          >
            ← {t("support.nav.backToSupport")}
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  );
}
