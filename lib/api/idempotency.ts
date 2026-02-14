import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { env } from "./env";

export interface IdempotencyRecord {
  id: string;
  key: string;
  tenantId: string;
  jobId: string | null;
  responseStatus: number;
  responseBody: Record<string, unknown> | null;
  expiresAt: string;
}

/**
 * Check whether an idempotency key has already been used for a given tenant.
 *
 * If the key exists and has not expired, returns the cached record (so the
 * handler can replay the original response). If the key is new or expired,
 * returns `null` meaning the handler should proceed normally.
 */
export async function checkIdempotency(
  key: string,
  tenantId: string
): Promise<IdempotencyRecord | null> {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

  const admin = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { cookies: { getAll: () => [], setAll() {} } }
  );

  const { data, error } = await admin
    .from("idempotency_keys")
    .select(
      "id, key, tenant_id, job_id, response_status, response_body, expires_at"
    )
    .eq("key", key)
    .eq("tenant_id", tenantId)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    key: data.key,
    tenantId: data.tenant_id,
    jobId: data.job_id,
    responseStatus: data.response_status,
    responseBody: data.response_body,
    expiresAt: data.expires_at,
  };
}

/**
 * Save (or update) an idempotency record after the handler has executed.
 *
 * The default TTL is 24 hours.
 */
export async function saveIdempotency(
  key: string,
  tenantId: string,
  jobId: string | null,
  responseStatus: number,
  responseBody: Record<string, unknown>,
  ttlMs = 86_400_000 // 24 h
): Promise<void> {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

  const admin = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { cookies: { getAll: () => [], setAll() {} } }
  );

  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  await admin.from("idempotency_keys").upsert(
    {
      key,
      tenant_id: tenantId,
      job_id: jobId,
      response_status: responseStatus,
      response_body: responseBody,
      expires_at: expiresAt,
    },
    { onConflict: "key,tenant_id" }
  );
}

/**
 * Build a `NextResponse` that replays a previously stored idempotent response.
 */
export function replayResponse(
  record: IdempotencyRecord,
  requestId: string
): NextResponse {
  return NextResponse.json(record.responseBody, {
    status: record.responseStatus,
    headers: {
      "X-Request-Id": requestId,
      "X-Idempotent-Replayed": "true",
    },
  });
}
