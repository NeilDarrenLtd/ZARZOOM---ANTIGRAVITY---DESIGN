import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ──────────────────────────────────────────────
// POST /api/v1/onboarding/skip
// Sets onboarding_status='skipped' and stores
// the current step the user was on.
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

    // Optionally accept current step from the request body
    let currentStep: number | null = null;
    try {
      const body = await request.json();
      if (body.onboarding_step && typeof body.onboarding_step === "number") {
        currentStep = Math.min(Math.max(body.onboarding_step, 1), 5);
      }
    } catch {
      // Body is optional for skip
    }

    const updateData: Record<string, unknown> = {
      onboarding_status: "skipped",
    };

    if (currentStep !== null) {
      updateData.onboarding_step = currentStep;
    }

    // Try update first
    const { data: updated, error: updateError } = await supabase
      .from("onboarding_profiles")
      .update(updateData)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError) {
      // If no row exists, create one with skipped status
      if (updateError.code === "PGRST116") {
        const { data: created, error: createError } = await supabase
          .from("onboarding_profiles")
          .insert({
            user_id: user.id,
            ...updateData,
          })
          .select("*")
          .single();

        if (createError) {
          return NextResponse.json(
            { error: "Failed to skip onboarding", details: createError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ data: created });
      }

      return NextResponse.json(
        { error: "Failed to skip onboarding", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
