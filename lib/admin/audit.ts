import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/api/env";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AuditParams {
  userId: string;
  tenantId: string;
  action: string;
  /** Table / collection being changed. */
  tableName: string;
  /** Primary key of the affected row (legacy -- prefer entityId). */
  recordId?: string;
  /** What kind of entity: "plan", "api_key", "provider_secret", etc. */
  entityType?: string;
  /** The entity's primary key. */
  entityId?: string;
  /** Snapshot of the row BEFORE the mutation (null for inserts). */
  before?: Record<string, unknown> | null;
  /** Snapshot of the row AFTER the mutation (null for deletes). */
  after?: Record<string, unknown> | null;
  /**
   * @deprecated Use `before` and `after` instead.
   * Kept for backward compatibility with existing call-sites.
   */
  changes?: Record<string, unknown>;
  /** Client IP address. */
  ip?: string;
  /** Client User-Agent string. */
  userAgent?: string;
}

/* ------------------------------------------------------------------ */
/*  Core function                                                      */
/* ------------------------------------------------------------------ */

/**
 * Write an admin audit log entry.
 *
 * Uses the service role client so RLS doesn't block the insert.
 *
 * Usage:
 * ```ts
 * await writeAuditLog({
 *   userId: ctx.user!.id,
 *   tenantId: ctx.membership!.tenantId,
 *   action: "plan.updated",
 *   tableName: "subscription_plans",
 *   entityType: "plan",
 *   entityId: plan.id,
 *   before: oldPlan,
 *   after: newPlan,
 *   ip: ctx.ip,
 *   userAgent: ctx.userAgent,
 * });
 * ```
 */
export async function writeAuditLog(params: AuditParams): Promise<void> {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();

  const admin = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { cookies: { getAll: () => [], setAll() {} } }
  );

  const { error } = await admin.from("admin_audit").insert({
    user_id: params.userId,
    tenant_id: params.tenantId,
    action: params.action,
    table_name: params.tableName,
    record_id: params.recordId ?? params.entityId ?? null,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? params.recordId ?? null,
    before_json: params.before ?? null,
    after_json: params.after ?? null,
    changes: params.changes ?? null,
    ip: params.ip ?? null,
    user_agent: params.userAgent ?? null,
  });

  if (error) {
    // Audit logging should never break the request -- log and continue
    console.error("[Audit] Failed to write audit log:", error);
  }
}

/* ------------------------------------------------------------------ */
/*  Convenience helper for admin API routes                            */
/* ------------------------------------------------------------------ */

/**
 * Shorthand for admin mutations. Extracts `ip` and `userAgent` from
 * the ApiContext automatically.
 *
 * ```ts
 * await writeAdminAudit(ctx, {
 *   action: "plan.created",
 *   tableName: "subscription_plans",
 *   entityType: "plan",
 *   entityId: newPlan.id,
 *   after: newPlan,
 * });
 * ```
 */
export async function writeAdminAudit(
  ctx: { membership: { tenantId: string; userId: string } | null; ip: string; userAgent: string },
  params: Omit<AuditParams, "userId" | "tenantId" | "ip" | "userAgent">
): Promise<void> {
  if (!ctx.membership) return;
  return writeAuditLog({
    ...params,
    userId: ctx.membership.userId,
    tenantId: ctx.membership.tenantId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}
