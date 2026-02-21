"use client";

import { useState } from "react";
import { useI18n, languages } from "@/lib/i18n";
import { Search, Plus, X, Upload, Loader2, FileText, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { ARTICLE_STYLE_OPTIONS } from "@/lib/validation/onboarding";
import type { OnboardingUpdate } from "@/lib/validation/onboarding";

interface Step2Props {
  data: OnboardingUpdate;
  onChange: (patch: Partial<OnboardingUpdate>) => void;
}

type AutoFillStatus = "idle" | "loading" | "success" | "partial" | "error";

export default function Step2Brand({ data, onChange }: Step2Props) {
  const { t } = useI18n();
  const [investigating, setInvestigating] = useState(false);
  const [websiteStatus, setWebsiteStatus] = useState<AutoFillStatus>("idle");
  const [fileStatus, setFileStatus] = useState<AutoFillStatus>("idle");
  const [uploading, setUploading] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function validateWebsiteUrl(value: string) {
    if (!value) {
      setUrlError("");
      return;
    }
    try {
      new URL(value);
      setUrlError("");
    } catch {
      setUrlError(t("onboarding.validation.invalidUrl"));
    }
  }

  const inputClass =
    "w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors text-sm";

  async function handleInvestigate() {
    if (!data.website_url) return;
    setInvestigating(true);
    setWebsiteStatus("loading");

    try {
      const res = await fetch("/api/v1/onboarding/investigate-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: data.website_url }),
      });

      if (!res.ok) throw new Error("Failed");

      const body = await res.json();
      if (body.data) {
        const patch: Partial<OnboardingUpdate> = {};
        let fieldsFilledCount = 0;
        
        if (body.data.business_description && !data.business_description) {
          patch.business_description = body.data.business_description;
          fieldsFilledCount++;
        }
        if (body.data.suggested_styles) {
          patch.article_styles = body.data.suggested_styles;
          fieldsFilledCount++;
        }
        
        onChange(patch);
        // Determine if success or partial based on fields filled
        setWebsiteStatus(fieldsFilledCount > 0 ? "success" : "partial");
      }
    } catch {
      setWebsiteStatus("error");
    } finally {
      setInvestigating(false);
    }
  }

  async function handleFileAnalyse() {
    if (!selectedFile) return;
    setFileStatus("loading");

    try {
      // Upload and parse file
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/v1/onboarding/upload-file", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorBody = await res.json();
        console.error("[v0] File upload failed:", errorBody);
        throw new Error(errorBody.error || "Failed to upload file");
      }

      const body = await res.json();
      console.log("[v0] File uploaded successfully:", body);

      if (body.success && body.data) {
        // TODO: Call OpenRouter to analyze the extracted text
        // For now, just show success since text extraction worked
        setFileStatus("success");
        
        // Placeholder - in next step we'll analyze the text with AI
        console.log("[v0] Extracted text length:", body.data.extractedText?.length);
      } else {
        setFileStatus("error");
      }
    } catch (error: any) {
      console.error("[v0] File analysis error:", error);
      setFileStatus("error");
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setFileStatus("error");
      alert(`File size exceeds maximum of 10MB. Selected file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setFileStatus("error");
      alert("Only PDF, DOC, and DOCX files are supported");
      return;
    }

    setSelectedFile(file);
    setFileStatus("idle");
  }

  function toggleStyle(style: string) {
    const current = data.article_styles ?? [];
    if (current.includes(style)) {
      onChange({ article_styles: current.filter((s) => s !== style) });
    } else {
      onChange({ article_styles: [...current, style] });
    }
  }

  function addStyleLink() {
    const current = data.article_style_links ?? [];
    if (current.length < 3) {
      onChange({ article_style_links: [...current, ""] });
    }
  }

  function updateStyleLink(index: number, value: string) {
    const current = [...(data.article_style_links ?? [])];
    current[index] = value;
    onChange({ article_style_links: current });
  }

  function removeStyleLink(index: number) {
    const current = [...(data.article_style_links ?? [])];
    current.splice(index, 1);
    onChange({ article_style_links: current });
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    // Create a local object URL for preview (in production, upload to Supabase Storage)
    const url = URL.createObjectURL(file);
    onChange({ logo_url: url });
    setUploading(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Brand Basics Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            Brand Basics
          </h3>
          <p className="text-gray-500 text-sm mt-1 leading-relaxed">
            Tell us about your business so we can tailor content to your brand.
          </p>
        </div>

        {/* Website URL + Auto-fill (moved to top) */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            {t("onboarding.step2.websiteUrl.label")}
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={data.website_url ?? ""}
              onChange={(e) => {
                onChange({ website_url: e.target.value || null });
                validateWebsiteUrl(e.target.value);
                setWebsiteStatus("idle");
              }}
              onBlur={(e) => validateWebsiteUrl(e.target.value)}
              className={`${inputClass} flex-1 ${urlError ? "border-red-400 focus:ring-red-400" : ""}`}
              placeholder={t("onboarding.step2.websiteUrl.placeholder")}
            />
            <button
              type="button"
              onClick={handleInvestigate}
              disabled={!data.website_url || investigating}
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {investigating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {investigating ? "Analysing..." : "Auto-fill from website"}
              </span>
            </button>
          </div>
          
          {/* Website analysis status messages */}
          {websiteStatus === "success" && (
            <div className="flex items-start gap-2 mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-green-700">
                We filled what we could. Please review and adjust if needed.
              </p>
            </div>
          )}
          {websiteStatus === "partial" && (
            <div className="flex items-start gap-2 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                We couldn't get everything. Please complete the remaining fields below.
              </p>
            </div>
          )}
          {websiteStatus === "error" && (
            <div className="flex items-start gap-2 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700">
                We couldn't analyse that right now. Please try again or fill in manually.
              </p>
            </div>
          )}
          
          {urlError && (
            <p className="text-xs text-red-500 mt-2">{urlError}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            {t("onboarding.step2.websiteUrl.help")}
          </p>
        </div>

        {/* Import from file section */}
        <div className="pt-6 border-t border-gray-200">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Import from file
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <label className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 truncate">
                  {selectedFile ? selectedFile.name : "Choose PDF or Word document"}
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileSelect}
                  className="sr-only"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleFileAnalyse}
              disabled={!selectedFile || fileStatus === "loading"}
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {fileStatus === "loading" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {fileStatus === "loading" ? "Analysing..." : "Analyse file"}
              </span>
            </button>
          </div>

          {/* File analysis status messages */}
          {fileStatus === "success" && (
            <div className="flex items-start gap-2 mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-green-700">
                We filled what we could. Please review and adjust if needed.
              </p>
            </div>
          )}
          {fileStatus === "partial" && (
            <div className="flex items-start gap-2 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                We couldn't get everything. Please complete the remaining fields below.
              </p>
            </div>
          )}
          {fileStatus === "error" && (
            <div className="flex items-start gap-2 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700">
                We couldn't analyse that right now. Please try again or fill in manually.
              </p>
            </div>
          )}
          
          <p className="text-xs text-gray-400 mt-2">
            Upload a PDF/Word document and we'll try to auto-fill the wizard.
          </p>
        </div>
      </div>

      {/* Business Name */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("onboarding.step2.businessName.label")}
        </label>
        <input
          type="text"
          value={data.business_name ?? ""}
          onChange={(e) => onChange({ business_name: e.target.value })}
          className={inputClass}
          placeholder={t("onboarding.step2.businessName.placeholder")}
        />
        <p className="text-xs text-gray-400 mt-1">
          {t("onboarding.step2.businessName.help")}
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("onboarding.step2.description.label")}
        </label>
        <textarea
          value={data.business_description ?? ""}
          onChange={(e) => onChange({ business_description: e.target.value })}
          className={`${inputClass} resize-none`}
          rows={3}
          placeholder={t("onboarding.step2.description.placeholder")}
        />
        <p className="text-xs text-gray-400 mt-1">
          {t("onboarding.step2.description.help")}
        </p>
      </div>

      {/* Content Language */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("onboarding.step2.contentLanguage.label")}
        </label>
        <select
          value={data.content_language ?? "en"}
          onChange={(e) => onChange({ content_language: e.target.value })}
          className={inputClass}
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.nativeName} ({lang.name})
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          {t("onboarding.step2.contentLanguage.help")}
        </p>
      </div>

      {/* Article Styles */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("onboarding.step2.articleStyles.label")}
        </label>
        <div className="flex flex-wrap gap-2 mt-1">
          {ARTICLE_STYLE_OPTIONS.map((style) => {
            const isSelected = (data.article_styles ?? []).includes(style);
            return (
              <button
                key={style}
                type="button"
                onClick={() => toggleStyle(style)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  isSelected
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-700"
                }`}
              >
                {t(`onboarding.step2.articleStyles.options.${style}`)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {t("onboarding.step2.articleStyles.help")}
        </p>
      </div>

      {/* Style Links */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("onboarding.step2.styleLinks.label")}
        </label>
        <div className="flex flex-col gap-2">
          {(data.article_style_links ?? []).map((link, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="url"
                value={link}
                onChange={(e) => updateStyleLink(i, e.target.value)}
                className={`${inputClass} flex-1`}
                placeholder={t("onboarding.step2.styleLinks.placeholder")}
              />
              <button
                type="button"
                onClick={() => removeStyleLink(i)}
                className="p-3 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        {(data.article_style_links ?? []).length < 3 && (
          <button
            type="button"
            onClick={addStyleLink}
            className="flex items-center gap-1.5 mt-2 text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("onboarding.step2.styleLinks.add")}
          </button>
        )}
        <p className="text-xs text-gray-400 mt-1">
          {t("onboarding.step2.styleLinks.help")}
        </p>
      </div>

      {/* Brand Colour */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("onboarding.step2.brandColor.label")}
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={data.brand_color_hex ?? "#16a34a"}
            onChange={(e) => onChange({ brand_color_hex: e.target.value })}
            className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
          />
          <input
            type="text"
            value={data.brand_color_hex ?? ""}
            onChange={(e) => onChange({ brand_color_hex: e.target.value || null })}
            className={`${inputClass} max-w-[140px]`}
            placeholder="#FF5500"
            maxLength={7}
          />
          {data.brand_color_hex && (
            <div
              className="w-10 h-10 rounded-lg border border-gray-200"
              style={{ backgroundColor: data.brand_color_hex }}
            />
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {t("onboarding.step2.brandColor.help")}
        </p>
      </div>

      {/* Logo Upload */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("onboarding.step2.logo.label")}
        </label>
        <div className="flex items-center gap-4">
          {data.logo_url ? (
            <img
              src={data.logo_url}
              alt={t("onboarding.a11y.brandLogoAlt")}
              className="w-16 h-16 rounded-lg border border-gray-200 object-contain bg-white"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
              <Upload className="w-5 h-5 text-gray-400" />
            </div>
          )}
          <label className="cursor-pointer">
            <span className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors inline-block">
              {uploading
                ? t("onboarding.step2.logo.uploading")
                : data.logo_url
                  ? t("onboarding.step2.logo.change")
                  : t("onboarding.step2.logo.upload")}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleLogoUpload}
              className="sr-only"
            />
          </label>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {t("onboarding.step2.logo.help")}
        </p>
      </div>

    </div>
  );
}
