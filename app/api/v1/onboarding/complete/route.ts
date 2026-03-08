import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { onboardingCompleteSchema } from "@/lib/validation/onboarding";

async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  request: NextRequest
): Promise<string | null> {
  const tenantId = request.headers.get("x-tenant-id")?.trim();
  if (!tenantId) return null;
  const { data } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.tenant_id ?? null;
}

// ──────────────────────────────────────────────
// POST /api/v1/onboarding/complete
// Validates all required fields are present,
// then sets onboarding_status='completed' for the active workspace.
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
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

    const tenantId = await resolveTenantId(supabase, user.id, request);
    if (!tenantId) {
      return NextResponse.json(
        { error: "Workspace context required. Send X-Tenant-Id header." },
        { status: 400 }
      );
    }

    const { data: profile, error: fetchError } = await supabase
      .from("onboarding_profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch onboarding profile", details: fetchError.message },
        { status: 500 }
      );
    }

    let completed: Record<string, unknown> | null = null;

    if (profile) {
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

      const updatePayload = {
        onboarding_status: "completed",
        onboarding_completed_at: new Date().toISOString(),
      };
      const { data: updatedProfile, error: updateError } = await supabase
        .from("onboarding_profiles")
        .update(updatePayload)
        .eq("tenant_id", tenantId)
        .select("*")
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to complete onboarding", details: updateError.message },
          { status: 500 }
        );
      }
      completed = updatedProfile as Record<string, unknown>;
    } else {
      // No profile row exists -- create one as completed so user can launch
      const insertPayload = {
        tenant_id: tenantId,
        user_id: user.id,
        onboarding_status: "completed",
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step: 5,
        business_name: "Un-Named",
        business_description: "Setup completed",
        content_language: "en",
        goals: ["generate_social_content"],
      };
      const { data: inserted, error: insertError } = await supabase
        .from("onboarding_profiles")
        .insert(insertPayload)
        .select("*")
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: "Failed to complete onboarding", details: insertError.message },
          { status: 500 }
        );
      }
      completed = inserted as Record<string, unknown>;
    }

    return NextResponse.json({ data: completed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
