import { createServerClient } from "@supabase/ssr";
import { createApiHandler, ok, badRequest } from "@/lib/api";
import { env } from "@/lib/api/env";
import { putKeySchema } from "@/lib/admin/schemas";
import { encryptSecret, keyFingerprint } from "@/lib/admin/encryption";
import { writeAuditLog } from "@/lib/admin/audit";
import { ValidationError } from "@/lib/api/errors";

/* ------------------------------------------------------------------ */
/*  GET /api/v1/admin/settings/keys                                    */
/*  Returns metadata only -- NEVER ciphertext or plaintext.            */
/* ------------------------------------------------------------------ */

export const GET = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

    const admin = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { getAll: () => [], setAll() {} } }
    );

    // Use the metadata view that excludes ciphertext
    const { data, error } = await admin
      .from("provider_secrets_metadata")
      .select(
        "secret_id, provider, key_name, key_fingerprint, active, rotated_at, created_at, updated_at"
      )
      .eq("tenant_id", ctx.membership!.tenantId)
      .order("provider")
      .order("key_name");

    if (error) {
      // Fallback: query provider_secrets but only select safe columns
      const { data: fallback, error: fbError } = await admin
        .from("provider_secrets")
        .select(
          "secret_id, provider, key_name, key_fingerprint, active, rotated_at, created_at, updated_at"
        )
        .eq("tenant_id", ctx.membership!.tenantId)
        .order("provider")
        .order("key_name");

      if (fbError) {
        throw new Error(`Failed to fetch keys: ${fbError.message}`);
      }

      return ok(
        {
          keys: (fallback ?? []).map((k) => ({
            provider: k.provider,
            key_name: k.key_name,
            is_set: true,
            key_fingerprint: k.key_fingerprint,
            rotated_at: k.rotated_at,
            active: k.active,
          })),
        },
        ctx.requestId
      );
    }

    return ok(
      {
        keys: (data ?? []).map((k) => ({
          provider: k.provider,
          key_name: k.key_name,
          is_set: true,
          key_fingerprint: k.key_fingerprint,
          rotated_at: k.rotated_at,
          active: k.active,
        })),
      },
      ctx.requestId
    );
  },
});

/* ------------------------------------------------------------------ */
/*  PUT /api/v1/admin/settings/keys                                    */
/*  Encrypts + stores a provider key. Deactivates old key if needed.   */
/* ------------------------------------------------------------------ */

export const PUT = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const body = await ctx.req.json();
    const parsed = putKeySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { provider, key_name, plaintext_value, make_active } = parsed.data;
    const tenantId = ctx.membership!.tenantId;

    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_MASTER_KEY } = env();

    if (!ENCRYPTION_MASTER_KEY) {
      throw new Error(
        "ENCRYPTION_MASTER_KEY environment variable is not set. Add it to your Vercel project."
      );
    }

    const masterKey = ENCRYPTION_MASTER_KEY;

    const admin = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { getAll: () => [], setAll() {} } }
    );

    // Encrypt the plaintext value
    const ciphertext = encryptSecret(plaintext_value, masterKey);
    const fingerprint = keyFingerprint(plaintext_value);

    // If make_active, deactivate existing active keys for same provider/key_name
    if (make_active) {
      await admin
        .from("provider_secrets")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("provider", provider)
        .eq("key_name", key_name)
        .eq("active", true);
    }

    // Insert new secret
    const { data: newSecret, error: insertError } = await admin
      .from("provider_secrets")
      .insert({
        tenant_id: tenantId,
        provider,
        key_name,
        ciphertext,
        key_fingerprint: fingerprint,
        active: make_active,
        rotated_at: new Date().toISOString(),
      })
      .select("secret_id, provider, key_name, key_fingerprint, active, rotated_at")
      .single();

    if (insertError || !newSecret) {
      throw new Error(`Failed to store key: ${insertError?.message ?? "unknown"}`);
    }

    // Write audit log with redacted change (never log plaintext)
    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId,
      tableName: "provider_secrets",
      recordId: newSecret.secret_id,
      action: "key_rotated",
      changes: {
        provider,
        key_name,
        fingerprint,
        make_active,
        // NEVER include plaintext_value or ciphertext
      },
    });

    return ok(
      {
        key: {
          provider: newSecret.provider,
          key_name: newSecret.key_name,
          is_set: true,
          key_fingerprint: newSecret.key_fingerprint,
          rotated_at: newSecret.rotated_at,
          active: newSecret.active,
        },
      },
      ctx.requestId
    );
  },
});
