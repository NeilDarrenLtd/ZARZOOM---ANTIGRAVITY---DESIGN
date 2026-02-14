import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/api/env";
import { getRequestId } from "@/lib/api/request-id";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api/http-responses";
import { uploadPostConfig } from "@/lib/social/config";
import crypto from "crypto";

/**
 * POST /api/v1/webhooks/uploadpost
 *
 * Receives webhook events from Upload-Post.
 * - Verifies token-in-URL or secret header authentication
 * - Deduplicates by payload_hash using social_webhook_events table
 * - Updates job state and social_posts status
 *
 * This handler is PUBLIC (no Supabase user auth) -- auth is via
 * the webhook secret token.
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);

  try {
    // ---- 1. Verify webhook authentication ----
    const cfg = uploadPostConfig();

    // Support both token-in-URL (?token=...) and header-based auth
    const urlToken = req.nextUrl.searchParams.get("token");
    const headerToken = req.headers.get("x-webhook-secret");
    const providedToken = urlToken || headerToken;

    if (cfg.UPLOADPOST_WEBHOOK_SECRET && providedToken !== cfg.UPLOADPOST_WEBHOOK_SECRET) {
      console.warn(
        `[webhook] Unauthorized Upload-Post webhook attempt (${requestId})`
      );
      return unauthorized(requestId, "Invalid webhook token");
    }

    // ---- 2. Parse payload ----
    let payload: Record<string, unknown>;
    try {
      payload = (await req.json()) as Record<string, unknown>;
    } catch {
      return badRequest(requestId, "Invalid JSON body");
    }

    const event = (payload.event as string) ?? "unknown";
    const providerJobId = (payload.job_id ?? payload.provider_job_id) as string | undefined;
    const status = payload.status as string | undefined;

    // ---- 3. Compute payload hash for deduplication ----
    const payloadStr = JSON.stringify(payload);
    const payloadHash = crypto
      .createHash("sha256")
      .update(payloadStr)
      .digest("hex");

    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
    const admin = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { getAll: () => [], setAll() {} } }
    );

    // ---- 4. Deduplicate ----
    const { data: existing } = await admin
      .from("social_webhook_events")
      .select("id")
      .eq("payload_hash", payloadHash)
      .limit(1)
      .single();

    if (existing) {
      // Already processed -- return 200 to acknowledge
      return ok(
        { message: "Duplicate webhook event, already processed" },
        requestId
      );
    }

    // ---- 5. Store the webhook event ----
    // We need a tenant_id. Try to find it from the job or post.
    let tenantId: string | null = null;

    if (providerJobId) {
      // Look up the social_posts row by provider_post_id
      const { data: post } = await admin
        .from("social_posts")
        .select("tenant_id, id, job_id")
        .eq("provider_post_id", providerJobId)
        .limit(1)
        .single();

      if (post) {
        tenantId = post.tenant_id;
      }
    }

    await admin.from("social_webhook_events").insert({
      event_type: event,
      payload,
      payload_hash: payloadHash,
      processed: false,
      tenant_id: tenantId,
    });

    // ---- 6. Update job and post state ----
    if (providerJobId && status) {
      // Map provider statuses to our internal statuses
      const statusMap: Record<string, string> = {
        completed: "completed",
        success: "completed",
        published: "completed",
        failed: "failed",
        error: "failed",
        processing: "running",
        pending: "pending",
        scheduled: "scheduled",
        cancelled: "cancelled",
      };

      const mappedStatus = statusMap[status.toLowerCase()] ?? status;

      // Update social_posts
      const postUpdate: Record<string, unknown> = {
        status: mappedStatus,
        updated_at: new Date().toISOString(),
      };

      // If the provider returned platform-specific results, store them
      if (payload.data && typeof payload.data === "object") {
        postUpdate.platform_results = payload.data;
      }

      // If failed, store the error
      if (mappedStatus === "failed" && payload.error) {
        postUpdate.error = String(payload.error);
      }

      await admin
        .from("social_posts")
        .update(postUpdate)
        .eq("provider_post_id", providerJobId);

      // Update the corresponding internal job
      const { data: post } = await admin
        .from("social_posts")
        .select("job_id")
        .eq("provider_post_id", providerJobId)
        .limit(1)
        .single();

      if (post?.job_id) {
        const jobUpdate: Record<string, unknown> = {
          status: mappedStatus,
          updated_at: new Date().toISOString(),
        };

        if (mappedStatus === "completed") {
          jobUpdate.result = payload.data ?? {};
        }
        if (mappedStatus === "failed") {
          jobUpdate.error = String(payload.error ?? "Provider reported failure");
        }

        await admin
          .from("jobs")
          .update(jobUpdate)
          .eq("id", post.job_id);
      }

      // Mark webhook event as processed
      await admin
        .from("social_webhook_events")
        .update({ processed: true })
        .eq("payload_hash", payloadHash);
    }

    return ok({ message: "Webhook processed" }, requestId);
  } catch (err) {
    console.error(
      `[webhook] Upload-Post webhook error (${requestId}):`,
      err
    );
    return serverError(requestId);
  }
}
