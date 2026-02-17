import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { onboardingUpdateSchema } from "@/lib/validation/onboarding";

// ──────────────────────────────────────────────
// GET /api/v1/onboarding
// Returns the current user's onboarding profile.
// If no row exists, creates one with defaults.
// ──────────────────────────────────────────────

export async function GET() {
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

    // Try to fetch existing row
    const { data: profile, error: fetchError } = await supabase
      .from("onboarding_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = "no rows returned" which is expected for new users
      return NextResponse.json(
        { error: "Failed to fetch onboarding profile", details: fetchError.message },
        { status: 500 }
      );
    }

    // If profile exists, return it
    if (profile) {
      return NextResponse.json({ data: profile });
    }

    // No profile yet — create one with defaults
    const { data: newProfile, error: insertError } = await supabase
      .from("onboarding_profiles")
      .insert({
        user_id: user.id,
        onboarding_status: "not_started",
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create onboarding profile", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: newProfile }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// PUT /api/v1/onboarding
// Validates payload with Zod, applies conditional
// requirements, then updates the row.
// ──────────────────────────────────────────────

export async function PUT(request: Request) {
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

    // Validate with Zod (includes conditional goal-based validation)
    const parsed = onboardingUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 422 }
      );
    }

    // ── Fetch current status before updating ──────────────
    // We must NOT regress status from "completed" or "skipped"
    // back to "in_progress" when the profile page saves edits.
    const { data: currentProfile } = await supabase
      .from("onboarding_profiles")
      .select("onboarding_status")
      .eq("user_id", user.id)
      .single();

    const currentStatus = currentProfile?.onboarding_status;
    const preserveStatus =
      currentStatus === "completed" || currentStatus === "skipped";

    // Build the update payload
    const updateData: Record<string, unknown> = {
      ...parsed.data,
      // Only set in_progress if the current status isn't already
      // completed or skipped (i.e. don't regress)
      ...(preserveStatus
        ? {}
        : { onboarding_status: "in_progress" }),
    };

    // If a step is provided, track it
    if (parsed.data.onboarding_step) {
      updateData.onboarding_step = parsed.data.onboarding_step;
    }

    const { data: updated, error: updateError } = await supabase
      .from("onboarding_profiles")
      .update(updateData)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError) {
      // If no row exists yet, upsert instead
      if (updateError.code === "PGRST116") {
        const { data: upserted, error: upsertError } = await supabase
          .from("onboarding_profiles")
          .upsert({
            user_id: user.id,
            ...updateData,
          })
          .select("*")
          .single();

        if (upsertError) {
          return NextResponse.json(
            { error: "Failed to save onboarding data", details: upsertError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ data: upserted });
      }

      return NextResponse.json(
        { error: "Failed to update onboarding profile", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
