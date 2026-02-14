import { createServerClient } from "@supabase/ssr";
import { createApiHandler, accepted, enqueueJob } from "@/lib/api";
import { env } from "@/lib/api/env";
import { testPromptSchema } from "@/lib/admin/schemas";
import { resolvePromptTemplate } from "@/lib/research/prompts";
import { writeAuditLog } from "@/lib/admin/audit";
import { ValidationError, NotFoundError } from "@/lib/api/errors";

/* ------------------------------------------------------------------ */
/*  POST /api/v1/admin/prompts/test                                    */
/*  Enqueues a prompt_test job using the active template version.      */
/*  Output artefacts are marked test=true and excluded from public     */
/*  lists.                                                             */
/* ------------------------------------------------------------------ */

export const POST = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const body = await ctx.req.json();
    const parsed = testPromptSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { template_key, test_input_json, language } = parsed.data;
    const tenantId = ctx.membership!.tenantId;

    // Resolve the active prompt template
    const template = await resolvePromptTemplate(tenantId, template_key);
    if (!template) {
      throw new NotFoundError(
        "PromptTemplate",
        `No active prompt template found for "${template_key}". Create one first.`
      );
    }

    // Enqueue a prompt_test job
    const { jobId } = await enqueueJob(tenantId, "prompt_test", {
      template_key,
      template_id: template.templateId,
      version_id: template.versionId,
      system_prompt: template.systemPrompt,
      user_prompt_template: template.userPromptTemplate,
      output_schema: template.outputSchema,
      test_input: test_input_json,
      language: language ?? ctx.language,
      provider: "openrouter",
      is_test: true,
    });

    // Write audit log
    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId,
      tableName: "jobs",
      recordId: jobId,
      action: "prompt_test_enqueued",
      changes: {
        template_key,
        version_id: template.versionId,
        input_keys: Object.keys(test_input_json),
      },
    });

    return accepted(
      {
        job_id: jobId,
        template_key,
        version_id: template.versionId,
        status_url: `/api/v1/jobs/${jobId}`,
        note: "Test results are ephemeral and will not appear in public artefact lists.",
      },
      ctx.requestId
    );
  },
});
