import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import {
  createApiHandler,
  ok,
  NotFoundError,
  ValidationError,
} from "@/lib/api";
import { env } from "@/lib/api/env";

const paramsSchema = z.object({
  job_id: z.string().uuid("job_id must be a valid UUID"),
});

/**
 * GET /api/v1/research/[job_id]
 *
 * Reads from jobs and artefacts tables. No provider calls.
 * Returns the job status and, if complete, the research artefact.
 */
export const GET = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx, routeCtx?: { params: Promise<{ job_id: string }> }) => {
    const tenantId = ctx.membership!.tenantId;
    const rawParams = routeCtx ? await routeCtx.params : { job_id: "" };
    const paramsParsed = paramsSchema.safeParse(rawParams);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.flatten().fieldErrors);
    }

    const { job_id } = paramsParsed.data;

    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
    const admin = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { getAll: () => [], setAll() {} } }
    );

    // Fetch job
    const { data: job } = await admin
      .from("jobs")
      .select("id, status, type, result, error, created_at, updated_at")
      .eq("id", job_id)
      .eq("tenant_id", tenantId)
      .single();

    if (!job) {
      throw new NotFoundError("Job", `Research job "${job_id}" not found`);
    }

    // Fetch associated artefact if job is complete
    let artefact = null;
    if (job.status === "succeeded") {
      const { data } = await admin
        .from("artefacts")
        .select("artefact_id, title, kind, content, language, created_at")
        .eq("source_job_id", job_id)
        .eq("tenant_id", tenantId)
        .eq("kind", "research")
        .limit(1)
        .single();

      artefact = data;
    }

    return ok(
      {
        job: {
          id: job.id,
          status: job.status,
          type: job.type,
          error: job.error,
          created_at: job.created_at,
          updated_at: job.updated_at,
        },
        artefact,
      },
      ctx.requestId
    );
  },
} as unknown as import("@/lib/api").HandlerConfig);
