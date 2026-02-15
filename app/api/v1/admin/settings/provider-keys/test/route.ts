import { createApiHandler, accepted } from "@/lib/api";
import { enqueueJob } from "@/lib/api/queue";
import { providerEnum } from "@/lib/admin/schemas";
import { ValidationError } from "@/lib/api/errors";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  POST /api/v1/admin/settings/provider-keys/test                     */
/*  Enqueues a "test_provider_key" job. The external Worker will       */
/*  attempt a lightweight connectivity check (e.g. list-models) and    */
/*  update the job row with success/failure.                           */
/*                                                                     */
/*  Returns 202 + job_id so the UI can poll GET /jobs/:id for result.  */
/* ------------------------------------------------------------------ */

const testSchema = z.object({
  provider: providerEnum,
});

export const POST = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 5, windowMs: 60_000 },
  handler: async (ctx) => {
    const body = await ctx.req.json();
    const parsed = testSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { provider } = parsed.data;
    const tenantId = ctx.membership!.tenantId;

    // Enqueue the test job -- the Worker handles the actual call.
    // For now this is a stub: the job row is created and the Worker
    // can check provider connectivity when the handler is implemented.
    const { jobId } = await enqueueJob(tenantId, "test_provider_key", {
      provider,
      requested_by: ctx.user!.id,
    });

    return accepted(
      {
        job_id: jobId,
        status_url: `/api/v1/jobs/${jobId}`,
        message: `Test connection job enqueued for provider "${provider}".`,
      },
      ctx.requestId
    );
  },
});
