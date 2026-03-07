import { cookies } from "next/headers";
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
        <HybridUploadPostConnect returnTo={returnTo} />
      </main>
      <Footer />
    </>
  );
}
