import type { TenantMembership } from "./tenancy";
import { ForbiddenError } from "./errors";

/**
 * Role hierarchy (highest privilege first).
 *
 * A role at index N is considered "higher" than any role at index N+1.
 */
const ROLE_HIERARCHY = ["super_admin", "admin", "member", "viewer"] as const;
export type Role = (typeof ROLE_HIERARCHY)[number];

/**
 * Returns the numeric weight of a role (lower = more powerful).
 * Unknown roles get the lowest privilege.
 */
function roleWeight(role: string): number {
  const idx = ROLE_HIERARCHY.indexOf(role as Role);
  return idx === -1 ? ROLE_HIERARCHY.length : idx;
}

/**
 * Assert that the membership has one of the `allowedRoles` *or higher*.
 *
 * Example: `requireRole(membership, "member")` permits member, admin, and
 * super_admin but rejects viewer.
 *
 * Throws `ForbiddenError` if the check fails.
 */
export function requireRole(
  membership: TenantMembership,
  ...allowedRoles: Role[]
): void {
  const userWeight = roleWeight(membership.role);

  // Find the least-privileged allowed role (highest weight number)
  const leastPrivilegedAllowed = Math.max(
    ...allowedRoles.map((r) => roleWeight(r))
  );

  if (userWeight <= leastPrivilegedAllowed) {
    return; // user's role is at least as powerful
  }

  throw new ForbiddenError(
    `Role "${membership.role}" is not permitted. Required: ${allowedRoles.join(", ")} or higher.`
  );
}

/**
 * Check (without throwing) whether a role meets the minimum requirement.
 */
export function hasRole(
  membership: TenantMembership,
  minimumRole: Role
): boolean {
  return roleWeight(membership.role) <= roleWeight(minimumRole);
}
