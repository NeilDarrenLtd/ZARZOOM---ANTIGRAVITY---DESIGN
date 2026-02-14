import { z } from "zod";
import { createApiHandler, ok, notFound, badRequest } from "@/lib/api";

const paramsSchema = z.object({
  asset_id: z.string().uuid(),
});

/**
 * GET /api/v1/assets/{asset_id}
 *
 * Returns the asset (social_post) with its media_url.
 * If the media_url exists, returns a JSON body with a short-TTL signed-style
 * URL reference. The actual signing would be done by the storage provider;
 * for now we return the raw URL with a TTL hint so the client knows to
 * re-fetch after expiry.
 */
export const GET = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 120, windowMs: 60_000 },
  handler: async (ctx) => {
    const segments = ctx.req.nextUrl.pathname.split("/");
    const assetIdRaw = segments[segments.length - 1];
    const parsed = paramsSchema.safeParse({ asset_id: assetIdRaw });

    if (!parsed.success) {
      return badRequest(ctx.requestId, "Invalid asset_id", parsed.error.flatten().fieldErrors);
    }

    const { asset_id } = parsed.data;
    const tenantId = ctx.membership!.tenantId;

    const { data: asset, error } = await ctx.supabase!
      .from("social_posts")
      .select("id, text_content, media_url, media_asset_id, status, post_type, platforms, platform_results, schedule_at, created_at, updated_at")
      .eq("id", asset_id)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !asset) {
      return notFound(ctx.requestId, "Asset not found");
    }

    // Build a signed URL response.
    // In production this would call Supabase Storage createSignedUrl() or
    // an equivalent; for now we return the stored URL with TTL metadata.
    const signedUrl = asset.media_url ?? null;
    const ttlSeconds = 300; // 5-minute TTL

    return ok({
      asset_id: asset.id,
      text_content: asset.text_content,
      media_url: signedUrl,
      url_ttl_seconds: signedUrl ? ttlSeconds : null,
      post_type: asset.post_type,
      status: asset.status,
      platforms: asset.platforms,
      platform_results: asset.platform_results,
      schedule_at: asset.schedule_at,
      created_at: asset.created_at,
      updated_at: asset.updated_at,
    }, ctx.requestId);
  },
});
