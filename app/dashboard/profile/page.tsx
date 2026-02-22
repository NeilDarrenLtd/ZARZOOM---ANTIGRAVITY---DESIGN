"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n, languages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import {
  ARTICLE_STYLE_OPTIONS,
  GOAL_OPTIONS,
  PLAN_OPTIONS,
} from "@/lib/validation/onboarding";
import type { OnboardingUpdate, Goal, Plan } from "@/lib/validation/onboarding";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import DynamicSEO from "@/components/DynamicSEO";
import UploadPostConnectModal from "@/components/social/UploadPostConnectModal";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Plus,
  X,
  Upload,
  Loader2,
  Check,
  ExternalLink,
  CheckCircle2,
  Circle,
  Globe,
  Users,
  ShoppingBag,
  TrendingUp,
  Award,
  BookOpen,
  Share2,
  Sparkles,
  FileText,
  AlertCircle,
} from "lucide-react";

// ── Goal icons (matches Step3) ────────────────────────────
const GOAL_ICONS: Record<Goal, React.ReactNode> = {
  increase_website_traffic: <Globe className="w-5 h-5" />,
  get_more_subscribers_leads: <Users className="w-5 h-5" />,
  promote_product_or_service: <ShoppingBag className="w-5 h-5" />,
  increase_sales: <TrendingUp className="w-5 h-5" />,
  build_brand_authority: <Award className="w-5 h-5" />,
  improve_seo: <Search className="w-5 h-5" />,
  educate_audience: <BookOpen className="w-5 h-5" />,
  generate_social_content: <Share2 className="w-5 h-5" />,
};

// ── Plan pricing (matches Step4) ──────────────────────────
const PLAN_PRICES: Record<Plan, { monthly: number; annual: number }> = {
  basic: { monthly: 29, annual: 290 },
  pro: { monthly: 79, annual: 790 },
  scale: { monthly: 199, annual: 1990 },
};

const PLAN_FEATURES: Record<Plan, string[]> = {
  basic: [
    "onboarding.step4.features.basic.socialProfiles",
    "onboarding.step4.features.basic.postsPerMonth",
    "onboarding.step4.features.basic.aiGeneration",
    "onboarding.step4.features.basic.scheduling",
    "onboarding.step4.features.basic.emailSupport",
  ],
  pro: [
    "onboarding.step4.features.pro.socialProfiles",
    "onboarding.step4.features.pro.postsPerMonth",
    "onboarding.step4.features.pro.aiGeneration",
    "onboarding.step4.features.pro.scheduling",
    "onboarding.step4.features.pro.analytics",
    "onboarding.step4.features.pro.prioritySupport",
  ],
  scale: [
    "onboarding.step4.features.scale.socialProfiles",
    "onboarding.step4.features.scale.postsPerMonth",
    "onboarding.step4.features.scale.aiGeneration",
    "onboarding.step4.features.scale.scheduling",
    "onboarding.step4.features.scale.analytics",
    "onboarding.step4.features.scale.customBranding",
    "onboarding.step4.features.scale.dedicatedSupport",
    "onboarding.step4.features.scale.apiAccess",
  ],
};

// ── Shared input class ────────────────────────────────────
const inputClass =
  "w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors text-sm";

