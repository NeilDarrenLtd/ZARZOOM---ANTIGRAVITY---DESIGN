import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
// POST /api/v1/onboarding/skip
// Sets onboarding_status='skipped' for the active workspace.
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

    const { data: currentProfile } = await supabase
      .from("onboarding_profiles")
      .select("onboarding_status")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .single();

    if (currentProfile?.onboarding_status === "completed") {
      return NextResponse.json(
        { error: "Onboarding is already completed and cannot be skipped." },
        { status: 409 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("onboarding_profiles")
      .update(updateData)
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError) {
      if (updateError.code === "PGRST116") {
        const { data: created, error: createError } = await supabase
          .from("onboarding_profiles")
          .insert({
            tenant_id: tenantId,
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
