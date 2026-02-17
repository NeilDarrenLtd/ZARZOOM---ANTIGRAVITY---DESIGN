import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { onboardingCompleteSchema } from "@/lib/validation/onboarding";

// ──────────────────────────────────────────────
// POST /api/v1/onboarding/complete
// Validates all required fields are present,
// then sets onboarding_status='completed'.
// ──────────────────────────────────────────────

export async function POST() {
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

    // Fetch current profile
    const { data: profile, error: fetchError } = await supabase
      .from("onboarding_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json(
        { error: "Onboarding profile not found. Please start onboarding first." },
        { status: 404 }
      );
    }

    // Validate that all required fields are filled
    const completionCheck = onboardingCompleteSchema.safeParse({
      business_name: profile.business_name,
      business_description: profile.business_description,
      content_language: profile.content_language,
      goals: profile.goals,
      website_or_landing_url: profile.website_or_landing_url,
      product_or_sales_url: profile.product_or_sales_url,
    });

    if (!completionCheck.success) {
      return NextResponse.json(
        {
          error: "Onboarding is incomplete. Please fill in all required fields.",
          issues: completionCheck.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 422 }
      );
    }

    // Mark as completed
    const { data: completed, error: updateError } = await supabase
      .from("onboarding_profiles")
      .update({
        onboarding_status: "completed",
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to complete onboarding", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: completed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
