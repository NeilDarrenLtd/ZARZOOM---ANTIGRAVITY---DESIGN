import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ──────────────────────────────────────────────
// POST /api/v1/onboarding/restart
// Resets onboarding so the user can redo the wizard.
// Sets status → in_progress, step → 1, clears completed_at.
// ──────────────────────────────────────────────

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("onboarding_profiles")
      .update({
        onboarding_status: "in_progress",
        onboarding_step: 1,
        onboarding_completed_at: null,
      })
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError) {
      // If no row exists, create one
      if (updateError.code === "PGRST116") {
        const { data: created, error: insertError } = await supabase
          .from("onboarding_profiles")
          .insert({
            user_id: user.id,
            onboarding_status: "in_progress",
            onboarding_step: 1,
          })
          .select("*")
          .single();

        if (insertError) {
          return NextResponse.json(
            { error: "Failed to restart onboarding", details: insertError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ data: created });
      }

      return NextResponse.json(
        { error: "Failed to restart onboarding", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
