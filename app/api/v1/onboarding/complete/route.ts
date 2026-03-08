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

function isLegacySchemaError(err: { message?: string; code?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return (
    (m.includes("tenant_id") && (m.includes("does not exist") || m.includes("undefined column"))) ||
    err.code === "42703"
  );
}

// ──────────────────────────────────────────────
// POST /api/v1/onboarding/complete
// Validates all required fields are present,
// then sets onboarding_status='completed' for the active workspace.
// Workspace name (tenants.name) is not updated from business_name here; they can diverge.
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

    // Fetch current profile for this workspace
    let profile: Record<string, unknown> | null = null;
    let fetchError: { code?: string; message?: string } | null = null;
    let completed: Record<string, unknown> | null = null;

    const fetchResult = await supabase
      .from("onboarding_profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .single();

    profile = fetchResult.data as Record<string, unknown> | null;
    fetchError = fetchResult.error;

    // Legacy schema: no tenant_id column — fetch by user_id only
    if (fetchError && isLegacySchemaError(fetchError)) {
      const legacyResult = await supabase
        .from("onboarding_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      profile = legacyResult.data as Record<string, unknown> | null;
      fetchError = legacyResult.error;
    }

    if (fetchError && fetchError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to fetch onboarding profile", details: fetchError.message },
        { status: 500 }
      );
    }

    if (profile) {
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

      // Mark as completed for this workspace (or user_id for legacy)
      const updatePayload = {
        onboarding_status: "completed",
        onboarding_completed_at: new Date().toISOString(),
      };
      let updateResult = await supabase
        .from("onboarding_profiles")
        .update(updatePayload)
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .select("*")
        .single();
      if (updateResult.error && isLegacySchemaError(updateResult.error)) {
        updateResult = await supabase
          .from("onboarding_profiles")
          .update(updatePayload)
          .eq("user_id", user.id)
          .select("*")
          .single();
      }
      completed = updateResult.data as Record<string, unknown> | null;
      if (updateResult.error) {
        return NextResponse.json(
          { error: "Failed to complete onboarding", details: updateResult.error.message },
          { status: 500 }
        );
      }
    } else {
      // No profile row exists for this workspace — create one as completed so user can launch
      const now = new Date().toISOString();
      const insertPayload = {
        tenant_id: tenantId,
        user_id: user.id,
        onboarding_status: "completed",
        onboarding_completed_at: now,
        onboarding_step: 5,
        business_name: "Un-Named",
        business_description: "Setup completed",
        content_language: "en",
        goals: ["generate_social_content"],
      };
      const insertResult = await supabase
        .from("onboarding_profiles")
        .insert(insertPayload)
        .select("*")
        .single();

      if (insertResult.error) {
        if (isLegacySchemaError(insertResult.error)) {
          const { tenant_id: _t, ...rest } = insertPayload as Record<string, unknown>;
          const legacyInsert = await supabase
            .from("onboarding_profiles")
            .insert(rest)
            .select("*")
            .single();
          if (legacyInsert.error) {
            return NextResponse.json(
              { error: "Failed to complete onboarding", details: legacyInsert.error.message },
              { status: 500 }
            );
          }
          completed = legacyInsert.data as Record<string, unknown>;
        } else {
          return NextResponse.json(
            { error: "Failed to complete onboarding", details: insertResult.error.message },
            { status: 500 }
          );
        }
      } else {
        completed = insertResult.data as Record<string, unknown>;
      }
    }

    return NextResponse.json({ data: completed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
