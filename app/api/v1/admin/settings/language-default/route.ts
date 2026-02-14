import { createServerClient } from "@supabase/ssr";
import { createApiHandler, ok } from "@/lib/api";
import { env } from "@/lib/api/env";
import { putLanguageSchema } from "@/lib/admin/schemas";
import { writeAuditLog } from "@/lib/admin/audit";
import { ValidationError } from "@/lib/api/errors";

/* ------------------------------------------------------------------ */
/*  GET /api/v1/admin/settings/language-default                        */
/* ------------------------------------------------------------------ */

export const GET = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
    const tenantId = ctx.membership!.tenantId;

    const admin = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { getAll: () => [], setAll() {} } }
    );

    const { data } = await admin
      .from("tenant_settings")
      .select("default_language")
      .eq("tenant_id", tenantId)
      .limit(1)
      .single();

    return ok(
      {
        default_language: data?.default_language ?? "en",
        tenant_id: tenantId,
      },
      ctx.requestId
    );
  },
});

/* ------------------------------------------------------------------ */
/*  PUT /api/v1/admin/settings/language-default                        */
/* ------------------------------------------------------------------ */

export const PUT = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const body = await ctx.req.json();
    const parsed = putLanguageSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { default_language } = parsed.data;
    const tenantId = ctx.membership!.tenantId;

    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
    const admin = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { getAll: () => [], setAll() {} } }
    );

    // Upsert tenant_settings
    const { data: existing } = await admin
      .from("tenant_settings")
      .select("tenant_id")
      .eq("tenant_id", tenantId)
      .limit(1)
      .single();

    if (existing) {
      await admin
        .from("tenant_settings")
        .update({
          default_language,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);
    } else {
      await admin.from("tenant_settings").insert({
        tenant_id: tenantId,
        default_language,
      });
    }

    // Write audit log
    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId,
      tableName: "tenant_settings",
      recordId: tenantId,
      action: "default_language_updated",
      changes: { default_language },
    });

    return ok(
      {
        default_language,
        tenant_id: tenantId,
      },
      ctx.requestId
    );
  },
});
