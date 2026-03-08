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
// POST /api/v1/onboarding/restart
// Resets onboarding for the active workspace so the user can redo the wizard.
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = await resolveTenantId(supabase, user.id, request);
    if (!tenantId) {
      return NextResponse.json(
        { error: "Workspace context required. Send X-Tenant-Id header." },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("onboarding_profiles")
      .update({
        onboarding_status: "in_progress",
        onboarding_step: 1,
        onboarding_completed_at: null,
      })
      .eq("tenant_id", tenantId)
      .select("*")
      .single();

    if (updateError) {
      if (updateError.code === "PGRST116") {
        // No row exists -- create a fresh one
        const { data: created, error: insertError } = await supabase
          .from("onboarding_profiles")
          .insert({
            tenant_id: tenantId,
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
