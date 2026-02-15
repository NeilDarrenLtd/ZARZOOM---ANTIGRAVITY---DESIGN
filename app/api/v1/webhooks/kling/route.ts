import { type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/api/env";
import { getRequestId } from "@/lib/api/request-id";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api/http-responses";
import { klingWebhookSchema } from "@/lib/videos";

/**
 * POST /api/v1/webhooks/kling
 *
 * Receives Kling video generation status callbacks.
 * Only active if the tenant's plan supports Kling callbacks;
 * otherwise the worker relies on polling.
 *
 * Authentication: token-in-URL verification.
 *   Expected URL: /api/v1/webhooks/kling?token=<KLING_WEBHOOK_TOKEN>
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);

  try {
    // --- Token verification ---
    const token = req.nextUrl.searchParams.get("token");
    const expectedToken = process.env.KLING_WEBHOOK_TOKEN;

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

    const parsed = klingWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(requestId, "Invalid webhook payload", parsed.error.flatten().fieldErrors);
    }

    const payload = parsed.data;

    // --- Deduplication ---
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
      event_type: `kling.${payload.status}`,
      payload: payload as unknown as Record<string, unknown>,
      payload_hash: payloadHash,
      processed: false,
    });

    // --- Find matching job by task_id ---
    const { data: jobs } = await admin
      .from("jobs")
      .select("id, tenant_id, status, payload")
      .eq("type", "video_generate")
      .in("status", ["pending", "running", "scheduled"])
      .limit(50);

    const matchingJob = jobs?.find((j) => {
      const p = j.payload as Record<string, unknown> | null;
      return p && p.kling_task_id === payload.task_id;
    });

    if (!matchingJob) {
      return ok({ status: "no_matching_job", requestId }, requestId);
    }

    // --- Map status (normalised to canonical set) ---
    const statusMap: Record<string, string> = {
      completed: "completed",
      success: "completed",
      failed: "failed",
      processing: "running",
    };

    const newStatus = statusMap[payload.status] ?? "running";

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "completed" && payload.video_url) {
      updateData.result = {
        video_url: payload.video_url,
        kling_task_id: payload.task_id,
      };
    }

    if (newStatus === "failed") {
      updateData.error = payload.error_message ?? `Kling status: ${payload.status}`;
    }

    await admin.from("jobs").update(updateData).eq("id", matchingJob.id);

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
    console.error(`[API] Kling webhook error (${requestId}):`, err);
    return serverError(requestId);
  }
}
