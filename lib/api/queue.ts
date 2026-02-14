import { createServerClient } from "@supabase/ssr";
import { env } from "./env";

export interface EnqueueOptions {
  /** Job priority (lower = higher priority). Default: 100 */
  priority?: number;
  /** Schedule the job for future execution. */
  scheduledFor?: Date;
  /** URL to POST the result to when the job completes. */
  callbackUrl?: string;
  /** Maximum retry attempts. Default: 3 */
  maxAttempts?: number;
}

export interface EnqueueResult {
  jobId: string;
  status: "pending" | "scheduled";
}

/**
 * Enqueue a background job.
 *
 * Inserts a row into the `jobs` table with status `pending` (or `scheduled`
 * if `scheduledFor` is in the future). Returns the new job ID so the caller
 * can return a 202 Accepted response with a polling URL.
 */
export async function enqueueJob(
  tenantId: string,
  type: string,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {}
): Promise<EnqueueResult> {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

  const admin = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { cookies: { getAll: () => [], setAll() {} } }
  );

  const now = new Date();
  const isScheduled =
    options.scheduledFor && options.scheduledFor.getTime() > now.getTime();
  const status = isScheduled ? "scheduled" : "pending";

  const { data, error } = await admin
    .from("jobs")
    .insert({
      tenant_id: tenantId,
      type,
      payload,
      status,
      priority: options.priority ?? 100,
      scheduled_for: options.scheduledFor?.toISOString() ?? null,
      callback_url: options.callbackUrl ?? null,
      max_attempts: options.maxAttempts ?? 3,
      attempt: 0,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to enqueue job: ${error?.message ?? "unknown"}`);
  }

  return { jobId: data.id, status };
}

/**
 * Fetch the status of a job by its ID.
 */
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
    { cookies: { getAll: () => [], setAll() {} } }
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
