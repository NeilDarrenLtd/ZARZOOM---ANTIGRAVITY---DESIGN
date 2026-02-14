import { createServerClient } from "@supabase/ssr";
import {
  createApiHandler,
  accepted,
  badRequest,
  enforceQuota,
  incrementUsage,
  enqueueJob,
  ValidationError,
  NotFoundError,
} from "@/lib/api";
import { env } from "@/lib/api/env";
import { videoGenerateSchema } from "@/lib/videos";

/**
 * POST /api/v1/videos/generate
 *
 * Validates input with provider routing, checks entitlements/quota,
 * creates a job, enqueues it, and returns 202 with job_id.
 *
 * If script_artefact_id is provided, the worker reads the script
 * artefact content and uses it as the prompt/narrative input.
 *
 * Worker responsibilities per provider:
 *
 * HeyGen:
 *   - Create video via HeyGen API (avatar or video_agent mode)
 *   - Poll status or wait for webhook at /api/v1/webhooks/heygen
 *   - Download + store final video_url in bucket
 *
 * Kling:
 *   - Create via Kling API
 *   - Poll status (endpoints may need verification based on plan)
 *   - Download + store video in bucket
 *
 * Veo 3:
 *   - Create Vertex AI request
 *   - Poll operations endpoint
 *   - Copy from GCS to bucket
 *   - Store in bucket, create asset
 */
export const POST = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const tenantId = ctx.membership!.tenantId;

    // --- Parse & validate input ---
    let body: unknown;
    try {
      body = await ctx.req.json();
    } catch {
      return badRequest(ctx.requestId, "Invalid JSON body");
    }

    const parsed = videoGenerateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const input = parsed.data;

    // --- If script_artefact_id is provided, verify it exists ---
    let scriptContent: string | null = null;
    if (input.script_artefact_id) {
      const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
      const admin = createServerClient(
        NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        { cookies: { getAll: () => [], setAll() {} } }
      );

      const { data: artefact } = await admin
        .from("artefacts")
        .select("artefact_id, kind, content")
        .eq("artefact_id", input.script_artefact_id)
        .eq("tenant_id", tenantId)
        .single();

      if (!artefact) {
        throw new NotFoundError(
          "Artefact",
          `Script artefact "${input.script_artefact_id}" not found`
        );
      }

      if (artefact.kind !== "script") {
        return badRequest(
          ctx.requestId,
          `Artefact ${input.script_artefact_id} is kind "${artefact.kind}", expected "script"`
        );
      }

      // Extract the script text from the content JSONB
      const content = artefact.content as Record<string, unknown>;
      scriptContent =
        (content?.script_text as string) ??
        (content?.text as string) ??
        JSON.stringify(content);
    }

    // --- Entitlements / quota ---
    const quotaMetric = `video_${input.provider}`;
    await enforceQuota(tenantId, quotaMetric);

    // --- Build provider-specific payload ---
    const providerPayload: Record<string, unknown> = {
      prompt: input.prompt,
      language: input.language ?? ctx.language,
      duration_seconds: input.duration_seconds ?? null,
      aspect_ratio: input.aspect_ratio,
      resolution: input.resolution ?? null,
      script_artefact_id: input.script_artefact_id ?? null,
      script_content: scriptContent,
    };

    // Attach provider-specific options
    if (input.provider === "heygen" && input.heygen) {
      providerPayload.heygen = input.heygen;
    } else if (input.provider === "kling" && input.kling) {
      providerPayload.kling = input.kling;
    } else if (input.provider === "veo3" && input.veo3) {
      providerPayload.veo3 = input.veo3;
    }

    // --- Create job ---
    const { jobId } = await enqueueJob(
      tenantId,
      `video_generate`,
      {
        ...providerPayload,
        provider: input.provider,
      },
      {
        callbackUrl: input.callback_url,
      }
    );

    // --- Increment usage ---
    await incrementUsage(tenantId, quotaMetric);

    return accepted(
      {
        job_id: jobId,
        provider: input.provider,
        status_url: `/api/v1/jobs/${jobId}`,
      },
      ctx.requestId
    );
  },
});
