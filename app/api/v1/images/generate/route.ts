import { z } from "zod";
import {
  createApiHandler,
  accepted,
  badRequest,
  enqueueJob,
  ValidationError,
} from "@/lib/api";
import { imageGenerateSchema } from "@/lib/images";

/**
 * POST /api/v1/images/generate
 *
 * Validates input, checks entitlements/quota, creates a job,
 * enqueues it for the worker, and returns 202 with job_id.
 *
 * Worker responsibilities (documented here for implementors):
 * - Call OpenAI Images API (generations endpoint)
 * - Decode base64 or fetch URL output
 * - Store in bucket, create asset row
 * - Mark job succeeded with output_asset_ids in result JSONB
 * - Increment usage counters
 * - If callback_url provided, POST result there
 *
 * OpenAI provider has no image completion webhooks; the worker
 * completes the job synchronously and optionally triggers callback_url.
 */
export const POST = createApiHandler({
  requiredRole: "member",
  requiredEntitlement: "image_generate",
  quotaMetric: "image_generations",
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const tenantId = ctx.membership!.tenantId;

    // --- Parse & validate input ---
    let body: unknown;
    try {
      body = await ctx.req.json();
    } catch {
      return badRequest(ctx.requestId, "Invalid JSON body");
    }

    const parsed = imageGenerateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const input = parsed.data;

    // --- Enrich prompt with language hint ---
    const enrichedPrompt =
      input.language && input.language !== "en"
        ? `${input.prompt}\n\n[Return any text labels in ${input.language}]`
        : input.prompt;

    // --- Create job ---
    const { jobId } = await enqueueJob(
      tenantId,
      "image_generate",
      {
        prompt: enrichedPrompt,
        original_prompt: input.prompt,
        model: input.model,
        size: input.size,
        quality: input.quality,
        n: input.n,
        language: input.language ?? ctx.language,
        provider: "openai",
      },
      {
        callbackUrl: input.callback_url,
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
