/**
 * lib/upload-post/identity.ts
 *
 * Single source of truth for mapping a ZARZOOM workspace (tenant) to an
 * Upload-Post profile username. Every Upload-Post API call — profile
 * creation, JWT generation, status lookup, posting — must use the value
 * returned by this function so that social accounts are fully isolated
 * per workspace.
 */

/**
 * Derive a deterministic, stable Upload-Post profile username from a
 * workspace/tenant ID.
 *
 * Format: `zarzoom_ws_<tenantId>`
 *
 * Using the full UUID guarantees uniqueness across workspaces while
 * remaining human-readable in Upload-Post's dashboard.
 */
export function deriveWorkspaceUploadPostUsername(tenantId: string): string {
  if (!tenantId || tenantId.trim() === "") {
    throw new Error("tenantId is required to derive an Upload-Post username");
  }
  return `zarzoom_ws_${tenantId}`;
}
