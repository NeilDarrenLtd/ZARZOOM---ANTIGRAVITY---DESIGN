import { Suspense } from "react";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import UploadPostConnectFrame from "@/components/connect/UploadPostConnectFrame";
import { sanitizeReturnTo } from "@/lib/upload-post/returnTo";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: "Connect Accounts",
  description: "Link your social media accounts.",
};

export default async function ConnectAccountsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = typeof params.returnTo === "string" ? params.returnTo : "";
  const returnTo = sanitizeReturnTo(raw);

  return (
    <>
      <SiteNavbar />
      <main className="flex flex-col" style={{ minHeight: "calc(100vh - var(--navbar-height, 64px) - var(--footer-height, 0px))" }}>
        <Suspense>
          <UploadPostConnectFrame returnTo={returnTo} />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
