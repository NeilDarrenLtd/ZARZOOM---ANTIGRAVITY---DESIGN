import {
  createApiHandler,
  accepted,
  badRequest,
  enforceQuota,
  incrementUsage,
  enqueueJob,
  ValidationError,
} from "@/lib/api";
import { researchSocialSchema } from "@/lib/research";
import { resolvePromptTemplate } from "@/lib/research/prompts";

/**
 * POST /api/v1/research/social
 *
 * Creates an async research job powered by OpenRouter.
 *
 * Worker responsibilities (documented here for implementors):
 * - Read prompt_templates for template_key "research_social"
 *   (tenant override first, else global default)
 * - Call OpenRouter chat completions endpoint with web search plugin
 *   enabled (if available/configured for the model)
 * - Use structured output mode where possible: enforce JSON schema
 *   to get consistent research results
 * - Store structured output as artefact with kind "research"
 * - Always store OpenRouter usage tokens & cost metadata from response
 * - Write job_events for key steps
 * - If callback_url provided, POST result there
 *
 * IMPORTANT: Do NOT put any OpenRouter API key in browser code.
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

    const parsed = researchSocialSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const input = parsed.data;

    // --- Entitlements / quota ---
    await enforceQuota(tenantId, "research_social");

    // --- Resolve language (input > tenant default > ctx.language) ---
    const language = input.language ?? ctx.language;

    // --- Resolve prompt template ---
    const promptTemplate = await resolvePromptTemplate(
      tenantId,
      "research_social"
    );

    // --- Create job ---
    const { jobId } = await enqueueJob(
      tenantId,
      "research_social",
      {
        platform: input.platform,
        niche: input.niche,
        seed_keywords: input.seed_keywords ?? [],
        geo: input.geo ?? null,
        timeframe: input.timeframe,
        language,
        provider: "openrouter",
        prompt_template_id: promptTemplate?.templateId ?? null,
        prompt_version_id: promptTemplate?.versionId ?? null,
      },
      {
        callbackUrl: input.callback_url,
      }
    );

    // --- Increment usage ---
    await incrementUsage(tenantId, "research_social");

    return accepted(
      {
        job_id: jobId,
        status_url: `/api/v1/jobs/${jobId}`,
        artefact_url: `/api/v1/research/${jobId}`,
      },
      ctx.requestId
    );
  },
});
