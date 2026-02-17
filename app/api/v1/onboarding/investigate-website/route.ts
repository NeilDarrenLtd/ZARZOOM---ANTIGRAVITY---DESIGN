import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ──────────────────────────────────────────────
// POST /api/v1/onboarding/investigate-website
// Stub: simulates website analysis. In the future,
// this will crawl the URL and extract brand info.
// ──────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const url = body.url;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "A valid URL is required" },
        { status: 422 }
      );
    }

    // Simulate a 2-second analysis delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Return mock data — replace with real scraper in the future
    return NextResponse.json({
      data: {
        website_url: url,
        business_description:
          "An innovative company delivering cutting-edge solutions to help businesses grow their online presence and reach new audiences.",
        suggested_styles: ["how_to_guides", "case_studies"],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
