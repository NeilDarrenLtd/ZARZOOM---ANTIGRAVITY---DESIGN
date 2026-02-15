import { z } from "zod";
import {
  createApiHandler,
  ok,
  accepted,
  badRequest,
  enqueueJob,
} from "@/lib/api";
import { createProfileSchema } from "@/lib/social";

/**
 * POST /api/v1/social/profiles
 *
 * Create a new social profile. Enqueues a job for the worker to call
 * Upload-Post's create-profile endpoint.
 *
 * Input: { profile_username }
 * Returns: 202 { job_id, status_url }
 */
export const POST = createApiHandler({
  requiredRole: "member",
  requiredEntitlement: "social.profile.create",
  quotaMetric: "social_profiles",
  rateLimit: { maxRequests: 20, windowMs: 60_000 },
  handler: async (ctx) => {
    let body: unknown;
    try {
      body = await ctx.req.json();
    } catch {
      return badRequest(ctx.requestId, "Invalid JSON body");
    }

    const parsed = createProfileSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(
        ctx.requestId,
        "Validation failed",
        parsed.error.flatten().fieldErrors
      );
    }

    const tenantId = ctx.membership!.tenantId;
    const { profile_username } = parsed.data;

    // Enqueue job for the worker
    const { jobId } = await enqueueJob(tenantId, "social.profile.create", {
      profile_username,
      provider: "uploadpost",
    });

    return accepted(
      {
        job_id: jobId,
        status_url: `/api/v1/jobs/${jobId}`,
      },
      ctx.requestId
    );
  },
});

/**
 * GET /api/v1/social/profiles
 *
 * List social profiles for the authenticated tenant.
 */
export const GET = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const tenantId = ctx.membership!.tenantId;

    const { data: profiles, error } = await ctx.supabase!
      .from("social_profiles")
      .select(
        "id, profile_username, provider_profile_id, status, platforms, connect_url, metadata, created_at, updated_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        `[API] social profiles list error (${ctx.requestId}):`,
        error.message
      );
      return badRequest(ctx.requestId, "Failed to query profiles");
    }

    return ok({ profiles: profiles ?? [] }, ctx.requestId);
  },
});
