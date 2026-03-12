import { notFound } from "next/navigation";
import type { Metadata } from "next";
import TeaserReportClient from "@/components/analyzer/TeaserReportClient";

interface PageProps {
  params: Promise<{ locale: string; analysisId: string }>;
}

const ANALYSIS_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { analysisId } = await params;
  if (!ANALYSIS_ID_RE.test(analysisId)) return {};

  return {
    title: "Your Social Profile Analysis | ZARZOOM",
    description:
      "See your AI-generated Creator Score, profile strengths, growth opportunities, and a personalised content strategy.",
    openGraph: {
      title: "Your Social Profile Analysis",
      description: "Creator Score + AI Growth Strategy — powered by ZARZOOM",
      type: "website",
    },
  };
}

/**
 * Server component — validates the analysisId then delegates
 * all data fetching + polling to the client wrapper.
 */
export default async function AnalyzerResultPage({ params }: PageProps) {
  const { analysisId } = await params;

  if (!ANALYSIS_ID_RE.test(analysisId)) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background font-sans">
      {/* Background texture */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(22,163,74,0.07) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 px-4 py-10 sm:py-14 flex flex-col items-center gap-6">
        {/* ZARZOOM wordmark */}
        <a
          href="/"
          className="flex items-center gap-2 mb-2"
          aria-label="Go to ZARZOOM homepage"
        >
          <span className="text-lg font-black tracking-tight text-foreground">
            ZAR<span className="text-green-600">ZOOM</span>
          </span>
        </a>

        <TeaserReportClient analysisId={analysisId} />
      </div>
    </main>
  );
}
