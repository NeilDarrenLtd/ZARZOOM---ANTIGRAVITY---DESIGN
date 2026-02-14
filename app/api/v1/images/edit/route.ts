import {
  createApiHandler,
  accepted,
  badRequest,
  enforceQuota,
  incrementUsage,
  enqueueJob,
  ValidationError,
} from "@/lib/api";
import { imageEditSchema } from "@/lib/images";

/**
 * POST /api/v1/images/edit
 *
 * Validates input, checks entitlements/quota, creates a job,
 * enqueues it for the worker, and returns 202 with job_id.
 *
 * Worker responsibilities (documented here for implementors):
 * - Fetch the source image from storage via image_asset_id
 * - If mask_asset_id is present, fetch the mask image
 * - Call OpenAI Images API (edits endpoint) with image + mask + prompt
 * - Decode base64 or fetch URL output
 * - Store in bucket, create asset row
 * - Mark job succeeded with output_asset_ids in result JSONB
 * - Increment usage counters
 * - If callback_url provided, POST result there
 */
export const POST = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 20, windowMs: 60_000 },
  handler: async (ctx) => {
    const tenantId = ctx.membership!.tenantId;

    // --- Parse & validate input ---
    let body: unknown;
    try {
      body = await ctx.req.json();
    } catch {
      return badRequest(ctx.requestId, "Invalid JSON body");
    }

    const parsed = imageEditSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const input = parsed.data;

    // --- Entitlements / quota ---
    await enforceQuota(tenantId, "image_edits");

    // --- Enrich prompt with language hint ---
    const enrichedPrompt =
      input.language && input.language !== "en"
        ? `${input.prompt}\n\n[Return any text labels in ${input.language}]`
        : input.prompt;

    // --- Create job ---
    const { jobId } = await enqueueJob(
      tenantId,
      "image_edit",
      {
        prompt: enrichedPrompt,
        original_prompt: input.prompt,
        model: input.model,
        image_asset_id: input.image_asset_id,
        mask_asset_id: input.mask_asset_id ?? null,
        background: input.background ?? null,
        input_fidelity: input.input_fidelity ?? null,
        language: input.language ?? ctx.language,
        provider: "openai",
      },
      {
        callbackUrl: input.callback_url,
      }
    );

    // --- Increment usage ---
    await incrementUsage(tenantId, "image_edits");

    return accepted(
      {
        job_id: jobId,
        status_url: `/api/v1/jobs/${jobId}`,
      },
      ctx.requestId
    );
  },
});
