import {
  createApiHandler,
  accepted,
  badRequest,
  enqueueJob,
  ValidationError,
} from "@/lib/api";
import { writeScriptSchema } from "@/lib/research";
import { resolvePromptTemplate } from "@/lib/research/prompts";

/**
 * POST /api/v1/writing/script
 *
 * Creates an async script generation job powered by OpenRouter.
 * Requires the "generate_script" entitlement (Advanced plan).
 *
 * Worker responsibilities:
 * - If article_job_id is provided, load the article artefact for context
 * - Read prompt_templates for template_key "generate_script"
 * - Call OpenRouter chat completions with structured output mode
 * - Output should be a timed script suitable for the target platform
 *   and duration_seconds
 * - Store output as artefact with kind "script"
 * - Store usage tokens & cost metadata
 * - Write job_events for key steps
 * - If callback_url provided, POST result there
 */
export const POST = createApiHandler({
  requiredRole: "member",
  requiredEntitlement: "generate_script",
  quotaMetric: "generate_script",
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

    const parsed = writeScriptSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const input = parsed.data;

    // --- Resolve language ---
    const language = input.language ?? ctx.language;

    // --- Resolve prompt template ---
    const promptTemplate = await resolvePromptTemplate(
      tenantId,
      "generate_script"
    );

    // --- Create job ---
    const { jobId } = await enqueueJob(
      tenantId,
      "generate_script",
      {
        article_job_id: input.article_job_id ?? null,
        article_text: input.article_text ?? null,
        hashtags: input.hashtags ?? [],
        duration_seconds: input.duration_seconds,
        platform: input.platform ?? null,
        language,
        provider: "openrouter",
        prompt_template_id: promptTemplate?.templateId ?? null,
        prompt_version_id: promptTemplate?.versionId ?? null,
      },
      {
        callbackUrl: input.callback_url,
      }
    );

    return accepted(
      {
        job_id: jobId,
        status_url: `/api/v1/jobs/${jobId}`,
        artefact_url: `/api/v1/writing/${jobId}`,
      },
      ctx.requestId
    );
  },
});
