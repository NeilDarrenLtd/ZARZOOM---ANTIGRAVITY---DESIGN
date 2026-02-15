import { createServerClient } from "@supabase/ssr";
import { createApiHandler, ok, accepted } from "@/lib/api";
import { env } from "@/lib/api/env";
import { providerEnum } from "@/lib/admin/schemas";
import { encryptSecret, keyFingerprint } from "@/lib/admin/encryption";
import { writeAuditLog } from "@/lib/admin/audit";
import { ValidationError } from "@/lib/api/errors";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Provider definitions                                               */
/* ------------------------------------------------------------------ */

/**
 * Static registry of providers and the key fields each one requires.
 * The UI reads this to render the correct form per provider.
 */
const PROVIDERS = [
  {
    id: "uploadpost",
    label: "Upload-Post",
    fields: [{ name: "api_key", type: "string" as const, label: "API Key" }],
  },
  {
    id: "openai",
    label: "OpenAI",
    fields: [{ name: "api_key", type: "string" as const, label: "API Key" }],
  },
  {
    id: "heygen",
    label: "HeyGen",
    fields: [{ name: "api_key", type: "string" as const, label: "API Key" }],
  },
  {
    id: "kling",
    label: "Kling",
    fields: [{ name: "api_key", type: "string" as const, label: "API Key" }],
  },
  {
    id: "veo3",
    label: "Veo3 / Vertex",
    fields: [
      {
        name: "google_vertex_config",
        type: "json" as const,
        label: "Google Vertex Config (JSON)",
      },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    fields: [{ name: "api_key", type: "string" as const, label: "API Key" }],
  },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: { getAll: () => [], setAll() {} },
  });
}

function maskValue(raw: string): string {
  if (raw.length <= 8) return "********";
  return "********" + raw.slice(-4);
}

/* ------------------------------------------------------------------ */
/*  GET /api/v1/admin/settings/provider-keys                           */
/*  Returns the provider list with masked key status -- NEVER raw.     */
/* ------------------------------------------------------------------ */

export const GET = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const admin = getAdminClient();
    const tenantId = ctx.membership!.tenantId;

    // Fetch all active secrets for this tenant (safe columns only)
    const { data: secrets, error } = await admin
      .from("provider_secrets")
      .select(
        "secret_id, provider, key_name, key_fingerprint, active, secret_type, updated_at, updated_by"
      )
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("provider");

    if (error) {
      throw new Error(`Failed to fetch provider keys: ${error.message}`);
    }

    // Build a lookup of stored secrets by provider
    const secretsByProvider = new Map<
      string,
      {
        key_fingerprint: string;
        updated_at: string;
        updated_by: string | null;
        secret_type: string;
      }
    >();
    for (const s of secrets ?? []) {
      secretsByProvider.set(s.provider, {
        key_fingerprint: s.key_fingerprint,
        updated_at: s.updated_at,
        updated_by: s.updated_by,
        secret_type: s.secret_type,
      });
    }

    // Map to the UI shape -- every provider is always returned
    const providers = PROVIDERS.map((p) => {
      const stored = secretsByProvider.get(p.id);
      return {
        id: p.id,
        label: p.label,
        fields: p.fields,
        is_set: !!stored,
        masked_key: stored ? `********${stored.key_fingerprint?.replace("...", "")}` : null,
        updated_at: stored?.updated_at ?? null,
        updated_by: stored?.updated_by ?? null,
      };
    });

    return ok({ providers }, ctx.requestId);
  },
});

/* ------------------------------------------------------------------ */
/*  PUT /api/v1/admin/settings/provider-keys                           */
/*  Encrypts + stores a provider key. Deactivates old key.             */
/* ------------------------------------------------------------------ */

const putSchema = z.object({
  provider: providerEnum,
  /** For api_key providers, the key value. */
  api_key: z.string().min(1).max(10_000).optional(),
  /** For veo3/vertex, the JSON config object. */
  google_vertex_config: z.record(z.unknown()).optional(),
});

export const PUT = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const body = await ctx.req.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { provider, api_key, google_vertex_config } = parsed.data;
    const tenantId = ctx.membership!.tenantId;
    const userId = ctx.user!.id;

    // Determine secret_type and plaintext value
    let secretType: "api_key" | "json_config";
    let plaintext: string;

    if (provider === "veo3" && google_vertex_config) {
      secretType = "json_config";
      plaintext = JSON.stringify(google_vertex_config);
    } else if (api_key) {
      secretType = "api_key";
      plaintext = api_key;
    } else {
      throw new ValidationError({
        api_key: ["Either api_key or google_vertex_config is required"],
      });
    }

    const { ENCRYPTION_MASTER_KEY } = env();
    if (!ENCRYPTION_MASTER_KEY) {
      throw new Error(
        "ENCRYPTION_MASTER_KEY environment variable is not set. Add it to your Vercel project."
      );
    }

    const admin = getAdminClient();
    const ciphertext = encryptSecret(plaintext, ENCRYPTION_MASTER_KEY);
    const fingerprint = keyFingerprint(plaintext);

    // Capture the old fingerprint for audit before/after
    const { data: oldSecret } = await admin
      .from("provider_secrets")
      .select("secret_id, key_fingerprint")
      .eq("tenant_id", tenantId)
      .eq("provider", provider)
      .eq("active", true)
      .maybeSingle();

    // Deactivate existing active secrets for this provider
    await admin
      .from("provider_secrets")
      .update({
        active: false,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("tenant_id", tenantId)
      .eq("provider", provider)
      .eq("active", true);

    // Insert new secret
    const { data: newSecret, error: insertError } = await admin
      .from("provider_secrets")
      .insert({
        tenant_id: tenantId,
        provider,
        key_name: secretType === "json_config" ? "google_vertex_config" : "api_key",
        secret_type: secretType,
        ciphertext,
        key_fingerprint: fingerprint,
        active: true,
        rotated_at: new Date().toISOString(),
        created_by: userId,
        updated_by: userId,
      })
      .select("secret_id, provider, key_fingerprint, active, rotated_at, updated_at")
      .single();

    if (insertError || !newSecret) {
      throw new Error(`Failed to store key: ${insertError?.message ?? "unknown"}`);
    }

    // Write audit log with masked before/after
    await writeAuditLog({
      userId,
      tenantId,
      tableName: "provider_secrets",
      recordId: newSecret.secret_id,
      action: "provider_key_updated",
      changes: {
        provider,
        secret_type: secretType,
        before_fingerprint: oldSecret?.key_fingerprint ?? null,
        after_fingerprint: fingerprint,
      },
    });

    return ok(
      {
        provider: newSecret.provider,
        is_set: true,
        masked_key: `********${fingerprint.replace("...", "")}`,
        updated_at: newSecret.updated_at,
        updated_by: userId,
      },
      ctx.requestId
    );
  },
});
