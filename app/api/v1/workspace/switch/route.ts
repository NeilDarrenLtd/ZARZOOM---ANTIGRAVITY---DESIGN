import {
  createApiHandler,
  badRequest,
  ok,
  forbidden,
} from "@/lib/api";
import {
  ACTIVE_WORKSPACE_COOKIE,
  getActiveWorkspaceCookieOptions,
} from "@/lib/workspace/active";

/**
 * POST /api/v1/workspace/switch
 *
 * Set the active workspace for the current user. Validates that the user
 * is a member of the given workspace, then sets the active_workspace_id cookie.
 * Client should redirect to /dashboard after success so data reloads in new context.
 *
 * Body: { workspace_id: string }
 */
export const POST = createApiHandler({
  auth: true,
  tenantOptional: true,
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const supabase = ctx.supabase!;
    const userId = ctx.user!.id;

    let body: { workspace_id?: string };
    try {
      body = await ctx.req.json();
    } catch {
      return badRequest(ctx.requestId, "Invalid JSON body");
    }

    const workspaceId = body?.workspace_id?.trim();
    if (!workspaceId) {
      return badRequest(ctx.requestId, "workspace_id is required");
    }

    const { data: membership, error } = await supabase
      .from("tenant_memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("tenant_id", workspaceId)
      .maybeSingle();

    if (error || !membership) {
      return forbidden(ctx.requestId, "You are not a member of this workspace");
    }

    const response = ok({ workspace_id: workspaceId }, ctx.requestId);
    const opts = getActiveWorkspaceCookieOptions();
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, opts);
    return response;
  },
});
