"use client";

import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SiteNavbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
