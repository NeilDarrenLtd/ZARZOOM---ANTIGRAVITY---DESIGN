"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

export default function DynamicSEO() {
  const { locale, t } = useI18n();

  useEffect(() => {
    document.title = t("meta.title");

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", t("meta.description"));
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute("content", t("meta.title"));
    }

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute("content", t("meta.description"));
    }

    document.documentElement.lang = locale;
  }, [locale, t]);

  return null;
}
