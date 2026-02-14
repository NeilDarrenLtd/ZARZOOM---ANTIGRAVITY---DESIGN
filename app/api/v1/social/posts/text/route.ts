import { createApiHandler, badRequest } from "@/lib/api";
import { textPostSchema } from "@/lib/social";
import { publishPost } from "@/lib/social/publish";

/**
 * POST /api/v1/social/posts/text
 *
 * Publish a text-only post to one or more platforms.
 *
 * Input: { profile_username, platforms[], text, schedule_at?, timezone?, callback_url? }
 * Returns: 202 { job_id, post_id, status_url }
 */
export const POST = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    let body: unknown;
    try {
      body = await ctx.req.json();
    } catch {
      return badRequest(ctx.requestId, "Invalid JSON body");
    }

    const parsed = textPostSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(
        ctx.requestId,
        "Validation failed",
        parsed.error.flatten().fieldErrors
      );
    }

    return publishPost(ctx, "text", parsed.data);
  },
});
