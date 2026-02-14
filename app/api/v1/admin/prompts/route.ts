import { createServerClient } from "@supabase/ssr";
import { createApiHandler, ok } from "@/lib/api";
import { env } from "@/lib/api/env";

/* ------------------------------------------------------------------ */
/*  GET /api/v1/admin/prompts                                          */
/*  Returns active template + available version metadata for each key. */
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

    const templateKeys = ["research_social", "generate_article", "generate_script"];

    const templates = await Promise.all(
      templateKeys.map(async (templateKey) => {
        // Try tenant-scoped first, then global
        let { data: template } = await admin
          .from("prompt_templates")
          .select(
            "template_id, template_key, name, description, is_active, active_version_id, tenant_id"
          )
          .eq("template_key", templateKey)
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .limit(1)
          .single();

        let isOverride = !!template;

        if (!template) {
          const { data: global } = await admin
            .from("prompt_templates")
            .select(
              "template_id, template_key, name, description, is_active, active_version_id, tenant_id"
            )
            .eq("template_key", templateKey)
            .is("tenant_id", null)
            .eq("is_active", true)
            .limit(1)
            .single();

          template = global;
          isOverride = false;
        }

        if (!template) {
          return {
            template_key: templateKey,
            template: null,
            versions: [],
            is_tenant_override: false,
          };
        }

        // Fetch all versions for this template
        const { data: versions } = await admin
          .from("prompt_template_versions")
          .select(
            "version_id, version_number, is_active, created_at, created_by_user_id"
          )
          .eq("template_id", template.template_id)
          .order("version_number", { ascending: false });

        // Fetch the active version's full content
        let activeVersion = null;
        if (template.active_version_id) {
          const { data: av } = await admin
            .from("prompt_template_versions")
            .select(
              "version_id, version_number, system_prompt, user_prompt_template, output_schema, is_active, created_at"
            )
            .eq("version_id", template.active_version_id)
            .single();

          activeVersion = av;
        }

        return {
          template_key: templateKey,
          template: {
            template_id: template.template_id,
            name: template.name,
            description: template.description,
            is_active: template.is_active,
            active_version_id: template.active_version_id,
          },
          active_version: activeVersion,
          versions: (versions ?? []).map((v) => ({
            version_id: v.version_id,
            version_number: v.version_number,
            is_active: v.is_active,
            created_at: v.created_at,
          })),
          is_tenant_override: isOverride,
        };
      })
    );

    return ok({ templates }, ctx.requestId);
  },
});
