import { createServerClient } from "@supabase/ssr";
import { createApiHandler, ok } from "@/lib/api";
import { env } from "@/lib/api/env";
import { putPromptSchema, templateKeyEnum } from "@/lib/admin/schemas";
import { writeAuditLog } from "@/lib/admin/audit";
import { ValidationError, NotFoundError } from "@/lib/api/errors";

/* ------------------------------------------------------------------ */
/*  PUT /api/v1/admin/prompts/[template_key]                           */
/*  Creates a new version row. Optionally sets it as the active ver.   */
/* ------------------------------------------------------------------ */

export const PUT = createApiHandler({
  requiredRole: "admin",
  rateLimit: { maxRequests: 10, windowMs: 60_000 },
  handler: async (ctx) => {
    // Validate the template_key from the URL
    const url = new URL(ctx.req.url);
    const templateKey = url.pathname.split("/").pop() ?? "";
    const keyParsed = templateKeyEnum.safeParse(templateKey);
    if (!keyParsed.success) {
      throw new ValidationError({
        template_key: [`Invalid template key. Must be one of: ${templateKeyEnum.options.join(", ")}`],
      });
    }

    // Validate body
    const body = await ctx.req.json();
    const parsed = putPromptSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { name, description, system_prompt, user_prompt_template, output_schema, activate } =
      parsed.data;
    const tenantId = ctx.membership!.tenantId;

    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
    const admin = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { getAll: () => [], setAll() {} } }
    );

    // Find or create the tenant-scoped template
    let { data: template } = await admin
      .from("prompt_templates")
      .select("template_id, name, active_version_id")
      .eq("template_key", keyParsed.data)
      .eq("tenant_id", tenantId)
      .limit(1)
      .single();

    if (!template) {
      // Create a new tenant-scoped template (overriding global default)
      const { data: newTemplate, error: createError } = await admin
        .from("prompt_templates")
        .insert({
          template_key: keyParsed.data,
          tenant_id: tenantId,
          name: name ?? keyParsed.data,
          description: description ?? null,
          is_active: true,
        })
        .select("template_id, name, active_version_id")
        .single();

      if (createError || !newTemplate) {
        throw new Error(`Failed to create template: ${createError?.message ?? "unknown"}`);
      }
      template = newTemplate;
    } else if (name || description) {
      // Update template metadata if provided
      await admin
        .from("prompt_templates")
        .update({
          ...(name ? { name } : {}),
          ...(description ? { description } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("template_id", template.template_id);
    }

    // Determine the next version number
    const { data: latestVersion } = await admin
      .from("prompt_template_versions")
      .select("version_number")
      .eq("template_id", template.template_id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;

    // Create the new version row (never overwrite historical versions)
    const { data: newVersion, error: versionError } = await admin
      .from("prompt_template_versions")
      .insert({
        template_id: template.template_id,
        version_number: nextVersionNumber,
        system_prompt,
        user_prompt_template,
        output_schema: output_schema ?? null,
        is_active: activate,
        created_by_user_id: ctx.user!.id,
      })
      .select("version_id, version_number, is_active, created_at")
      .single();

    if (versionError || !newVersion) {
      throw new Error(`Failed to create version: ${versionError?.message ?? "unknown"}`);
    }

    // If activate, set as active_version_id on the template and deactivate old versions
    if (activate) {
      await admin
        .from("prompt_templates")
        .update({
          active_version_id: newVersion.version_id,
          updated_at: new Date().toISOString(),
        })
        .eq("template_id", template.template_id);

      // Deactivate all other versions
      await admin
        .from("prompt_template_versions")
        .update({ is_active: false })
        .eq("template_id", template.template_id)
        .neq("version_id", newVersion.version_id);
    }

    // Write audit log
    await writeAuditLog({
      userId: ctx.user!.id,
      tenantId,
      tableName: "prompt_template_versions",
      recordId: newVersion.version_id,
      action: activate ? "version_created_and_activated" : "version_created",
      changes: {
        template_key: keyParsed.data,
        version_number: nextVersionNumber,
        activate,
        system_prompt_length: system_prompt.length,
        user_prompt_template_length: user_prompt_template.length,
        has_output_schema: !!output_schema,
      },
    });

    return ok(
      {
        template_id: template.template_id,
        version: {
          version_id: newVersion.version_id,
          version_number: newVersion.version_number,
          is_active: newVersion.is_active,
          created_at: newVersion.created_at,
        },
        activated: activate,
      },
      ctx.requestId
    );
  },
});