export default function ProfilePage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [data, setData] = useState<OnboardingUpdate>({});
  const [showModal, setShowModal] = useState(false);
  const [investigating, setInvestigating] = useState(false);
  const [websiteStatus, setWebsiteStatus] = useState<"idle" | "loading" | "success" | "partial" | "error">("idle");
  const [fileStatus, setFileStatus] = useState<"idle" | "loading" | "success" | "partial" | "error">("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // ── Load profile ────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/onboarding");
        if (!res.ok) throw new Error("load failed");
        const body = await res.json();
        setData(body.data ?? {});
      } catch {
        showToast("error", t("profile.loadFailed"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [t]);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const onChange = useCallback((patch: Partial<OnboardingUpdate>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Save ────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "save failed");
      }
      const body = await res.json();
      setData(body.data ?? data);
      showToast("success", t("profile.saved"));
    } catch {
      showToast("error", t("profile.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  // ── Reload data from server ─────────────────────────────
  async function reloadProfileData() {
    try {
      const res = await fetch("/api/v1/onboarding");
      if (!res.ok) throw new Error("reload failed");
      const body = await res.json();
      setData(body.data ?? {});
    } catch {
      // silently fail
    }
  }

  // ── Auto-fill from website (matches wizard) ────────────
  async function handleInvestigate() {
    if (!data.website_url) return;
    setInvestigating(true);
    setWebsiteStatus("loading");

    try {
      const res = await fetch("/api/v1/onboarding/autofill/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: data.website_url }),
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error || body.message || "Failed to analyze website");
      }

      if (body.status === "success" || body.status === "partial") {
        await reloadProfileData();
        setWebsiteStatus(body.status);
      } else {
        setWebsiteStatus("error");
      }
    } catch {
      setWebsiteStatus("error");
    } finally {
      setInvestigating(false);
    }
  }

  // ── File select handler (matches wizard) ───────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setFileStatus("error");
      alert(`File size exceeds maximum of 10MB. Selected file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

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

  // ── Analyse file (matches wizard) ──────────────────────
  async function handleFileAnalyse() {
    if (!selectedFile) return;
    setFileStatus("loading");

    try {
      // Step 1: Upload and extract text
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadRes = await fetch("/api/v1/onboarding/upload-file", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorBody = await uploadRes.json();
        throw new Error(errorBody.error || "Failed to upload file");
      }

      const uploadBody = await uploadRes.json();

      if (!uploadBody.success || !uploadBody.data) {
        throw new Error("Failed to extract text from file");
      }

      // Step 2: Analyze with OpenRouter
      const analyzeRes = await fetch("/api/v1/onboarding/autofill/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageFilePath: uploadBody.data.storagePath,
          extractedText: uploadBody.data.extractedText,
          fileName: selectedFile.name,
        }),
      });

      const analyzeBody = await analyzeRes.json();

      if (!analyzeRes.ok) {
        throw new Error(analyzeBody.error || analyzeBody.message || "Failed to analyze file");
      }

      if (analyzeBody.status === "success" || analyzeBody.status === "partial") {
        await reloadProfileData();
        setFileStatus(analyzeBody.status);
      } else {
        setFileStatus("error");
      }
    } catch {
      setFileStatus("error");
    }
  }

  // ── Style helpers ───────────────────────────────────────
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
    if (current.length < 3) onChange({ article_style_links: [...current, ""] });
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
    const url = URL.createObjectURL(file);
    onChange({ logo_url: url });
    setUploading(false);
  }

  // ── Goal helpers ────────────────────────────────────────
  const goals = data.goals ?? [];

  function toggleGoal(goal: Goal) {
    if (goals.includes(goal)) {
      onChange({ goals: goals.filter((g) => g !== goal) });
    } else {
      onChange({ goals: [...goals, goal] });
    }
  }

  const needsWebsite =
    goals.includes("increase_website_traffic") || goals.includes("get_more_subscribers_leads");
  const needsProduct =
    goals.includes("promote_product_or_service") || goals.includes("increase_sales");

  // ── Plan helpers ────────────────────────────────────────
  const isAnnual = data.discount_opt_in !== false;
  const selectedPlan = data.selected_plan ?? null;

  // ── Social modal ────────────────────────────────────────
  const handleModalClose = useCallback(
    async (connected: boolean) => {
      setShowModal(false);
      if (connected) {
        onChange({ socials_connected: true });
        return;
      }
      try {
        const res = await fetch("/api/v1/onboarding/social-connect/status");
        if (res.ok) {
          const body = await res.json();
          if (body.data?.connected) onChange({ socials_connected: true });
        }
      } catch {
        // silently ignore
      }
    },
    [onChange]
  );

  // ── Loading state ───────────────────────────────────────
  if (loading) {
    return (
      <main className="bg-gray-50 min-h-screen flex flex-col">
        <SiteNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <DynamicSEO />
      <SiteNavbar />

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard"
            className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            aria-label={t("profile.back")}
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{t("profile.title")}</h1>
            <p className="text-gray-500 mt-1 text-sm">{t("profile.subtitle")}</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50 tracking-wide uppercase"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("profile.saving")}
              </>
            ) : (
              t("profile.save")
            )}
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
              toast.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <X className="w-4 h-4 flex-shrink-0" />
            )}
            {toast.message}
          </div>
        )}

        <div className="flex flex-col gap-8">
          {/* ───────── SECTION 1: Brand Basics ───────── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              {t("profile.sections.brand")}
            </h2>
            <p className="text-xs text-gray-400 mb-6">{t("profile.sections.brandDesc")}</p>

            <div className="flex flex-col gap-5">
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

              {/* Website URL + Auto-fill (matches wizard layout) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  {t("onboarding.step2.websiteUrl.label")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={data.website_url ?? ""}
                    onChange={(e) => {
                      onChange({ website_url: e.target.value || null });
                      setWebsiteStatus("idle");
                    }}
                    className={`${inputClass} flex-1`}
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
                      {"We couldn't get everything. Please complete the remaining fields below."}
                    </p>
                  </div>
                )}
                {websiteStatus === "error" && (
                  <div className="flex items-start gap-2 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-700">
                      {"We couldn't analyse that right now. Please try again or fill in manually."}
                    </p>
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-2">
                  {t("onboarding.step2.websiteUrl.help")}
                </p>
              </div>

              {/* Import from file (matches wizard layout) */}
              <div className="pt-5 border-t border-gray-200">
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
                      {"We couldn't get everything. Please complete the remaining fields below."}
                    </p>
                  </div>
                )}
                {fileStatus === "error" && (
                  <div className="flex items-start gap-2 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-700">
                      {"We couldn't analyse that right now. Please try again or fill in manually."}
                    </p>
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-2">
                  Upload a PDF/Word document and we'll try to auto-fill your brand settings.
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
              </div>
            </div>
          </section>

          {/* ───────── SECTION 2: Goals & Growth ───────── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              {t("profile.sections.goals")}
            </h2>
            <p className="text-xs text-gray-400 mb-6">{t("profile.sections.goalsDesc")}</p>

            <div className="flex flex-col gap-5">
              {/* Goal grid */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  {t("onboarding.step3.goals.label")}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {GOAL_OPTIONS.map((goal) => {
                    const isSelected = goals.includes(goal);
                    return (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => toggleGoal(goal)}
                        className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "border-green-500 bg-green-50 ring-1 ring-green-500/20"
                            : "border-gray-200 bg-white hover:border-green-300"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isSelected ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {GOAL_ICONS[goal]}
                        </div>
                        <span
                          className={`text-sm font-medium ${
                            isSelected ? "text-green-700" : "text-gray-700"
                          }`}
                        >
                          {t(`onboarding.step3.goals.options.${goal}`)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {t("onboarding.step3.goals.help")}
                </p>
              </div>

              {/* Conditional: Website URL */}
              {needsWebsite && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t("onboarding.step3.websiteUrl.label")}
                  </label>
                  <input
                    type="url"
                    value={data.website_or_landing_url ?? ""}
                    onChange={(e) =>
                      onChange({ website_or_landing_url: e.target.value || null })
                    }
                    className={inputClass}
                    placeholder={t("onboarding.step3.websiteUrl.placeholder")}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {t("onboarding.step3.websiteUrl.help")}
                  </p>
                </div>
              )}

              {/* Conditional: Product URL */}
              {needsProduct && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t("onboarding.step3.productUrl.label")}
                  </label>
                  <input
                    type="url"
                    value={data.product_or_sales_url ?? ""}
                    onChange={(e) =>
                      onChange({ product_or_sales_url: e.target.value || null })
                    }
                    className={inputClass}
                    placeholder={t("onboarding.step3.productUrl.placeholder")}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {t("onboarding.step3.productUrl.help")}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ───────── SECTION 3: Posting Preferences ───────── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              {t("profile.sections.posting")}
            </h2>
            <p className="text-xs text-gray-400 mb-6">{t("profile.sections.postingDesc")}</p>

            <div className="flex flex-col gap-5">
              {/* Auto-publish toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t("profile.fields.autoPublish.label")}
                  </label>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t("profile.fields.autoPublish.help")}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.auto_publish ?? false}
                    onChange={(e) => onChange({ auto_publish: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
                </label>
              </div>

              {/* Approval preference */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  {t("onboarding.step5.approval.label")}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onChange({ approval_preference: "auto" })}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      data.approval_preference === "auto"
                        ? "border-green-500 bg-green-50 ring-1 ring-green-500/20"
                        : "border-gray-200 bg-white hover:border-green-300"
                    }`}
                  >
                    <p
                      className={`text-sm font-semibold ${
                        data.approval_preference === "auto" ? "text-green-700" : "text-gray-700"
                      }`}
                    >
                      {t("onboarding.step5.approval.auto")}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {t("onboarding.step5.approval.autoHelp")}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ approval_preference: "manual" })}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      data.approval_preference === "manual"
                        ? "border-green-500 bg-green-50 ring-1 ring-green-500/20"
                        : "border-gray-200 bg-white hover:border-green-300"
                    }`}
                  >
                    <p
                      className={`text-sm font-semibold ${
                        data.approval_preference === "manual" ? "text-green-700" : "text-gray-700"
                      }`}
                    >
                      {t("onboarding.step5.approval.manual")}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {t("onboarding.step5.approval.manualHelp")}
                    </p>
                  </button>
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t("onboarding.step5.notes.label")}
                </label>
                <textarea
                  value={data.additional_notes ?? ""}
                  onChange={(e) => onChange({ additional_notes: e.target.value || null })}
                  className={`${inputClass} resize-none`}
                  rows={4}
                  placeholder={t("onboarding.step5.notes.placeholder")}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {t("onboarding.step5.notes.help")}
                </p>
              </div>
            </div>
          </section>

          {/* ───────── SECTION 4: Your Plan ��──────── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              {t("profile.sections.plan")}
            </h2>
            <p className="text-xs text-gray-400 mb-6">{t("profile.sections.planDesc")}</p>

            {/* Current plan summary */}
            {selectedPlan && (
              <div className="mb-5 p-4 rounded-xl border border-green-200 bg-green-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-600 font-medium">
                      {t("profile.plan.current")}
                    </p>
                    <p className="text-lg font-bold text-green-800 mt-0.5">
                      {t(`onboarding.step4.planNames.${selectedPlan}`)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-800">
                      {t("onboarding.a11y.currency")}
                      {isAnnual
                        ? Math.round(PLAN_PRICES[selectedPlan].annual / 12)
                        : PLAN_PRICES[selectedPlan].monthly}
                    </p>
                    <p className="text-xs text-green-600">
                      {t("onboarding.step4.perMonth")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!selectedPlan && (
              <p className="text-sm text-gray-500 mb-5">{t("profile.plan.noPlan")}</p>
            )}

            {/* Annual toggle */}
            <div className="flex items-center gap-3 mb-5">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnnual}
                  onChange={(e) => onChange({ discount_opt_in: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
              </label>
              <span className="text-sm font-medium text-gray-700">
                {t("profile.plan.annualBilling")}
              </span>
              {isAnnual && (
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  {t("onboarding.step4.discount.save").replace("{percent}", "17")}
                </span>
              )}
            </div>

            {/* Plan cards */}
            <div className="grid gap-4 lg:grid-cols-3">
              {PLAN_OPTIONS.map((plan) => {
                const isSelected = selectedPlan === plan;
                const isPopular = plan === "pro";
                const displayPrice = isAnnual
                  ? Math.round(PLAN_PRICES[plan].annual / 12)
                  : PLAN_PRICES[plan].monthly;

                return (
                  <div
                    key={plan}
                    className={`relative flex flex-col rounded-2xl border p-5 transition-all cursor-pointer ${
                      isSelected
                        ? "border-green-500 bg-white shadow-lg ring-1 ring-green-500/20"
                        : isPopular
                          ? "border-green-300 bg-white shadow-md"
                          : "border-gray-200 bg-white hover:border-green-300"
                    }`}
                    onClick={() => onChange({ selected_plan: plan })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && onChange({ selected_plan: plan })}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-green-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                          {t("onboarding.step4.popular")}
                        </span>
                      </div>
                    )}

                    <h3 className="text-base font-bold text-gray-900">
                      {t(`onboarding.step4.planNames.${plan}`)}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {t(`onboarding.step4.planDescriptions.${plan}`)}
                    </p>

                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-gray-900">
                        {t("onboarding.a11y.currency")}{displayPrice}
                      </span>
                      <span className="text-xs text-gray-400">
                        {t("onboarding.step4.perMonth")}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={`mt-3 w-full py-2 rounded-lg text-xs font-bold transition-colors ${
                        isSelected
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {isSelected
                        ? t("onboarding.step4.selected")
                        : t("onboarding.step4.selectPlan")}
                    </button>

                    <ul className="mt-4 flex flex-col gap-2 flex-1">
                      {PLAN_FEATURES[plan].map((fKey) => (
                        <li key={fKey} className="flex items-start gap-2">
                          <Check
                            className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                              isSelected || isPopular ? "text-green-600" : "text-gray-400"
                            }`}
                          />
                          <span className="text-xs text-gray-600 leading-relaxed">{t(fKey)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ───────── SECTION 5: Social Connections ───────── */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              {t("profile.sections.social")}
            </h2>
            <p className="text-xs text-gray-400 mb-6">{t("profile.sections.socialDesc")}</p>

            <div className="flex flex-col gap-4">
              {/* Username */}
              {data.uploadpost_profile_username && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-700">
                    {t("profile.social.username")}:
                  </span>
                  <code className="px-2 py-0.5 rounded bg-gray-100 text-xs font-mono">
                    {data.uploadpost_profile_username}
                  </code>
                </div>
              )}

              {/* Connection status */}
              <div className="flex items-center gap-3">
                {data.socials_connected ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300" />
                )}
                <span
                  className={`text-sm ${
                    data.socials_connected ? "text-green-700 font-medium" : "text-gray-500"
                  }`}
                >
                  {data.socials_connected
                    ? t("profile.social.connected")
                    : t("profile.social.notConnected")}
                </span>
              </div>

              {/* Connect / Manage button */}
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors w-fit"
              >
                <ExternalLink className="w-4 h-4" />
                {data.socials_connected
                  ? t("profile.social.manage")
                  : t("profile.social.connect")}
              </button>
            </div>
          </section>

          {/* Bottom save */}
          <div className="flex justify-end pb-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50 tracking-wide uppercase"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("profile.saving")}
                </>
              ) : (
                t("profile.save")
              )}
            </button>
          </div>
        </div>
      </div>

      <Footer />

      {/* Upload-Post connect modal */}
      <UploadPostConnectModal open={showModal} onClose={handleModalClose} />

      {/* Investigate overlay */}
      {investigating && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-xl max-w-sm mx-4">
            <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
            <p className="text-sm font-medium text-gray-900">
              {t("onboarding.step2.investigate.loading")}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
