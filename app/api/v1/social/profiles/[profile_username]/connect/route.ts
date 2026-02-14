import {
  createApiHandler,
  accepted,
  badRequest,
  notFound,
  enqueueJob,
  NotFoundError,
} from "@/lib/api";
import { connectProfileSchema } from "@/lib/social";
import { env } from "@/lib/api/env";
import { createServerClient } from "@supabase/ssr";

/**
 * POST /api/v1/social/profiles/:profile_username/connect
 *
 * Initiate an OAuth-style connection for a social profile.
 * Enqueues a job for the worker to call Upload-Post's generate-JWT
 * connect-link endpoint. The result (connect URL) is stored in the
 * job output and in social_profiles.connect_url.
 *
 * Input: { redirect_url? }
 * Returns: 202 { job_id, status_url }
 */
export const POST = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 20, windowMs: 60_000 },
  handler: async (ctx) => {
    const profileUsername = ctx.req.nextUrl.pathname.split("/")[5]; // /api/v1/social/profiles/{username}/connect

    if (!profileUsername) {
      return badRequest(ctx.requestId, "Missing profile_username in path");
    }

    let body: unknown = {};
    try {
      const text = await ctx.req.text();
      if (text) body = JSON.parse(text);
    } catch {
      return badRequest(ctx.requestId, "Invalid JSON body");
    }

    const parsed = connectProfileSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(
        ctx.requestId,
        "Validation failed",
        parsed.error.flatten().fieldErrors
      );
    }

    const tenantId = ctx.membership!.tenantId;
    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

    const admin = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { getAll: () => [], setAll() {} } }
    );

    // Verify profile exists and belongs to tenant
    const { data: profile, error: profileError } = await admin
      .from("social_profiles")
      .select("id, profile_username")
      .eq("tenant_id", tenantId)
      .eq("profile_username", profileUsername)
      .single();

    if (profileError || !profile) {
      throw new NotFoundError(
        "Social profile",
        `Profile "${profileUsername}" not found`
      );
    }

    // Enqueue a job for the worker
    const { jobId } = await enqueueJob(
      tenantId,
      "social.profile.connect",
      {
        profile_username: profileUsername,
        profile_id: profile.id,
        redirect_url: parsed.data.redirect_url ?? null,
        provider: "uploadpost",
      }
    );

    return accepted(
      {
        job_id: jobId,
        status_url: `/api/v1/jobs/${jobId}`,
      },
      ctx.requestId
    );
  },
});
