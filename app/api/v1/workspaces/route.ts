import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  createApiHandler,
  created,
  ok,
  serverError,
} from "@/lib/api";
import {
  ACTIVE_WORKSPACE_COOKIE,
  getActiveWorkspaceCookieOptions,
} from "@/lib/workspace/active";

/** Return 500 with a message the client can display (includes underlying error for debugging). */
function fail(ctx: { requestId: string }, userMessage: string, underlying?: string) {
  const message = underlying ? `${userMessage}: ${underlying}` : userMessage;
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message, requestId: ctx.requestId } },
    { status: 500, headers: { "X-Request-Id": ctx.requestId } }
  );
}

/** Map tenant DB status to UI workspace status */
function toWorkspaceStatus(
  tenantStatus: string,
  subStatus: string | undefined
): "active" | "setup_incomplete" | "payment_required" {
  if (subStatus === "past_due" || subStatus === "unpaid") return "payment_required";
  if (subStatus === "active" || subStatus === "trialing") return "active";
  switch (tenantStatus) {
    case "active":
      return "active";
    case "payment_required":
      return "payment_required";
    case "draft":
    case "inactive":
    default:
      return "setup_incomplete";
  }
}

// ──────────────────────────────────────────────
// GET /api/v1/workspaces
// Returns all workspaces the authenticated user belongs to (from tenants + memberships),
// with status and role. Optional X-Tenant-Id for tenant-scoped auth.
// ──────────────────────────────────────────────

export const GET = createApiHandler({
  auth: true,
  tenantOptional: true,
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    // Use user's session client for reads (RLS filters by membership)
    const supabase = ctx.supabase!;
    const userId = ctx.user!.id;

    const { data: memberships, error: membershipError } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, role, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (membershipError) {
      return serverError(ctx.requestId, "Failed to fetch workspaces");
    }

    if (!memberships || memberships.length === 0) {
      return ok({ workspaces: [] }, ctx.requestId);
    }

    const tenantIds = memberships.map((m) => m.tenant_id);

    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("id, name, status")
      .in("id", tenantIds);

    if (tenantsError || !tenants) {
      return serverError(ctx.requestId, "Failed to fetch workspace details");
    }

    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    const { data: subscriptions } = await supabase
      .from("tenant_subscriptions")
      .select("tenant_id, status")
      .in("tenant_id", tenantIds);

    const subMap = new Map(
      (subscriptions ?? []).map((s) => [s.tenant_id, s.status])
    );

    const workspaces = memberships.map((m) => {
      const tenant = tenantMap.get(m.tenant_id);
      const name = tenant?.name ?? "Workspace";
      const tenantStatus = tenant?.status ?? "draft";
      const subStatus = subMap.get(m.tenant_id);
      const status = toWorkspaceStatus(tenantStatus, subStatus);

      return {
        id: m.tenant_id,
        name,
        status,
        role: m.role as "owner" | "admin" | "member" | "viewer",
        created_at: m.created_at,
      };
    });

    return ok({ workspaces }, ctx.requestId);
  },
});

// ──────────────────────────────────────────────
// POST /api/v1/workspaces
// Create a new draft workspace and add the current user as owner.
// Sets active_workspace_id cookie to the new workspace so dashboard reloads in context.
// Body: { name?: string } (optional display name).
// ──────────────────────────────────────────────

export const POST = createApiHandler({
  auth: true,
  tenantOptional: true,
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const userId = ctx.user!.id;

    let name = "My Workspace";
    try {
      const body = await ctx.req.json().catch(() => ({}));
      if (body?.name && typeof body.name === "string" && body.name.trim()) {
        name = body.name.trim().slice(0, 200);
      }
    } catch {
      // use default name
    }

    let admin;
    try {
      admin = await createAdminClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[workspaces POST] createAdminClient failed:", msg);
      return fail(ctx, "Server configuration error", msg);
    }

    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .insert({
        name,
        status: "draft",
      })
      .select("id, name, status, created_at")
      .single();

    if (tenantError || !tenant) {
      const errMsg = tenantError?.message ?? (tenantError ? String(tenantError) : "No data returned");
      console.error("[workspaces POST] tenant insert failed:", errMsg);
      return fail(ctx, "Failed to create workspace", errMsg);
    }

    const { error: membershipError } = await admin
      .from("tenant_memberships")
      .insert({
        tenant_id: tenant.id,
        user_id: userId,
        role: "owner",
      });

    if (membershipError) {
      console.error("[workspaces POST] membership insert failed:", membershipError.message);
      return fail(ctx, "Failed to add workspace membership", membershipError.message);
    }

    const response = created(
      {
        workspace: {
          id: tenant.id,
          name: tenant.name,
          status: "setup_incomplete" as const,
          role: "owner" as const,
          created_at: tenant.created_at,
        },
      },
      ctx.requestId
    );

    const opts = getActiveWorkspaceCookieOptions();
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, tenant.id, opts);
    return response;
  },
});
