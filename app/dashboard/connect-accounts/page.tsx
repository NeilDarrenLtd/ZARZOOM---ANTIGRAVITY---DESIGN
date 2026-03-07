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

  return (
    <>
      <SiteNavbar />
      <main
        className="flex flex-col"
        style={{
          minHeight:
            "calc(100vh - var(--navbar-height, 64px) - var(--footer-height, 0px))",
        }}
      >
        <div className="max-w-5xl mx-auto w-full px-4 pt-8 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        <HybridUploadPostConnect returnTo={returnTo} />
      </main>
      <Footer />
    </>
  );
}
