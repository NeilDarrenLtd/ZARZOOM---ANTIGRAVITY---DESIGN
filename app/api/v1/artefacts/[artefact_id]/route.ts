import { z } from "zod";
import { createApiHandler, ok, notFound, badRequest } from "@/lib/api";

const paramsSchema = z.object({
  artefact_id: z.string().uuid(),
});

/**
 * GET /api/v1/artefacts/{artefact_id}
 *
 * Returns a stored research/article/script artefact with its full content.
 * Tenant-isolated via membership context.
 */
export const GET = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const segments = ctx.req.nextUrl.pathname.split("/");
    const artefactIdRaw = segments[segments.length - 1];
    const parsed = paramsSchema.safeParse({ artefact_id: artefactIdRaw });

    if (!parsed.success) {
      return badRequest(ctx.requestId, "Invalid artefact_id", parsed.error.flatten().fieldErrors);
    }

    const { artefact_id } = parsed.data;
    const tenantId = ctx.membership!.tenantId;

    const { data: artefact, error } = await ctx.supabase!
      .from("artefacts")
      .select("artefact_id, title, kind, language, content, source_job_id, created_at")
      .eq("artefact_id", artefact_id)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !artefact) {
      return notFound(ctx.requestId, "Artefact not found");
    }

    return ok({
      artefact_id: artefact.artefact_id,
      title: artefact.title,
      kind: artefact.kind,
      language: artefact.language,
      content: artefact.content,
      source_job_id: artefact.source_job_id,
      created_at: artefact.created_at,
    }, ctx.requestId);
  },
});
