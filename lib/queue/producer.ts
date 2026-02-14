import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/api/env";
import { signMessage } from "./signing";
import { getRetryConfig, type QueueMessage } from "./types";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

/**
 * Get the queue signing secret.
 * Falls back to SUPABASE_SERVICE_ROLE_KEY if QUEUE_SIGNING_SECRET is not set.
 * In production, a dedicated QUEUE_SIGNING_SECRET is recommended.
 */
function getSigningSecret(): string {
  return process.env.QUEUE_SIGNING_SECRET || env().SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Get the optional push URL for HTTP push queues.
 * When set, the producer will POST the message to this URL after
 * persisting it to the jobs table.
 */
function getPushUrl(): string | null {
  return process.env.QUEUE_PUSH_URL || null;
}

/* ------------------------------------------------------------------ */
/*  Admin Supabase client (no cookie context)                          */
/* ------------------------------------------------------------------ */

function getAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll: () => [],
      setAll(_cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {},
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Core types                                                         */
/* ------------------------------------------------------------------ */

export interface EnqueueOptions {
  /** Job priority (lower = higher priority). Default: 100 */
  priority?: number;
  /** Optional callback URL to POST results to on completion. */
  callbackUrl?: string;
  /** Override max attempts (otherwise uses RETRY_DEFAULTS for the type). */
  maxAttempts?: number;
}

export interface EnqueueResult {
  jobId: string;
  status: "pending" | "scheduled";
  /** The signed message that was (or would be) pushed to the worker. */
  message: QueueMessage;
}

/* ------------------------------------------------------------------ */
/*  Push to HTTP queue (if configured)                                 */
/* ------------------------------------------------------------------ */

async function pushToQueue(message: QueueMessage): Promise<void> {
  const pushUrl = getPushUrl();
  if (!pushUrl) return; // Pull mode -- worker polls the jobs table

  try {
    const res = await fetch(pushUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Queue-Signature": message.signature,
      },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      console.warn(
        `[Queue] Push to ${pushUrl} returned ${res.status}: ${await res.text().catch(() => "")}`
      );
      // Not fatal -- the job is already persisted in the DB.
      // The worker can still poll for it.
    }
  } catch (err) {
    console.warn(`[Queue] Push to ${pushUrl} failed:`, err);
    // Not fatal -- same fallback to polling.
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Enqueue a job for immediate processing.
 *
 * 1. Persists a row in the `jobs` table with status `pending`.
 * 2. Signs the message with HMAC-SHA256.
 * 3. If QUEUE_PUSH_URL is configured, POSTs the message to the queue.
 */
export async function enqueueNow(
  tenantId: string,
  type: string,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {}
): Promise<EnqueueResult> {
  const retryConfig = getRetryConfig(type);
  const maxAttempts = options.maxAttempts ?? retryConfig.maxAttempts;
  const now = new Date().toISOString();

  const admin = getAdminClient();

  const { data, error } = await admin
    .from("jobs")
    .insert({
      tenant_id: tenantId,
      type,
      payload,
      status: "pending",
      priority: options.priority ?? 100,
      scheduled_for: null,
      callback_url: options.callbackUrl ?? null,
      max_attempts: maxAttempts,
      attempt: 0,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to enqueue job: ${error?.message ?? "unknown"}`);
  }

  const jobId = data.id;
  const signature = signMessage(jobId, tenantId, type, now, getSigningSecret());

  const message: QueueMessage = {
    job_id: jobId,
    tenant_id: tenantId,
    type,
    attempt: 0,
    scheduled_for: now,
    enqueued_at: now,
    payload,
    max_attempts: maxAttempts,
    priority: options.priority ?? 100,
    callback_url: options.callbackUrl ?? null,
    signature,
  };

  await pushToQueue(message);

  return { jobId, status: "pending", message };
}

/**
 * Enqueue a job for delayed processing.
 *
 * Use cases:
 * - Polling back-off: `enqueueDelayed(tid, "social.post.poll", {}, { delayMs: 30_000 })`
 * - Scheduled future work: `enqueueDelayed(tid, "email.send", {}, { scheduledFor: new Date("2026-03-01") })`
 *
 * 1. Persists a row in the `jobs` table with status `scheduled`.
 * 2. Signs the message.
 * 3. If QUEUE_PUSH_URL is configured, POSTs the message (the worker
 *    or queue service is responsible for holding it until `scheduled_for`).
 */
export async function enqueueDelayed(
  tenantId: string,
  type: string,
  payload: Record<string, unknown>,
  options: EnqueueOptions & {
    /** Delay in milliseconds from now. Mutually exclusive with scheduledFor. */
    delayMs?: number;
    /** Absolute scheduled time. Mutually exclusive with delayMs. */
    scheduledFor?: Date;
  } = {}
): Promise<EnqueueResult> {
  const retryConfig = getRetryConfig(type);
  const maxAttempts = options.maxAttempts ?? retryConfig.maxAttempts;

  const now = new Date();
  let scheduledDate: Date;

  if (options.scheduledFor) {
    scheduledDate = options.scheduledFor;
  } else if (options.delayMs) {
    scheduledDate = new Date(now.getTime() + options.delayMs);
  } else {
    throw new Error("enqueueDelayed requires either delayMs or scheduledFor");
  }

  const scheduledFor = scheduledDate.toISOString();
  const enqueuedAt = now.toISOString();

  const admin = getAdminClient();

  const { data, error } = await admin
    .from("jobs")
    .insert({
      tenant_id: tenantId,
      type,
      payload,
      status: "scheduled",
      priority: options.priority ?? 100,
      scheduled_for: scheduledFor,
      callback_url: options.callbackUrl ?? null,
      max_attempts: maxAttempts,
      attempt: 0,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to enqueue delayed job: ${error?.message ?? "unknown"}`
    );
  }

  const jobId = data.id;
  const signature = signMessage(
    jobId,
    tenantId,
    type,
    scheduledFor,
    getSigningSecret()
  );

  const message: QueueMessage = {
    job_id: jobId,
    tenant_id: tenantId,
    type,
    attempt: 0,
    scheduled_for: scheduledFor,
    enqueued_at: enqueuedAt,
    payload,
    max_attempts: maxAttempts,
    priority: options.priority ?? 100,
    callback_url: options.callbackUrl ?? null,
    signature,
  };

  await pushToQueue(message);

  return { jobId, status: "scheduled", message };
}
