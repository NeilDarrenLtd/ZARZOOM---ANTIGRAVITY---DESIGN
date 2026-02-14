import type { NextResponse } from "next/server";
import type { ApiContext } from "@/lib/api/handler";
import { accepted, badRequest } from "@/lib/api/http-responses";
import { NotFoundError } from "@/lib/api/errors";
import { enforceQuota, incrementUsage, enqueueJob } from "@/lib/api";
import { env } from "@/lib/api/env";
import { createServerClient } from "@supabase/ssr";
import type { Platform } from "./schemas";

/* ------------------------------------------------------------------ */
/*  Shared social-post publishing logic                                */
/* ------------------------------------------------------------------ */

export interface PublishInput {
  profile_username: string;
  platforms: Platform[];
  text: string;
  schedule_at?: string;
  timezone?: string;
  callback_url?: string;
}

export interface PublishMediaInput extends PublishInput {
  media_asset_id?: string;
  media_url?: string;
}

/**
 * Core function shared by all three publishing routes.
 *
 * 1. Resolves the social_profile row
 * 2. Checks social_posts quota
 * 3. Inserts a social_posts row (status: queued)
 * 4. Enqueues a job for the worker
 * 5. Increments usage
 * 6. Returns 202 { job_id, post_id, status_url }
 */
export async function publishPost(
  ctx: ApiContext,
  postType: "text" | "photo" | "video",
  input: PublishInput | PublishMediaInput
): Promise<NextResponse> {
  const tenantId = ctx.membership!.tenantId;
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

  const admin = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { cookies: { getAll: () => [], setAll() {} } }
  );

  // 1. Resolve profile
  const { data: profile, error: profileError } = await admin
    .from("social_profiles")
    .select("id, profile_username, status")
    .eq("tenant_id", tenantId)
    .eq("profile_username", input.profile_username)
    .single();

  if (profileError || !profile) {
    throw new NotFoundError(
      "Social profile",
      `Profile "${input.profile_username}" not found`
    );
  }

  // 2. Check quota
  await enforceQuota(tenantId, "social_posts");

  // 3. Build media fields
  const mediaInput = input as PublishMediaInput;
  const mediaAssetId = mediaInput.media_asset_id ?? null;
  const mediaUrl = mediaInput.media_url ?? null;

  // 4. Insert social_posts row
  const { data: post, error: postError } = await admin
    .from("social_posts")
    .insert({
      tenant_id: tenantId,
      profile_id: profile.id,
      post_type: postType,
      text_content: input.text,
      platforms: input.platforms,
      schedule_at: input.schedule_at ?? null,
      timezone: input.timezone ?? null,
      callback_url: input.callback_url ?? null,
      media_asset_id: mediaAssetId,
      media_url: mediaUrl,
      status: "queued",
    })
    .select("id")
    .single();

  if (postError || !post) {
    console.error(
      `[API] social_posts insert error (${ctx.requestId}):`,
      postError?.message
    );
    return badRequest(ctx.requestId, "Failed to create post record");
  }

  // 5. Enqueue job
  const { jobId } = await enqueueJob(
    tenantId,
    `social.post.${postType}`,
    {
      post_id: post.id,
      profile_id: profile.id,
      profile_username: input.profile_username,
      platforms: input.platforms,
      text: input.text,
      media_asset_id: mediaAssetId,
      media_url: mediaUrl,
      schedule_at: input.schedule_at ?? null,
      timezone: input.timezone ?? null,
      provider: "uploadpost",
    },
    {
      callbackUrl: input.callback_url,
      scheduledFor: input.schedule_at
        ? new Date(input.schedule_at)
        : undefined,
    }
  );

  // Update post with job_id
  await admin
    .from("social_posts")
    .update({ job_id: jobId })
    .eq("id", post.id);

  // 6. Increment usage
  await incrementUsage(tenantId, "social_posts");

  return accepted(
    {
      job_id: jobId,
      post_id: post.id,
      status_url: `/api/v1/jobs/${jobId}`,
    },
    ctx.requestId
  );
}
