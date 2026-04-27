/**
 * Canonical role hierarchy for the Koveo Gestion property management system.
 * Mirrors server/lib/auth/roleRank.ts — keep both in sync.
 *
 * Five distinct ranks ordered from least to most privileged.
 * Demo roles are mapped to their equivalent production rank.
 */
const RANK: Record<string, number> = {
  tenant: 0,
  demo_tenant: 0,
  resident: 1,
  demo_resident: 1,
  manager: 2,
  demo_manager: 2,
  admin: 3,
  super_admin: 4,
};

/**
 * Returns the numeric rank for a role string.
 * Unknown roles return -1 so they fail every minimum-rank check.
 */
export function roleRank(role: string): number {
  return RANK[role] ?? -1;
}

/**
 * Returns true when `userRole` is at least as privileged as `minRole`.
 * Use this for nav/menu visibility checks on the client side, mirroring
 * the server-side `requireMinRole` middleware.
 *
 * @example
 * // Show admin nav items only to admin and super_admin
 * if (hasMinRole(user.role, 'admin')) { ... }
 */
export function hasMinRole(userRole: string, minRole: string): boolean {
  return roleRank(userRole) >= roleRank(minRole);
}
