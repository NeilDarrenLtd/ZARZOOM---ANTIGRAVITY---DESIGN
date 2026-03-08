import { createApiHandler, ok } from "@/lib/api";
import { NotFoundError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/v1/admin/email-queue/[id]
 * Fetch full details for a single queued email (admin only).
 */
export const GET = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true,
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const id = ctx.req.nextUrl.pathname.split("/").pop()!;

    const supabase = await createAdminClient();

    const { data: email, error } = await supabase
      .from("email_queue")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !email) {
      throw new NotFoundError("Email");
    }

    return ok({ email }, ctx.requestId);
  },
});
