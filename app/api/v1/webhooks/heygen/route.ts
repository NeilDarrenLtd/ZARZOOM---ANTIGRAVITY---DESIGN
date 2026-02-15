import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/api/env";
import { getRequestId } from "@/lib/api/request-id";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api/http-responses";
import { heygenWebhookSchema } from "@/lib/videos";

/**
 * POST /api/v1/webhooks/heygen
 *
 * Receives HeyGen video generation status callbacks.
 *
 * Authentication: token-in-URL verification.
 *   Expected URL: /api/v1/webhooks/heygen?token=<HEYGEN_WEBHOOK_TOKEN>
 *
 * Flow:
 * 1. Verify token
 * 2. Parse + validate payload
 * 3. Deduplicate (SHA-256 hash of body)
 * 4. Find the matching job by provider video_id in payload
 * 5. Update job status based on event_type
 * 6. If video_url is present, enqueue a download-and-store job
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);

  try {
    // --- Token verification ---
    const token = req.nextUrl.searchParams.get("token");
    const expectedToken = process.env.HEYGEN_WEBHOOK_TOKEN;

    if (!expectedToken || token !== expectedToken) {
      return unauthorized(requestId, "Invalid webhook token");
    }

    // --- Parse body ---
    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch {
      return badRequest(requestId, "Could not read request body");
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return badRequest(requestId, "Invalid JSON body");
    }

    const parsed = heygenWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(requestId, "Invalid webhook payload", parsed.error.flatten().fieldErrors);
    }

    const payload = parsed.data;

    // --- Deduplication via SHA-256 hash ---
    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
    const admin = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { getAll: () => [], setAll() {} } }
    );

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawBody));
    const payloadHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: existing } = await admin
      .from("social_webhook_events")
      .select("id")
      .eq("payload_hash", payloadHash)
      .limit(1)
      .single();

    if (existing) {
      return ok({ status: "duplicate", requestId }, requestId);
    }

    // --- Store webhook event ---
    await admin.from("social_webhook_events").insert({
      event_type: `heygen.${payload.event_type}`,
      payload: payload as unknown as Record<string, unknown>,
      payload_hash: payloadHash,
      processed: false,
    });

    // --- Find matching job ---
    // HeyGen sends callback_id which we store in job payload.heygen_callback_id,
    // or video_id which maps to job payload.provider_video_id
    const videoId = payload.data.video_id ?? payload.data.callback_id;
    if (!videoId) {
      return ok({ status: "no_video_id", requestId }, requestId);
    }

    // Search jobs that have this video_id in their payload
    const { data: jobs } = await admin
      .from("jobs")
      .select("id, tenant_id, status, payload")
      .eq("type", "video_generate")
      .in("status", ["pending", "running", "scheduled"])
      .limit(50);

    const matchingJob = jobs?.find((j) => {
      const p = j.payload as Record<string, unknown> | null;
      return (
        p &&
        (p.provider_video_id === videoId ||
          p.heygen_callback_id === videoId ||
          p.heygen_video_id === videoId)
      );
    });

    if (!matchingJob) {
      // Store event but no matching job yet -- worker may not have set IDs
      return ok({ status: "no_matching_job", requestId }, requestId);
    }

    // --- Map HeyGen event to job status (normalised to canonical set) ---
    const statusMap: Record<string, string> = {
      "video.completed": "completed",
      "video.success": "completed",
      "video.failed": "failed",
      "video.processing": "running",
      "avatar_video.success": "completed",
      "avatar_video.failed": "failed",
    };

    const newStatus = statusMap[payload.event_type] ?? "running";

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "completed" && payload.data.video_url) {
      updateData.result = {
        ...(matchingJob.payload as Record<string, unknown>),
        video_url: payload.data.video_url,
        heygen_event: payload.event_type,
      };
    }

    if (newStatus === "failed") {
      updateData.error = payload.data.error ?? `HeyGen event: ${payload.event_type}`;
    }

    await admin
      .from("jobs")
      .update(updateData)
      .eq("id", matchingJob.id);

    // Mark webhook event as processed
    await admin
      .from("social_webhook_events")
      .update({ processed: true })
      .eq("payload_hash", payloadHash);

    return ok(
      {
        status: "processed",
        job_id: matchingJob.id,
        new_status: newStatus,
        requestId,
      },
      requestId
    );
  } catch (err) {
    console.error(`[API] HeyGen webhook error (${requestId}):`, err);
    return serverError(requestId);
  }
}
