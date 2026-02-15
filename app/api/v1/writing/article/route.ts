import {
  createApiHandler,
  accepted,
  badRequest,
  enqueueJob,
  ValidationError,
} from "@/lib/api";
import { writeArticleSchema } from "@/lib/research";
import { resolvePromptTemplate } from "@/lib/research/prompts";

/**
 * POST /api/v1/writing/article
 *
 * Creates an async article generation job powered by OpenRouter.
 *
 * Worker responsibilities:
 * - If research_job_id is provided, load the research artefact for context
 * - Read prompt_templates for template_key "generate_article"
 * - Call OpenRouter chat completions with structured output mode
 * - Store output as artefact with kind "article"
 * - Store usage tokens & cost metadata
 * - Write job_events for key steps
 * - If callback_url provided, POST result there
 */
export const POST = createApiHandler({
  requiredRole: "member",
  requiredEntitlement: "generate_article",
  quotaMetric: "generate_article",
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

    const parsed = writeArticleSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const input = parsed.data;

    // --- Resolve language ---
    const language = input.language ?? ctx.language;

    // --- Resolve prompt template ---
    const promptTemplate = await resolvePromptTemplate(
      tenantId,
      "generate_article"
    );

    // --- Create job ---
    const { jobId } = await enqueueJob(
      tenantId,
      "generate_article",
      {
        research_job_id: input.research_job_id ?? null,
        research_summary: input.research_summary ?? null,
        title_preferences: input.title_preferences ?? null,
        hashtags: input.hashtags ?? [],
        audience: input.audience ?? null,
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
