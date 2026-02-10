import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

const inter = Inter({ subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "greek", "greek-ext", "vietnamese"] });

export const metadata: Metadata = {
  title: "ZARZOOM - Social Media Autopilot",
  description:
    "Automate your social media growth with AI-powered content generation and scheduling. ZARZOOM helps you generate, schedule, and post across all social platforms on autopilot.",
  keywords: [
    "social media automation",
    "AI content generation",
    "social media scheduling",
    "autopilot social media",
    "social media growth",
    "ZARZOOM",
  ],
  openGraph: {
    title: "ZARZOOM - Social Media Autopilot",
    description:
      "Automate your social media growth with AI-powered content generation and scheduling.",
    type: "website",
    siteName: "ZARZOOM",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZARZOOM - Social Media Autopilot",
    description:
      "Automate your social media growth with AI-powered content generation and scheduling.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
