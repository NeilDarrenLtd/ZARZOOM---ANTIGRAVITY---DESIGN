import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { onboardingUpdateSchema } from "@/lib/validation/onboarding";
import {
  assertWorkspaceSave,
  assertWorkspaceWhere,
  logWorkspaceSave,
  warnQueryWithoutWorkspaceId,
} from "@/lib/dev/workspace-guardrails";

/** Resolve tenant_id from X-Tenant-Id header and verify user is a member. Returns null if missing/invalid. */
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

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
  Vary: "x-tenant-id",
};

// ──────────────────────────────────────────────
// GET /api/v1/onboarding
// Returns the onboarding profile for the active workspace (X-Tenant-Id).
// If no row exists, creates one with defaults for that workspace.
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
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
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    if (profile) {
      return NextResponse.json({ data: profile }, { headers: NO_CACHE_HEADERS });
    }

    // No profile yet for this workspace -- create one with defaults
    let defaultBusinessName = "Un-Named";
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .maybeSingle();
    if (tenantRow && typeof (tenantRow as { name?: string }).name === "string") {
      defaultBusinessName = (tenantRow as { name: string }).name.slice(0, 200);
    }

    const { data: newProfile, error: insertError } = await supabase
      .from("onboarding_profiles")
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        onboarding_status: "not_started",
        onboarding_step: 1,
        business_name: defaultBusinessName,
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create onboarding profile", details: insertError.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json({ data: newProfile }, { status: 201, headers: NO_CACHE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ──────────────────────────────────────────────
// PUT /api/v1/onboarding
// Validates payload with Zod, applies conditional
// requirements, then updates the row for the active workspace (X-Tenant-Id).
// ──────────────────────────────────────────────

export async function PUT(request: NextRequest) {
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
    warnQueryWithoutWorkspaceId(tenantId, "PUT /api/v1/onboarding");
    if (!tenantId) {
      return NextResponse.json(
        { error: "Workspace context required. Send X-Tenant-Id header." },
        { status: 400 }
      );
    }

    const rawBody = await request.json();
    const body =
      typeof rawBody === "object" && rawBody !== null
        ? Object.fromEntries(
            Object.entries(rawBody).map(([k, v]) => [k, v === "" ? undefined : v])
          )
        : rawBody;

    const parsed = onboardingUpdateSchema.safeParse(body);

    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      const firstMessage = issues[0]?.message ?? "Validation failed";
      return NextResponse.json(
        {
          error: firstMessage,
          issues,
        },
        { status: 422 }
      );
    }

    const { data: currentProfile } = await supabase
      .from("onboarding_profiles")
      .select("onboarding_status")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const currentStatus = currentProfile?.onboarding_status;
    const preserveStatus =
      currentStatus === "completed" || currentStatus === "skipped";

    const updateData: Record<string, unknown> = {
      ...parsed.data,
      ...(preserveStatus ? {} : { onboarding_status: "in_progress" }),
    };
    if (parsed.data.onboarding_step) {
      updateData.onboarding_step = parsed.data.onboarding_step;
    }
    assertWorkspaceSave(tenantId, { ...updateData, tenant_id: tenantId }, "onboarding_profiles");
    assertWorkspaceWhere(tenantId, "update", "onboarding_profiles", { tenant_id: tenantId });

    const { data: updated, error: updateError } = await supabase
      .from("onboarding_profiles")
      .update(updateData)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();

    if (updateError) {
      if (updateError.code === "PGRST116") {
        // No row exists yet -- upsert
        const { data: upserted, error: upsertError } = await supabase
          .from("onboarding_profiles")
          .upsert({
            tenant_id: tenantId,
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

    logWorkspaceSave("onboarding_profiles", tenantId, tenantId);

    // Keep workspace name in sync with business name
    const newBusinessName = parsed.data.business_name?.trim();
    if (newBusinessName && newBusinessName.length >= 2) {
      try {
        const admin = await createAdminClient();
        await admin
          .from("tenants")
          .update({ name: newBusinessName.slice(0, 200) })
          .eq("id", tenantId);
      } catch (e) {
        console.warn("[onboarding] Failed to sync tenants.name with business_name:", e);
      }
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
