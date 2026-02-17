"use client";

import { useState } from "react";
import { useI18n, languages } from "@/lib/i18n";
import { Search, Plus, X, Upload, Loader2 } from "lucide-react";
import { ARTICLE_STYLE_OPTIONS } from "@/lib/validation/onboarding";
import type { OnboardingUpdate } from "@/lib/validation/onboarding";

interface Step2Props {
  data: OnboardingUpdate;
  onChange: (patch: Partial<OnboardingUpdate>) => void;
}

export default function Step2Brand({ data, onChange }: Step2Props) {
  const { t } = useI18n();
  const [investigating, setInvestigating] = useState(false);
  const [investigateResult, setInvestigateResult] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [uploading, setUploading] = useState(false);
  const [urlError, setUrlError] = useState("");

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
    setInvestigateResult("idle");

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
        if (body.data.business_description && !data.business_description) {
          patch.business_description = body.data.business_description;
        }
        if (body.data.suggested_styles) {
          patch.article_styles = body.data.suggested_styles;
        }
        onChange(patch);
        setInvestigateResult("success");
      }
    } catch {
      setInvestigateResult("error");
    } finally {
      setInvestigating(false);
    }
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {t("onboarding.step2.title")}
        </h2>
        <p className="text-gray-500 text-sm mt-1 leading-relaxed">
          {t("onboarding.step2.subtitle")}
        </p>
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

      {/* Website URL + Investigate */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t("onboarding.step2.websiteUrl.label")}
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={data.website_url ?? ""}
            onChange={(e) => {
              onChange({ website_url: e.target.value || null });
              validateWebsiteUrl(e.target.value);
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
              <Search className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {investigating
                ? t("onboarding.step2.investigate.loading")
                : t("onboarding.step2.investigate.button")}
            </span>
          </button>
        </div>
        {investigateResult === "success" && (
          <p className="text-xs text-green-600 mt-1">
            {t("onboarding.step2.investigate.success")}
          </p>
        )}
        {investigateResult === "error" && (
          <p className="text-xs text-red-500 mt-1">
            {t("onboarding.step2.investigate.error")}
          </p>
        )}
        {urlError && (
          <p className="text-xs text-red-500 mt-1">{urlError}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          {t("onboarding.step2.websiteUrl.help")}
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

      {/* Investigate overlay */}
      {investigating && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-xl max-w-sm mx-4">
            <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
            <p className="text-sm font-medium text-gray-900">
              {t("onboarding.step2.investigate.loading")}
            </p>
            <p className="text-xs text-gray-400 text-center">
              {t("onboarding.step2.websiteUrl.help")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
