import { z } from "zod";
import { createApiHandler, ok, notFound, badRequest } from "@/lib/api";

const paramsSchema = z.object({
  job_id: z.string().uuid(),
});

/**
 * GET /api/v1/jobs/{job_id}
 *
 * Returns full details for a single job including expanded output_assets
 * and the linked artefact (if one was produced).
 */
export const GET = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 120, windowMs: 60_000 },
  handler: async (ctx) => {
    // Extract job_id from the URL path
    const segments = ctx.req.nextUrl.pathname.split("/");
    const jobIdRaw = segments[segments.length - 1];
    const parsed = paramsSchema.safeParse({ job_id: jobIdRaw });

    if (!parsed.success) {
      return badRequest(ctx.requestId, "Invalid job_id", parsed.error.flatten().fieldErrors);
    }

    const { job_id } = parsed.data;
    const tenantId = ctx.membership!.tenantId;

    // Fetch the job
    const { data: job, error: jobError } = await ctx.supabase!
      .from("jobs")
      .select("id, type, status, priority, payload, result, error, attempt, max_attempts, created_at, updated_at, scheduled_for, locked_until")
      .eq("id", job_id)
      .eq("tenant_id", tenantId)
      .single();

    if (jobError || !job) {
      return notFound(ctx.requestId, "Job not found");
    }

    // Expand output_asset_ids from result if present
    const result = (job.result ?? {}) as Record<string, unknown>;
    const outputAssetIds = Array.isArray(result.output_asset_ids)
      ? (result.output_asset_ids as string[])
      : [];

    let outputAssets: Array<Record<string, unknown>> = [];
    if (outputAssetIds.length > 0) {
      const { data: assets } = await ctx.supabase!
        .from("social_posts")
        .select("id, text_content, media_url, status, platform_results, created_at")
        .in("id", outputAssetIds)
        .eq("tenant_id", tenantId);

      outputAssets = (assets ?? []).map((a) => ({
        asset_id: a.id,
        text_content: a.text_content,
        media_url: a.media_url,
        status: a.status,
        platform_results: a.platform_results,
        created_at: a.created_at,
      }));
    }

    // Check if an artefact was produced by this job
    let outputArtefact: Record<string, unknown> | null = null;
    const { data: artefact } = await ctx.supabase!
      .from("artefacts")
      .select("artefact_id, title, kind, language, created_at")
      .eq("source_job_id", job_id)
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();

    if (artefact) {
      outputArtefact = {
        artefact_id: artefact.artefact_id,
        title: artefact.title,
        kind: artefact.kind,
        language: artefact.language,
        created_at: artefact.created_at,
      };
    }

    const completedAt = job.status === "completed" ? job.updated_at : null;

    return ok({
      job_id: job.id,
      type: job.type,
      provider: (job.payload as Record<string, unknown>)?.provider ?? null,
      status: job.status,
      progress: job.status === "completed" ? 100 : job.status === "running" ? 50 : 0,
      priority: job.priority,
      attempt: job.attempt,
      max_attempts: job.max_attempts,
      created_at: job.created_at,
      completed_at: completedAt,
      error: job.error,
      output_assets: outputAssets,
      output_artefact: outputArtefact,
    }, ctx.requestId);
  },
});
