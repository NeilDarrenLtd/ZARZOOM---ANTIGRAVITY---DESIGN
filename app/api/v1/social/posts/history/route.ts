import { createApiHandler, ok, badRequest, NotFoundError } from "@/lib/api";
import { historyQuerySchema } from "@/lib/social";
import { env } from "@/lib/api/env";
import { createServerClient } from "@supabase/ssr";

/**
 * GET /api/v1/social/posts/history?profile_username=&page=&limit=
 *
 * Paginated list of published/scheduled posts for a profile.
 */
export const GET = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const params = Object.fromEntries(ctx.req.nextUrl.searchParams);
    const parsed = historyQuerySchema.safeParse(params);

    if (!parsed.success) {
      return badRequest(
        ctx.requestId,
        "Invalid query parameters",
        parsed.error.flatten().fieldErrors
      );
    }

    const { profile_username, page, limit } = parsed.data;
    const tenantId = ctx.membership!.tenantId;
    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

    const admin = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { getAll: () => [], setAll() {} } }
    );

    // Resolve profile
    const { data: profile } = await admin
      .from("social_profiles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("profile_username", profile_username)
      .single();

    if (!profile) {
      throw new NotFoundError(
        "Social profile",
        `Profile "${profile_username}" not found`
      );
    }

    const offset = (page - 1) * limit;

    // Count total
    const { count } = await admin
      .from("social_posts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("profile_id", profile.id);

    // Fetch page
    const { data: posts, error } = await admin
      .from("social_posts")
      .select(
        "id, post_type, text_content, platforms, status, schedule_at, timezone, media_url, media_asset_id, platform_results, error, job_id, created_at, updated_at"
      )
      .eq("tenant_id", tenantId)
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error(
        `[API] social posts history error (${ctx.requestId}):`,
        error.message
      );
      return badRequest(ctx.requestId, "Failed to query post history");
    }

    return ok(
      {
        posts: posts ?? [],
        pagination: {
          page,
          limit,
          total: count ?? 0,
          total_pages: Math.ceil((count ?? 0) / limit),
        },
      },
      ctx.requestId
    );
  },
});
