import { createApiHandler, ok, badRequest, NotFoundError } from "@/lib/api";
import { analyticsQuerySchema } from "@/lib/social";
import { env } from "@/lib/api/env";
import { createServerClient } from "@supabase/ssr";

/**
 * GET /api/v1/social/analytics/:profile_username?platforms=twitter,instagram
 *
 * Returns aggregated post analytics for a profile.
 * Counts posts by status and platform from the social_posts table.
 */
export const GET = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const profileUsername = ctx.req.nextUrl.pathname.split("/").at(-1);
    const rawParams = Object.fromEntries(ctx.req.nextUrl.searchParams);
    const params = { ...rawParams, profile_username: profileUsername ?? "" };

    const parsed = analyticsQuerySchema.safeParse(params);
    if (!parsed.success) {
      return badRequest(
        ctx.requestId,
        "Invalid query parameters",
        parsed.error.flatten().fieldErrors
      );
    }

    const { profile_username, platforms: filterPlatforms } = parsed.data;
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
      .select("id, profile_username, platforms, metadata, status")
      .eq("tenant_id", tenantId)
      .eq("profile_username", profile_username)
      .single();

    if (!profile) {
      throw new NotFoundError(
        "Social profile",
        `Profile "${profile_username}" not found`
      );
    }

    // Aggregate posts by status
    const { data: allPosts, error } = await admin
      .from("social_posts")
      .select("id, status, post_type, platforms, platform_results, created_at")
      .eq("tenant_id", tenantId)
      .eq("profile_id", profile.id);

    if (error) {
      console.error(
        `[API] analytics query error (${ctx.requestId}):`,
        error.message
      );
      return badRequest(ctx.requestId, "Failed to query analytics");
    }

    const posts = allPosts ?? [];

    // Filter by platforms if specified
    const filtered = filterPlatforms?.length
      ? posts.filter((p) => {
          const postPlatforms = (p.platforms as string[]) ?? [];
          return postPlatforms.some((pp) =>
            filterPlatforms.includes(pp as never)
          );
        })
      : posts;

    // Build summary
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};

    for (const post of filtered) {
      // By status
      byStatus[post.status ?? "unknown"] =
        (byStatus[post.status ?? "unknown"] ?? 0) + 1;

      // By post type
      byType[post.post_type ?? "unknown"] =
        (byType[post.post_type ?? "unknown"] ?? 0) + 1;

      // By platform
      const platforms = (post.platforms as string[]) ?? [];
      for (const platform of platforms) {
        byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
      }
    }

    return ok(
      {
        profile_username: profile.profile_username,
        profile_status: profile.status,
        total_posts: filtered.length,
        by_status: byStatus,
        by_type: byType,
        by_platform: byPlatform,
        connected_platforms: profile.platforms ?? [],
        metadata: profile.metadata,
      },
      ctx.requestId
    );
  },
});
