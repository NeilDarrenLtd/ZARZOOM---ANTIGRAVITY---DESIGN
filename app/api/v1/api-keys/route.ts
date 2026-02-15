import { createServerClient } from "@supabase/ssr";
import {
  createApiHandler,
  ok,
  created,
  env,
  checkIdempotency,
  saveIdempotency,
  replayResponse,
  enforceQuota,
} from "@/lib/api";
import { ValidationError, ConflictError, NotFoundError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/admin/audit";
import { generateApiKey, hashApiKey } from "@/lib/api-keys/generate";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: { getAll: () => [], setAll() {} },
  });
}

/* ------------------------------------------------------------------ */
/*  GET /api/v1/api-keys                                               */
/*  Returns all keys for the authed user. Never returns key material.  */
/* ------------------------------------------------------------------ */

export const GET = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  handler: async (ctx) => {
    const admin = getAdminClient();
    const tenantId = ctx.membership!.tenantId;
    const userId = ctx.user!.id;

    const { data, error } = await admin
      .from("api_keys")
      .select("id, name, key_prefix, scopes_json, created_at, last_used_at, revoked_at")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch API keys: ${error.message}`);
    }

    const keys = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      prefix: row.key_prefix,
      scopes: row.scopes_json,
      created_at: row.created_at,
      last_used_at: row.last_used_at,
      status: row.revoked_at ? "revoked" : "active",
      revoked_at: row.revoked_at,
    }));

    return ok({ keys }, ctx.requestId);
  },
});

/* ------------------------------------------------------------------ */
/*  POST /api/v1/api-keys                                              */
/*  Create a new API key. Returns raw key ONCE in the response.        */
/* ------------------------------------------------------------------ */

const createSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  scopes: z.record(z.unknown()).optional().default({}),
});

export const POST = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const tenantId = ctx.membership!.tenantId;
    const userId = ctx.user!.id;

    /* -- Idempotency check ---------------------------------------- */
    const idempotencyKey = ctx.req.headers.get("idempotency-key");
    if (idempotencyKey) {
      const cached = await checkIdempotency(idempotencyKey, tenantId);
      if (cached) {
        return replayResponse(cached, ctx.requestId);
      }
    }

    /* -- Validate body -------------------------------------------- */
    const body = await ctx.req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { name, scopes } = parsed.data;

    /* -- Quota check: max_api_keys -------------------------------- */
    // Count active keys for this tenant
    const admin = getAdminClient();
    const { count: activeKeyCount } = await admin
      .from("api_keys")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .is("revoked_at", null);

    await enforceQuota(tenantId, "max_api_keys");

    /* -- Check for duplicate name --------------------------------- */
    const { data: existingName } = await admin
      .from("api_keys")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("name", name)
      .is("revoked_at", null)
      .maybeSingle();

    if (existingName) {
      throw new ConflictError(
        `An active API key with the name "${name}" already exists`
      );
    }

    /* -- Generate key --------------------------------------------- */
    const generated = generateApiKey();

    /* -- Insert --------------------------------------------------- */
    const { data: inserted, error: insertError } = await admin
      .from("api_keys")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        name,
        key_hash: generated.keyHash,
        key_prefix: generated.keyPrefix,
        scopes_json: scopes,
      })
      .select("id, name, key_prefix, scopes_json, created_at")
      .single();

    if (insertError || !inserted) {
      throw new Error(`Failed to create API key: ${insertError?.message ?? "unknown"}`);
    }

    /* -- Audit log ------------------------------------------------ */
    await writeAuditLog({
      userId,
      tenantId,
      tableName: "api_keys",
      recordId: inserted.id,
      action: "api_key_created",
      changes: { name, key_prefix: generated.keyPrefix },
    });

    /* -- Build response ------------------------------------------- */
    const responseBody = {
      key: {
        id: inserted.id,
        name: inserted.name,
        prefix: inserted.key_prefix,
        scopes: inserted.scopes_json,
        created_at: inserted.created_at,
        status: "active" as const,
      },
      /** Raw key -- shown ONCE. Will never be returned again. */
      raw_key: generated.rawKey,
      warning:
        "Store this key securely. It will not be shown again. " +
        "If you lose it, revoke this key and create a new one.",
    };

    /* -- Save idempotency (without raw_key for safety) ------------ */
    if (idempotencyKey) {
      await saveIdempotency(
        idempotencyKey,
        tenantId,
        null,
        201,
        {
          key: responseBody.key,
          warning: responseBody.warning,
          raw_key_redacted: true,
        }
      );
    }

    return created(responseBody, ctx.requestId);
  },
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/v1/api-keys                                            */
/*  Revoke a key by setting revoked_at.                                */
/* ------------------------------------------------------------------ */

const deleteSchema = z.object({
  key_id: z.string().uuid("key_id must be a valid UUID"),
});

export const DELETE = createApiHandler({
  requiredRole: "member",
  rateLimit: { maxRequests: 20, windowMs: 60_000 },
  handler: async (ctx) => {
    const tenantId = ctx.membership!.tenantId;
    const userId = ctx.user!.id;

    const body = await ctx.req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { key_id } = parsed.data;
    const admin = getAdminClient();

    /* -- Verify ownership ----------------------------------------- */
    const { data: existing, error: fetchError } = await admin
      .from("api_keys")
      .select("id, name, user_id, revoked_at")
      .eq("id", key_id)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError("API key");
    }

    if (existing.user_id !== userId) {
      // Only the key owner (or a tenant admin via RLS) can revoke
      throw new NotFoundError("API key");
    }

    if (existing.revoked_at) {
      return ok(
        {
          id: existing.id,
          name: existing.name,
          status: "revoked",
          revoked_at: existing.revoked_at,
          message: "Key was already revoked",
        },
        ctx.requestId
      );
    }

    /* -- Revoke --------------------------------------------------- */
    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("api_keys")
      .update({ revoked_at: now })
      .eq("id", key_id);

    if (updateError) {
      throw new Error(`Failed to revoke API key: ${updateError.message}`);
    }

    /* -- Audit ---------------------------------------------------- */
    await writeAuditLog({
      userId,
      tenantId,
      tableName: "api_keys",
      recordId: key_id,
      action: "api_key_revoked",
      changes: { name: existing.name },
    });

    return ok(
      {
        id: key_id,
        name: existing.name,
        status: "revoked",
        revoked_at: now,
      },
      ctx.requestId
    );
  },
});
