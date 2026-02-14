import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/api/env";

/* ------------------------------------------------------------------ */
/*  Prompt template resolution                                         */
/* ------------------------------------------------------------------ */

export interface ResolvedPromptTemplate {
  templateId: string;
  versionId: string;
  templateKey: string;
  systemPrompt: string;
  userPromptTemplate: string;
  outputSchema: Record<string, unknown> | null;
}

/**
 * Resolve the active prompt template for a given template_key.
 *
 * Priority:
 *   1. Tenant-scoped override (prompt_templates.tenant_id = tenantId)
 *   2. Global default (prompt_templates.tenant_id IS NULL)
 *
 * Returns the active version's system_prompt, user_prompt_template,
 * and output_schema (for structured output mode).
 *
 * Returns `null` if no template is found -- the worker should use
 * hardcoded fallback prompts in that case.
 */
export async function resolvePromptTemplate(
  tenantId: string,
  templateKey: string
): Promise<ResolvedPromptTemplate | null> {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

  const admin = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { cookies: { getAll: () => [], setAll() {} } }
  );

  // 1. Try tenant-scoped template first
  const { data: tenantTemplate } = await admin
    .from("prompt_templates")
    .select(
      `
      template_id,
      template_key,
      active_version_id,
      prompt_template_versions!inner (
        version_id,
        system_prompt,
        user_prompt_template,
        output_schema,
        is_active
      )
    `
    )
    .eq("template_key", templateKey)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (tenantTemplate) {
    return mapTemplate(tenantTemplate, templateKey);
  }

  // 2. Fall back to global default (tenant_id IS NULL)
  const { data: globalTemplate } = await admin
    .from("prompt_templates")
    .select(
      `
      template_id,
      template_key,
      active_version_id,
      prompt_template_versions!inner (
        version_id,
        system_prompt,
        user_prompt_template,
        output_schema,
        is_active
      )
    `
    )
    .eq("template_key", templateKey)
    .is("tenant_id", null)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (globalTemplate) {
    return mapTemplate(globalTemplate, templateKey);
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Internal helper                                                    */
/* ------------------------------------------------------------------ */

function mapTemplate(
  row: {
    template_id: string;
    active_version_id: string | null;
    prompt_template_versions: unknown;
  },
  templateKey: string
): ResolvedPromptTemplate | null {
  // prompt_template_versions comes back as an array from the inner join
  const versions = Array.isArray(row.prompt_template_versions)
    ? row.prompt_template_versions
    : [row.prompt_template_versions];

  // Find the active version (matching active_version_id or the first active one)
  const version = versions.find(
    (v: Record<string, unknown>) =>
      v.version_id === row.active_version_id || v.is_active === true
  ) as Record<string, unknown> | undefined;

  if (!version) return null;

  return {
    templateId: row.template_id,
    versionId: version.version_id as string,
    templateKey,
    systemPrompt: (version.system_prompt as string) ?? "",
    userPromptTemplate: (version.user_prompt_template as string) ?? "",
    outputSchema: (version.output_schema as Record<string, unknown>) ?? null,
  };
}
