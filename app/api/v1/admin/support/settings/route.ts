import { createApiHandler, ok } from "@/lib/api";
import { ValidationError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";

const supportSettingsSchema = z.object({
  support_recipient_email: z.string().email().optional().nullable(),
});

/**
 * GET /api/v1/admin/support/settings
 * Get support settings (admin only).
 */
export const GET = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true, // Support is not tenant-scoped
  rateLimit: { maxRequests: 30, windowMs: 60_000 },
  handler: async (ctx) => {
    const adminClient = await createAdminClient();
    
    const { data: settings, error } = await adminClient
      .from("support_settings")
      .select("support_recipient_email")
      .single();

    if (error) {
      // If no settings exist yet, return default
      if (error.code === "PGRST116") {
        return ok({ support_recipient_email: "" }, ctx.requestId);
      }
      throw new Error(`Failed to fetch settings: ${error.message}`);
    }

    return ok(
      {
        support_recipient_email: settings?.support_recipient_email || "",
      },
      ctx.requestId
    );
  },
});

/**
 * POST /api/v1/admin/support/settings
 * Update support settings (admin only).
 */
export const POST = createApiHandler({
  requiredRole: "admin",
  tenantOptional: true, // Support is not tenant-scoped
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    const body = await ctx.req.json();
    const parsed = supportSettingsSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { support_recipient_email } = parsed.data;
    const adminClient = await createAdminClient();

    // Upsert settings (there should be only one row with id=1)
    const { error } = await adminClient
      .from("support_settings")
      .upsert(
        {
          id: 1,
          support_recipient_email: support_recipient_email || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (error) {
      throw new Error(`Failed to update settings: ${error.message}`);
    }

    return ok({ success: true }, ctx.requestId);
  },
});
