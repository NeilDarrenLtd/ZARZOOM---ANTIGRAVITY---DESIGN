import { createServerClient } from "@supabase/ssr";
import {
  createApiHandler,
  created,
  env,
  enforceQuota,
} from "@/lib/api";
import { ValidationError, NotFoundError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/admin/audit";
import { generateApiKey } from "@/lib/api-keys/generate";
import { assertWorkspaceWhere, logWorkspaceSave } from "@/lib/dev/workspace-guardrails";
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
/*  POST /api/v1/api-keys/regenerate                                   */
/*  Revoke the given key and create a new one with same name/scopes.   */
/*  Returns the new raw key ONCE.                                      */
/* ------------------------------------------------------------------ */

const regenerateSchema = z.object({
  key_id: z.string().uuid("key_id must be a valid UUID"),
});

export const POST = createApiHandler({
  requiredRole: "member",
  requireExplicitTenant: true,
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const tenantId = ctx.membership!.tenantId;
    const userId = ctx.user!.id;

    const body = await ctx.req.json();
    const parsed = regenerateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { key_id } = parsed.data;
    const admin = getAdminClient();

    /* -- Load existing key ----------------------------------------- */
    const { data: existing, error: fetchError } = await admin
      .from("api_keys")
      .select("id, name, user_id, scopes_json, revoked_at")
      .eq("id", key_id)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError("API key");
    }

    if (existing.user_id !== userId) {
      throw new NotFoundError("API key");
    }

    if (existing.revoked_at) {
      throw new ValidationError({
        key_id: ["Key is already revoked. Create a new key instead."],
      });
    }

    /* -- Quota (active count unchanged after revoke+create) --------- */
    await enforceQuota(tenantId, "max_api_keys");

    /* -- Revoke old key --------------------------------------------- */
    assertWorkspaceWhere(tenantId, "update", "api_keys", { tenant_id: tenantId });
    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("api_keys")
      .update({ revoked_at: now })
      .eq("id", key_id)
      .eq("tenant_id", tenantId);

    if (updateError) {
      throw new Error(`Failed to revoke API key: ${updateError.message}`);
    }

    await writeAuditLog({
      userId,
      tenantId,
      tableName: "api_keys",
      recordId: key_id,
      action: "api_key_revoked",
      changes: { name: existing.name, reason: "regenerate" },
    });

    /* -- Create new key --------------------------------------------- */
    const generated = generateApiKey();
    const { data: inserted, error: insertError } = await admin
      .from("api_keys")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        name: existing.name,
        key_hash: generated.keyHash,
        key_prefix: generated.keyPrefix,
        scopes_json: existing.scopes_json ?? {},
      })
      .select("id, name, key_prefix, scopes_json, created_at")
      .single();

    if (insertError || !inserted) {
      throw new Error(`Failed to create new API key: ${insertError?.message ?? "unknown"}`);
    }

    logWorkspaceSave("api_keys", tenantId, tenantId);

    await writeAuditLog({
      userId,
      tenantId,
      tableName: "api_keys",
      recordId: inserted.id,
      action: "api_key_created",
      changes: { name: inserted.name, key_prefix: generated.keyPrefix, regenerated_from: key_id },
    });

    return created(
      {
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
        revoked_key_id: key_id,
        warning:
          "Store this key securely. It will not be shown again. " +
          "The previous key has been revoked.",
      },
      ctx.requestId
    );
  },
});
