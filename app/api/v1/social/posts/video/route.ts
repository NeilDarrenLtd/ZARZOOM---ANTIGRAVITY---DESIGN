import { createApiHandler, badRequest } from "@/lib/api";
import { videoPostSchema } from "@/lib/social";
import { publishPost, type PublishMediaInput } from "@/lib/social/publish";

/**
 * POST /api/v1/social/posts/video
 *
 * Publish a video post to one or more platforms.
 *
 * Input: { profile_username, platforms[], text, video_asset_id | video_url, schedule_at?, callback_url? }
 * Returns: 202 { job_id, post_id, status_url }
 */
export const POST = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    let body: unknown;
    try {
      body = await ctx.req.json();
    } catch {
      return badRequest(ctx.requestId, "Invalid JSON body");
    }

    const parsed = videoPostSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(
        ctx.requestId,
        "Validation failed",
        parsed.error.flatten().fieldErrors
      );
    }

    const input: PublishMediaInput = {
      ...parsed.data,
      media_asset_id: parsed.data.video_asset_id,
      media_url: parsed.data.video_url,
    };

    return publishPost(ctx, "video", input);
  },
});
