import { createApiHandler, ok } from "@/lib/api";
import { ValidationError } from "@/lib/api/errors";
import { updateSettingsSchema } from "@/lib/validation/support";

/**
 * GET /api/v1/admin/support/settings
 * Get support settings (admin only).
 */
export const GET = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const { data: settings, error } = await ctx.supabase!
      .from("support_settings")
      .select("support_recipient_email, updated_at")
      .single();

    if (error) {
      // If no settings exist yet, return default
      if (error.code === "PGRST116") {
        return ok(
          {
            settings: {
              support_recipient_email: null,
              updated_at: null,
            },
          },
          ctx.requestId
        );
      }
      throw new Error(`Failed to fetch settings: ${error.message}`);
    }

    return ok(
      {
        settings,
      },
      ctx.requestId
    );
  },
});

/**
 * PUT /api/v1/admin/support/settings
 * Update support settings (admin only).
 */
export const PUT = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const body = await ctx.req.json();
    const parsed = updateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { support_recipient_email } = parsed.data;
    const tenantId = ctx.membership!.tenantId;

    // Upsert settings
    const { data: settings, error } = await ctx.supabase!
      .from("support_settings")
      .upsert(
        {
          tenant_id: tenantId,
          support_recipient_email,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "tenant_id",
        }
      )
      .select("support_recipient_email, updated_at")
      .single();

    if (error || !settings) {
      throw new Error(`Failed to update settings: ${error?.message ?? "unknown"}`);
    }

    return ok(
      {
        settings,
      },
      ctx.requestId
    );
  },
});
