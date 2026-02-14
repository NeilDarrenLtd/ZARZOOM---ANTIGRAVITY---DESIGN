import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/api/env";

/**
 * Write an admin audit log entry.
 *
 * Uses the service role client so RLS doesn't block the insert.
 */
export async function writeAuditLog(params: {
  userId: string;
  tenantId: string;
  tableName: string;
  recordId: string;
  action: string;
  changes: Record<string, unknown>;
}): Promise<void> {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

  const admin = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { cookies: { getAll: () => [], setAll() {} } }
  );

  await admin.from("admin_audit").insert({
    user_id: params.userId,
    tenant_id: params.tenantId,
    table_name: params.tableName,
    record_id: params.recordId,
    action: params.action,
    changes: params.changes,
  });
}
