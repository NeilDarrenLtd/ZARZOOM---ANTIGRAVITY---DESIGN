import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n";
import { getServerTranslations } from "@/lib/i18n/server";
import { DEFAULT_LOCALE, isRoutedLocale } from "@/lib/i18n/routing";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolved = isRoutedLocale(locale) ? locale : DEFAULT_LOCALE;
  const t = await getServerTranslations(resolved);
  const title = t("meta.title");
  const description = t("meta.description");
  const ogLocale = resolved === "en" ? "en_US" : "fr_FR";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      locale: ogLocale,
      type: "website",
      siteName: "ZARZOOM",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isRoutedLocale(locale)) {
    notFound();
  }

  return (
    <I18nProvider initialLocale={locale}>
      {children}
    </I18nProvider>
  );
}
