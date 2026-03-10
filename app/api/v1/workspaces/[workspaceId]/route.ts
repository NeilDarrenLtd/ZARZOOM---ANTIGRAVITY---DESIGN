import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  createApiHandler,
  ok,
  badRequest,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api";
import { logWorkspaceSave } from "@/lib/dev/workspace-guardrails";
import {
  ACTIVE_WORKSPACE_COOKIE,
  getActiveWorkspaceCookieOptions,
} from "@/lib/workspace/active";

/** Return 500 with a message the client can display. */
function fail(
  ctx: { requestId: string },
  userMessage: string,
  underlying?: string
) {
  const message = underlying ? `${userMessage}: ${underlying}` : userMessage;
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message, requestId: ctx.requestId } },
    { status: 500, headers: { "X-Request-Id": ctx.requestId } }
  );
}

// ──────────────────────────────────────────────
// PATCH /api/v1/workspaces/[workspaceId]
// Rename a workspace. Only the owner can rename.
// Body: { name: string } (2–200 chars).
// ──────────────────────────────────────────────

function parseRenameBody(body: unknown): { name: string } | null {
  if (body && typeof body === "object" && "name" in body && typeof (body as { name: unknown }).name === "string") {
    const name = (body as { name: string }).name.trim().slice(0, 200);
    if (name.length >= 2) return { name };
  }
  return null;
}

export const PATCH = createApiHandler({
  auth: true,
  tenantOptional: true,
  rateLimit: { maxRequests: 20, windowMs: 60_000 },
  handler: async (ctx) => {
    const match = ctx.req.nextUrl.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)$/);
    const workspaceId = match?.[1] ?? null;
    if (!workspaceId) return badRequest(ctx.requestId, "Missing workspace ID");

    const userId = ctx.user!.id;
    const supabase = ctx.supabase!;

    const { data: membership, error: membershipError } = await supabase
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) return serverError(ctx.requestId, "Failed to verify workspace access");
    if (!membership) return notFound(ctx.requestId, "Workspace not found");
    if (membership.role !== "owner") {
      return forbidden(ctx.requestId, "Only the workspace owner can rename this workspace");
    }

    const body = await ctx.req.json().catch(() => ({}));
    const parsed = parseRenameBody(body);
    if (!parsed) {
      return badRequest(ctx.requestId, "Body must include name (string, 2–200 characters)");
    }

    let admin;
    try {
      admin = await createAdminClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return fail(ctx, "Server configuration error", msg);
    }

    const { data: updated, error: updateError } = await admin
      .from("tenants")
      .update({ name: parsed.name })
      .eq("id", workspaceId)
      .select("id, name, status, created_at")
      .single();

    if (updateError || !updated) {
      return fail(ctx, "Failed to rename workspace", updateError?.message);
    }

    // Keep business name in sync with workspace name (product rule: workspace name = business name)
    const { error: profileSyncError } = await admin
      .from("onboarding_profiles")
      .update({ business_name: parsed.name.slice(0, 200) })
      .eq("tenant_id", workspaceId);
    if (profileSyncError) {
      console.warn("[workspaces PATCH] Failed to sync onboarding_profiles.business_name:", profileSyncError.message);
    }

    logWorkspaceSave("tenants", workspaceId, workspaceId);
    return ok({ workspace: { id: updated.id, name: updated.name, status: updated.status, created_at: updated.created_at } }, ctx.requestId);
  },
});

// ──────────────────────────────────────────────
// PUT /api/v1/workspaces/[workspaceId]
// Toggle workspace pause state. Owner/admin only.
// Body: { is_paused: boolean }
// ──────────────────────────────────────────────

export const PUT = createApiHandler({
  auth: true,
  tenantOptional: true,
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const match = ctx.req.nextUrl.pathname.match(/^\/api\/v1\/workspaces\/([^/]+)$/);
    const workspaceId = match?.[1] ?? null;
    if (!workspaceId) return badRequest(ctx.requestId, "Missing workspace ID");

    const userId = ctx.user!.id;
    const supabase = ctx.supabase!;

    const { data: membership, error: membershipError } = await supabase
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) return serverError(ctx.requestId, "Failed to verify workspace access");
    if (!membership) return notFound(ctx.requestId, "Workspace not found");
    if (!["owner", "admin"].includes(membership.role)) {
      return forbidden(ctx.requestId, "Only the workspace owner or admin can change this setting");
    }

    const body = await ctx.req.json().catch(() => ({}));
    if (typeof body?.is_paused !== "boolean") {
      return badRequest(ctx.requestId, "Body must include is_paused (boolean)");
    }

    let admin;
    try {
      admin = await createAdminClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return fail(ctx, "Server configuration error", msg);
    }

    const { data: updated, error: updateError } = await admin
      .from("tenants")
      .update({ is_paused: body.is_paused })
      .eq("id", workspaceId)
      .select("id, name, status, is_paused")
      .single();

    if (updateError || !updated) {
      return fail(ctx, "Failed to update workspace", updateError?.message);
    }

    return ok(
      { workspace: { id: updated.id, name: updated.name, is_paused: updated.is_paused } },
      ctx.requestId,
    );
  },
});

// ──────────────────────────────────────────────
// DELETE /api/v1/workspaces/[workspaceId]
// Permanently delete a workspace. Only the owner can delete.
// Irreversible: removes tenant, memberships, and related data.
// ──────────────────────────────────────────────

export const DELETE = createApiHandler({
  auth: true,
  tenantOptional: true,
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const match = ctx.req.nextUrl.pathname.match(
      /^\/api\/v1\/workspaces\/([^/]+)$/
    );
    const workspaceId = match?.[1] ?? null;
    if (!workspaceId) {
      return badRequest(ctx.requestId, "Missing workspace ID");
    }

    const userId = ctx.user!.id;
    const supabase = ctx.supabase!;

    // Require user to be the owner of this workspace
    const { data: membership, error: membershipError } = await supabase
      .from("tenant_memberships")
      .select("role")
      .eq("tenant_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      return serverError(ctx.requestId, "Failed to verify workspace access");
    }
    if (!membership) {
      return notFound(ctx.requestId, "Workspace not found");
    }
    if (membership.role !== "owner") {
      return forbidden(
        ctx.requestId,
        "Only the workspace owner can delete this workspace"
      );
    }

    let admin;
    try {
      admin = await createAdminClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[workspaces DELETE] createAdminClient failed:", msg);
      return fail(ctx, "Server configuration error", msg);
    }

    // Delete tenant; CASCADE will remove tenant_memberships and other dependent rows
    const { error: deleteError } = await admin
      .from("tenants")
      .delete()
      .eq("id", workspaceId);

    if (deleteError) {
      console.error("[workspaces DELETE] tenant delete failed:", deleteError.message);
      return fail(ctx, "Failed to delete workspace", deleteError.message);
    }

    const response = ok(
      { deleted: true, workspace_id: workspaceId },
      ctx.requestId
    );

    // If the deleted workspace was the active one, clear the cookie
    const activeCookie = ctx.req.cookies.get(ACTIVE_WORKSPACE_COOKIE)?.value;
    if (activeCookie === workspaceId) {
      const opts = getActiveWorkspaceCookieOptions();
      response.cookies.set(ACTIVE_WORKSPACE_COOKIE, "", {
        ...opts,
        maxAge: 0,
      });
    }

    return response;
  },
});
