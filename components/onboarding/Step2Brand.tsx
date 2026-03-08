"use client";

import { useState } from "react";
import { useI18n, languages } from "@/lib/i18n";
import { Search, Plus, X, Upload, Loader2, FileText, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { ARTICLE_STYLE_OPTIONS } from "@/lib/validation/onboarding";
import type { OnboardingUpdate } from "@/lib/validation/onboarding";
import { getActiveWorkspaceIdFromCookie } from "@/lib/workspace/active";
import { AIFilledField } from "./AIFilledField";

interface Step2Props {
  data: OnboardingUpdate;
  onChange: (patch: Partial<OnboardingUpdate>) => void;
  aiFilledFields?: string[];
  onReload?: () => Promise<void>;
}

type AutoFillStatus = "idle" | "loading" | "success" | "partial" | "error";

export default function Step2Brand({ data, onChange, aiFilledFields = [], onReload }: Step2Props) {
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
    if (!data.website_url || !data.website_url.trim()) {
      setUrlError("Please enter a website URL before clicking Auto-fill.");
      return;
    }
    // Validate it's a proper URL
    try {
      new URL(data.website_url);
    } catch {
      setUrlError("Please enter a valid URL (e.g. https://example.com)");
      return;
    }
    setUrlError("");
    setInvestigating(true);
    setWebsiteStatus("loading");

    try {
      console.log("[v0] Calling website autofill API...");
      const tenantId = typeof document !== "undefined" ? getActiveWorkspaceIdFromCookie() : null;
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (tenantId) headers["X-Tenant-Id"] = tenantId;
      const res = await fetch("/api/v1/onboarding/autofill/website", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: data.website_url }),
      });

      const body = await res.json();
      console.log("[v0] Website autofill response:", body);

      if (!res.ok) {
        throw new Error(body.error || body.message || "Failed to analyze website");
      }

      // Check status and reload wizard data
      if (body.status === "success" || body.status === "partial") {
        // Reload the wizard data from the database since it was updated server-side
        if (onReload) {
          await onReload();
        }
        
        setWebsiteStatus(body.status);
        console.log(`[v0] Website autofill ${body.status}: ${body.fieldsPopulated} fields populated`);
      } else {
        setWebsiteStatus("error");
      }
    } catch (error: any) {
      console.error("[v0] Website autofill error:", error);
      setWebsiteStatus("error");
    } finally {
      setInvestigating(false);
    }
  }

  const [fileError, setFileError] = useState("");

  async function handleFileAnalyse() {
    if (!selectedFile) {
      setFileError("Please select a file before clicking Auto-fill.");
      return;
    }
    setFileError("");
    setFileStatus("loading");

    try {
      // Step 1: Read the file on the client side
      // For TXT files we read as text, for PDF we read as text (server will get raw text)
      let extractedText = "";

      if (selectedFile.type === "text/plain" || selectedFile.name.toLowerCase().endsWith(".txt")) {
        extractedText = await selectedFile.text();
      } else if (selectedFile.type === "application/pdf" || selectedFile.name.toLowerCase().endsWith(".pdf")) {
        // For PDFs, send the file via FormData to the upload-file endpoint for server-side extraction
        const formData = new FormData();
        formData.append("file", selectedFile);
        const uploadTenantId = typeof document !== "undefined" ? getActiveWorkspaceIdFromCookie() : null;
        const uploadHeaders: HeadersInit = {};
        if (uploadTenantId) uploadHeaders["X-Tenant-Id"] = uploadTenantId;
        const uploadRes = await fetch("/api/v1/onboarding/upload-file", {
          method: "POST",
          headers: uploadHeaders,
          body: formData,
        });
        if (!uploadRes.ok) {
          const errorBody = await uploadRes.json().catch(() => ({ error: "Failed to process PDF" }));
          throw new Error(errorBody.error || "Failed to process PDF");
        }
        const uploadBody = await uploadRes.json();
        if (!uploadBody.success || !uploadBody.data?.extractedText) {
          throw new Error("Could not extract text from PDF");
        }
        extractedText = uploadBody.data.extractedText;
      } else {
        throw new Error("Unsupported file type. Please use PDF or TXT files.");
      }

      if (!extractedText || extractedText.trim().length < 50) {
        throw new Error("The file does not contain enough readable text to analyse. Please try a different file.");
      }

      // Step 2: Send extracted text directly to the autofill/file endpoint
      const fileTenantId = typeof document !== "undefined" ? getActiveWorkspaceIdFromCookie() : null;
      const fileHeaders: HeadersInit = { "Content-Type": "application/json" };
      if (fileTenantId) fileHeaders["X-Tenant-Id"] = fileTenantId;
      const analyzeRes = await fetch("/api/v1/onboarding/autofill/file", {
        method: "POST",
        headers: fileHeaders,
        body: JSON.stringify({
          storageFilePath: `client-${Date.now()}`,
          extractedText: extractedText.trim(),
          fileName: selectedFile.name,
        }),
      });

      const analyzeBody = await analyzeRes.json();

      if (!analyzeRes.ok) {
        throw new Error(analyzeBody.error || analyzeBody.message || "Failed to analyse file");
      }

      // Check status and reload wizard data
      if (analyzeBody.status === "success" || analyzeBody.status === "partial") {
        if (onReload) {
          await onReload();
        }
        setFileStatus(analyzeBody.status);
      } else {
        setFileStatus("error");
      }
    } catch (error: any) {
      console.error("[v0] File analysis error:", error?.message);
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
      setFileError(`File size exceeds maximum of 10MB. Selected file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    // Validate file type — match server-side supported types
    const allowedTypes = ["application/pdf", "text/plain"];
    const allowedExtensions = [".pdf", ".txt"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      setFileStatus("error");
      setFileError("Only PDF and TXT files are supported.");
      return;
    }

    setSelectedFile(file);
    setFileStatus("idle");
    setFileError("");
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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (2MB max for logos)
    if (file.size > 2 * 1024 * 1024) {
      alert("Logo must be under 2MB");
      return;
    }

    // Validate type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Only JPEG, PNG, and WebP images are allowed");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const tenantId = typeof document !== "undefined" ? getActiveWorkspaceIdFromCookie() : null;
      const headers: HeadersInit = {};
      if (tenantId) headers["X-Tenant-Id"] = tenantId;
      const res = await fetch("/api/v1/onboarding/upload-logo", {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to upload logo");
      }

      const body = await res.json();
      if (body.success && body.data?.url) {
        onChange({ logo_url: body.data.url });
      }
    } catch (err: any) {
      console.error("[v0] Logo upload error:", err);
      alert(err.message || "Failed to upload logo");
    } finally {
      setUploading(false);
    }
  }

  // Check if we have missing critical fields after partial autofill
  const hasPartialAutofill = websiteStatus === "partial" || fileStatus === "partial";
  const criticalFields = ["business_name", "business_description"];
  const missingCriticalFields = criticalFields.filter(
    (field) => !data[field as keyof OnboardingUpdate]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Partial autofill helper message */}
      {hasPartialAutofill && missingCriticalFields.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-amber-900 mb-1">
            Complete remaining fields
          </h4>
          <p className="text-xs text-amber-700 mb-2">
            We filled what we could, but still need:
          </p>
          <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
            {missingCriticalFields.includes("business_name") && (
              <li>Business name</li>
            )}
            {missingCriticalFields.includes("business_description") && (
              <li>Business description</li>
            )}
          </ul>
        </div>
      )}

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
              disabled={investigating}
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {investigating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {investigating ? t("onboarding.step2.analysing") : t("onboarding.step2.autofillFromWebsite")}
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
            {t("onboarding.step2.importFromFile")}
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <label className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 truncate">
                  {selectedFile ? selectedFile.name : t("onboarding.step2.choosePdfOrWord")}
                </span>
                <input
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  onChange={handleFileSelect}
                  className="sr-only"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleFileAnalyse}
              disabled={fileStatus === "loading"}
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {fileStatus === "loading" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {fileStatus === "loading" ? t("onboarding.step2.analysing") : t("brandSettings.autoFillFromFile")}
              </span>
            </button>
          </div>

          {/* File validation error */}
          {fileError && (
            <p className="text-xs text-red-500 mt-2">{fileError}</p>
          )}

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
      <AIFilledField isAIFilled={aiFilledFields.includes("business_name")}>
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
      </AIFilledField>

      {/* Description */}
      <AIFilledField isAIFilled={aiFilledFields.includes("business_description")}>
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
      </AIFilledField>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          {ARTICLE_STYLE_OPTIONS.map((style) => {
            const isSelected = (data.article_styles ?? []).includes(style);
            return (
              <button
                key={style}
                type="button"
                onClick={() => toggleStyle(style)}
                className={`px-4 py-3 rounded-lg text-left transition-all border ${
                  isSelected
                    ? "bg-green-50 border-green-600 ring-2 ring-green-600 ring-opacity-20"
                    : "bg-white border-gray-200 hover:border-green-300 hover:bg-green-50/30"
                }`}
              >
                <div className={`text-sm font-medium ${isSelected ? "text-green-900" : "text-gray-900"}`}>
                  {t(`onboarding.step2.articleStyles.options.${style}`)}
                </div>
                <div className={`text-xs mt-0.5 ${isSelected ? "text-green-700" : "text-gray-500"}`}>
                  {t(`onboarding.step2.articleStyles.descriptions.${style}`)}
                </div>
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
          {uploading ? (
            <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : data.logo_url ? (
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
