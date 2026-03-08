/**
 * SWR key for workspace-scoped data. Returns null when no workspace (no fetch).
 * Kept in a pure .ts module so tests can import without pulling in React/JSX.
 */
export function workspaceScopedKey(
  url: string,
  activeWorkspaceId: string | null
): [string, string] | null {
  return activeWorkspaceId ? [url, activeWorkspaceId] : null;
}
