import { Suspense } from "react";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import UploadPostConnectFrame from "@/components/connect/UploadPostConnectFrame";
import HybridUploadPostConnect from "@/components/connect/HybridUploadPostConnect";
import { sanitizeReturnTo } from "@/lib/upload-post/returnTo";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: "Connect Accounts",
  description: "Link your social media accounts.",
};

// Supported modes:
//   "hybrid"        – new flow (default)
//   "iframe_legacy" – existing iframe flow
const CONNECT_MODE =
  (process.env.UPLOAD_POST_CONNECT_MODE ?? "hybrid") === "iframe_legacy"
    ? "iframe_legacy"
    : "hybrid";

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
        {CONNECT_MODE === "iframe_legacy" ? (
          <Suspense>
            <UploadPostConnectFrame returnTo={returnTo} />
          </Suspense>
        ) : (
          <HybridUploadPostConnect returnTo={returnTo} />
        )}
      </main>
      <Footer />
    </>
  );
}
