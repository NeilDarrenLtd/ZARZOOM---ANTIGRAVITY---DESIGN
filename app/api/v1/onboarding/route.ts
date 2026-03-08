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

/** True if the error suggests onboarding_profiles has no tenant_id column (migration 016 not run). */
function isLegacySchemaError(err: { message?: string; code?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return (
    (m.includes("tenant_id") && (m.includes("does not exist") || m.includes("undefined column"))) ||
    err.code === "42703"
  );
}

// Workspace name and business name are one: tenants.name must match onboarding_profiles.business_name
// for the active workspace. Profile save updates tenants.name when business_name changes; workspace
// rename updates onboarding_profiles.business_name.

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
  Vary: "x-tenant-id",
};

// ──────────────────────────────────────────────
// GET /api/v1/onboarding
// Returns the current user's onboarding profile for the active workspace (X-Tenant-Id).
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

    let tenantId: string | null = await resolveTenantId(supabase, user.id, request);
    if (!tenantId) {
      return NextResponse.json(
        { error: "Workspace context required. Send X-Tenant-Id header." },
        { status: 400 }
      );
    }

    // Fetch existing row for this workspace + user
    let profile: Record<string, unknown> | null = null;
    let fetchError: { code?: string; message?: string } | null = null;
    const fetchResult = await supabase
      .from("onboarding_profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .single();

    profile = fetchResult.data as Record<string, unknown> | null;
    fetchError = fetchResult.error;

    // Legacy schema: table has no tenant_id column (migration 016 not run). Fall back to user_id only.
    if (fetchError && isLegacySchemaError(fetchError)) {
      const legacy = await supabase
        .from("onboarding_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (legacy.data) {
        return NextResponse.json({ data: legacy.data }, { headers: NO_CACHE_HEADERS });
      }
      return NextResponse.json(
        { error: "Failed to fetch onboarding profile", details: fetchError.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    if (fetchError && fetchError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to fetch onboarding profile", details: fetchError.message },
        { status: 500 }
      );
    }

    if (profile) {
      return NextResponse.json({ data: profile }, { headers: NO_CACHE_HEADERS });
    }

    // No profile yet for this workspace — create one with defaults; business_name = workspace name
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
      if (isLegacySchemaError(insertError)) {
        const legacy = await supabase
          .from("onboarding_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        if (legacy.data) return NextResponse.json({ data: legacy.data }, { headers: NO_CACHE_HEADERS });
      }
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

    let tenantId: string | null = await resolveTenantId(supabase, user.id, request);
    warnQueryWithoutWorkspaceId(tenantId, "PUT /api/v1/onboarding");
    if (!tenantId) {
      return NextResponse.json(
        { error: "Workspace context required. Send X-Tenant-Id header." },
        { status: 400 }
      );
    }

    const rawBody = await request.json();
    // Profile form sends full state including empty strings; coerce "" to undefined so optional validation passes
    const body =
      typeof rawBody === "object" && rawBody !== null
        ? Object.fromEntries(
            Object.entries(rawBody).map(([k, v]) => [k, v === "" ? undefined : v])
          )
        : rawBody;

    // Validate with Zod (includes conditional goal-based validation)
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

    // ── Fetch current status before updating ──────────────
    const { data: currentProfile, error: currentProfileError } = await supabase
      .from("onboarding_profiles")
      .select("onboarding_status")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .single();

    // Legacy schema: no tenant_id column. Use user_id-only path so existing data still saves.
    if (currentProfileError && isLegacySchemaError(currentProfileError)) {
      const legacyStatus = await supabase
        .from("onboarding_profiles")
        .select("onboarding_status")
        .eq("user_id", user.id)
        .maybeSingle();
      const preserveStatus =
        legacyStatus.data?.onboarding_status === "completed" ||
        legacyStatus.data?.onboarding_status === "skipped";
      const updateData: Record<string, unknown> = {
        ...parsed.data,
        ...(preserveStatus ? {} : { onboarding_status: "in_progress" }),
      };
      if (parsed.data.onboarding_step) {
        updateData.onboarding_step = parsed.data.onboarding_step;
      }
      const { data: legacyUpdated, error: legacyError } = await supabase
        .from("onboarding_profiles")
        .update(updateData)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (legacyError) {
        if (legacyError.code === "PGRST116") {
          const { data: upserted, error: upsertError } = await supabase
            .from("onboarding_profiles")
            .upsert({ user_id: user.id, ...updateData }, { onConflict: "user_id" })
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
          { error: "Failed to update onboarding profile", details: legacyError.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ data: legacyUpdated });
    }

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
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError) {
      if (isLegacySchemaError(updateError)) {
        const legacyStatus = await supabase
          .from("onboarding_profiles")
          .select("onboarding_status")
          .eq("user_id", user.id)
          .maybeSingle();
        const preserve = preserveStatus ||
          legacyStatus.data?.onboarding_status === "completed" ||
          legacyStatus.data?.onboarding_status === "skipped";
        const legacyData: Record<string, unknown> = {
          ...parsed.data,
          ...(preserve ? {} : { onboarding_status: "in_progress" }),
        };
        if (parsed.data.onboarding_step) legacyData.onboarding_step = parsed.data.onboarding_step;
        const { data: legacyUpdated, error: legacyErr } = await supabase
          .from("onboarding_profiles")
          .update(legacyData)
          .eq("user_id", user.id)
          .select("*")
          .single();
        if (legacyErr) {
          return NextResponse.json(
            { error: "Failed to update onboarding profile", details: legacyErr.message },
            { status: 500 }
          );
        }
        return NextResponse.json({ data: legacyUpdated });
      }
      if (updateError.code === "PGRST116") {
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

    // Keep workspace name in sync with business name (product rule: workspace name = business name)
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
