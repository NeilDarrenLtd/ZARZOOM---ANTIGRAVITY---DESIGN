import { createApiHandler, ok, NotFoundError } from "@/lib/api";
import { env } from "@/lib/api/env";
import { createServerClient } from "@supabase/ssr";

/**
 * GET /api/v1/social/posts/:provider_job_id/status
 *
 * Returns the current status of a social post by its provider_job_id
 * (the ID returned by Upload-Post). Also joins the internal job row
 * for additional context.
 */
export const GET = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const providerJobId = ctx.req.nextUrl.pathname.split("/").at(-2);

    if (!providerJobId) {
      throw new NotFoundError("Post", "Missing provider_job_id in path");
    }

    const tenantId = ctx.membership!.tenantId;
    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

    const admin = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { getAll: () => [], setAll() {} } }
    );

    // Find the social post by provider_post_id
    const { data: post } = await admin
      .from("social_posts")
      .select(
        "id, post_type, status, platforms, platform_results, provider_post_id, error, job_id, created_at, updated_at"
      )
      .eq("tenant_id", tenantId)
      .eq("provider_post_id", providerJobId)
      .single();

    if (!post) {
      throw new NotFoundError(
        "Social post",
        `Post with provider_job_id "${providerJobId}" not found`
      );
    }

    // Optionally join the internal job for progress info
    let job = null;
    if (post.job_id) {
      const { data: jobRow } = await admin
        .from("jobs")
        .select("id, status, attempt, max_attempts, result, error, updated_at")
        .eq("id", post.job_id)
        .eq("tenant_id", tenantId)
        .single();

      if (jobRow) {
        job = {
          job_id: jobRow.id,
          status: jobRow.status,
          attempt: jobRow.attempt,
          max_attempts: jobRow.max_attempts,
          error: jobRow.error,
          updated_at: jobRow.updated_at,
        };
      }
    }

    return ok(
      {
        post_id: post.id,
        provider_job_id: providerJobId,
        post_type: post.post_type,
        status: post.status,
        platforms: post.platforms,
        platform_results: post.platform_results,
        error: post.error,
        job,
        created_at: post.created_at,
        updated_at: post.updated_at,
      },
      ctx.requestId
    );
  },
});
