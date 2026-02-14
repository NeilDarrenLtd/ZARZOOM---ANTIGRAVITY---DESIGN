/**
 * Backward-compatible queue functions.
 *
 * These re-export / wrap the new `@/lib/queue` producer so existing
 * callers (`enqueueJob`, `getJobStatus`) continue to work unchanged.
 */

import { createServerClient } from "@supabase/ssr";
import { env } from "./env";
import { enqueueNow, type EnqueueResult as NewEnqueueResult } from "@/lib/queue";

/* ------------------------------------------------------------------ */
/*  Legacy types (kept for backward compatibility)                     */
/* ------------------------------------------------------------------ */

export interface EnqueueOptions {
  priority?: number;
  scheduledFor?: Date;
  callbackUrl?: string;
  maxAttempts?: number;
}

export interface EnqueueResult {
  jobId: string;
  status: "pending" | "scheduled";
}

/* ------------------------------------------------------------------ */
/*  enqueueJob -- delegates to the new producer                        */
/* ------------------------------------------------------------------ */

/**
 * Enqueue a background job.
 *
 * This is the legacy API -- it delegates to `@/lib/queue/producer`
 * which handles signing, optional HTTP push, and retry config.
 */
export async function enqueueJob(
  tenantId: string,
  type: string,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {}
): Promise<EnqueueResult> {
  // If scheduledFor is specified, use enqueueDelayed
  if (options.scheduledFor) {
    const { enqueueDelayed } = await import("@/lib/queue");
    const result = await enqueueDelayed(tenantId, type, payload, {
      scheduledFor: options.scheduledFor,
      priority: options.priority,
      callbackUrl: options.callbackUrl,
      maxAttempts: options.maxAttempts,
    });
    return { jobId: result.jobId, status: result.status };
  }

  const result: NewEnqueueResult = await enqueueNow(tenantId, type, payload, {
    priority: options.priority,
    callbackUrl: options.callbackUrl,
    maxAttempts: options.maxAttempts,
  });

  return { jobId: result.jobId, status: result.status };
}

/* ------------------------------------------------------------------ */
/*  getJobStatus -- unchanged                                          */
/* ------------------------------------------------------------------ */

export async function getJobStatus(
  jobId: string,
  tenantId: string
): Promise<{
  id: string;
  status: string;
  type: string;
  result: Record<string, unknown> | null;
  error: string | null;
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
} | null> {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

  const admin = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll(_cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {},
      },
    }
  );

  const { data, error } = await admin
    .from("jobs")
    .select(
      "id, status, type, result, error, attempt, max_attempts, created_at, updated_at"
    )
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    status: data.status,
    type: data.type,
    result: data.result,
    error: data.error,
    attempt: data.attempt,
    maxAttempts: data.max_attempts,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
