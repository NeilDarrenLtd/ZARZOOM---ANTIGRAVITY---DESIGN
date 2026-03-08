/**
 * Development-only guardrails and logging to prevent cross-workspace state leakage.
 * All assertions and warnings are no-ops in production (NODE_ENV !== "development").
 */

function isDev(): boolean {
  return (
    typeof process !== "undefined" && process.env?.NODE_ENV === "development"
  );
}

const PREFIX = "[WorkspaceGuard]";

/**
 * Assert before a workspace-owned save:
 * - activeWorkspaceId exists
 * - payload workspace_id / tenant_id matches activeWorkspaceId
 * Call this before insert/update of any workspace-scoped entity.
 */
export function assertWorkspaceSave(
  activeWorkspaceId: string | null | undefined,
  payload: Record<string, unknown>,
  entityType: string
): void {
  if (!isDev()) return;
  if (!activeWorkspaceId) {
    console.error(
      `${PREFIX} Save rejected: activeWorkspaceId is missing (entity: ${entityType}). ` +
        "Workspace-owned saves require X-Tenant-Id / activeWorkspaceId."
    );
    throw new Error(
      `[WorkspaceGuard] activeWorkspaceId required for workspace-owned save: ${entityType}`
    );
  }
  const payloadTenant =
    (payload.tenant_id as string | undefined) ??
    (payload.workspace_id as string | undefined);
  if (payloadTenant !== undefined && payloadTenant !== activeWorkspaceId) {
    console.error(
      `${PREFIX} Save rejected: payload workspace_id/tenant_id (${payloadTenant}) ` +
        `does not match activeWorkspaceId (${activeWorkspaceId}) (entity: ${entityType}). ` +
        "This would write to another workspace."
    );
    throw new Error(
      `[WorkspaceGuard] Payload workspace_id must match activeWorkspaceId: ${entityType}`
    );
  }
}

/**
 * Log a workspace-owned save (dev only).
 * Call after a successful save with entity type, active workspace, and target record workspace.
 */
export function logWorkspaceSave(
  entityType: string,
  activeWorkspaceId: string,
  targetRecordWorkspaceId: string
): void {
  if (!isDev()) return;
  if (targetRecordWorkspaceId !== activeWorkspaceId) {
    console.warn(
      `${PREFIX} Save mismatch: entity=${entityType} activeWorkspaceId=${activeWorkspaceId} ` +
        `targetRecordWorkspaceId=${targetRecordWorkspaceId}`
    );
    return;
  }
  console.log(
    `${PREFIX} Save OK: entity=${entityType} workspaceId=${activeWorkspaceId}`
  );
}

/**
 * Warn when a query runs without workspace_id (e.g. workspace-scoped endpoint but tenantId null).
 * Call at the start of a workspace-scoped read path.
 */
export function warnQueryWithoutWorkspaceId(
  workspaceId: string | null | undefined,
  context: string
): void {
  if (!isDev()) return;
  if (!workspaceId) {
    console.warn(
      `${PREFIX} Query without workspace_id: ${context}. ` +
        "Workspace-scoped data should always be filtered by tenant_id."
    );
  }
}

/**
 * Assert that an update/delete is scoped by workspace.
 * Pass the where clause (or a summary) so we can verify tenant_id is included.
 * In dev, throws if tenantId is missing or if whereClause does not include matching tenant_id/workspace_id.
 */
export function assertWorkspaceWhere(
  tenantId: string | null | undefined,
  operation: "update" | "delete",
  tableName: string,
  whereClause?: Record<string, unknown>
): void {
  if (!isDev()) return;
  if (!tenantId) {
    console.error(
      `${PREFIX} ${operation} without tenantId: table=${tableName}. ` +
        "All workspace-scoped update/delete must include tenant_id in the where clause."
    );
    throw new Error(
      `[WorkspaceGuard] tenantId required for workspace-scoped ${operation}: ${tableName}`
    );
  }
  if (whereClause != null && typeof whereClause === "object") {
    const whereTenant =
      (whereClause.tenant_id as string | undefined) ??
      (whereClause.workspace_id as string | undefined);
    if (whereTenant === undefined) {
      console.warn(
        `${PREFIX} ${operation} where clause may be missing tenant_id: table=${tableName}. ` +
          "Ensure .eq('tenant_id', tenantId) is applied."
      );
    } else if (whereTenant !== tenantId) {
      console.error(
        `${PREFIX} ${operation} where tenant_id (${whereTenant}) does not match context tenantId (${tenantId}): table=${tableName}`
      );
      throw new Error(
        `[WorkspaceGuard] Where clause tenant_id must match context: ${tableName}`
      );
    }
  }
}

/**
 * Log workspace switch (frontend). Call when setActiveWorkspaceAndInvalidate is invoked.
 */
export function logWorkspaceSwitch(
  previousWorkspaceId: string | null,
  newWorkspaceId: string,
  invalidations: string[]
): void {
  if (!isDev()) return;
  console.log(
    `${PREFIX} Switch: previous=${previousWorkspaceId ?? "(none)"} new=${newWorkspaceId} ` +
      `invalidations=[${invalidations.join(", ")}]`
  );
}
