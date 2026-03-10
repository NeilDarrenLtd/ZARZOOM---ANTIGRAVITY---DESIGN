import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import HybridUploadPostConnect from "@/components/connect/HybridUploadPostConnect";
import { sanitizeReturnTo } from "@/lib/upload-post/returnTo";
import { getServerTranslations } from "@/lib/i18n/server";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value ?? "en";
  const t = await getServerTranslations(locale);
  return {
    title: t("connect.connectAccounts"),
    description: t("connect.subheading"),
  };
}

export default async function ConnectAccountsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = typeof params.returnTo === "string" ? params.returnTo : "";
  const returnTo = sanitizeReturnTo(raw);

  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value ?? "en";
  const t = await getServerTranslations(locale);

  return (
    <main className="bg-gray-50 min-h-screen flex flex-col">
      <SiteNavbar />

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("connect.backToDashboard")}
        </Link>

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {t("connect.pageTitle")}
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            {t("connect.pageDescription")}
          </p>
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="px-6 py-8 sm:px-8">
            <HybridUploadPostConnect returnTo={returnTo} />
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
