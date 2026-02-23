"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

interface DynamicSEOProps {
  title?: string;
  description?: string;
}

export default function DynamicSEO({ title, description }: DynamicSEOProps) {
  const { locale, t } = useI18n();

  useEffect(() => {
    const pageTitle = title || t("meta.title");
    const pageDescription = description || t("meta.description");

    document.title = pageTitle;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", pageDescription);
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute("content", pageTitle);
    }

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute("content", pageDescription);
    }

    document.documentElement.lang = locale;
  }, [locale, t, title, description]);

  return null;
}
