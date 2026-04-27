import type { Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { isValidUUID } from './validation-helpers';
import { getUserAccessibleOrganizations } from '../rbac';
import { db } from '../db';
import * as schema from '@shared/schema';

/**
 * Effective organization scope for a list-style GET endpoint.
 */
export interface OrgScope {
  /** True when the caller explicitly provided an `organizationId` query param. */
  explicit: boolean;
  /** The organization IDs the caller is allowed to query for this request. */
  orgIds: string[];
}

/**
 * Resolves and validates the effective organization scope for a list-style
 * GET endpoint that accepts an optional `organizationId` query parameter.
 *
 * Behavior:
 * - If `organizationId` is provided, it must be a valid UUID (otherwise
 *   responds 400) and must be in the caller's accessible organization set
 *   (otherwise responds 403). The returned scope contains only that org.
 * - If `organizationId` is omitted, the returned scope contains every
 *   organization the caller can access (per `getUserAccessibleOrganizations`).
 *   Admins are NOT exempt — they are scoped to their actual memberships
 *   (or to all orgs only when their membership has
 *   `canAccessAllOrganizations = true`).
 *
 * Returns `null` when the response has already been written. Callers should
 * `return` immediately in that case.
 */
export async function resolveOrgScope(req: any, res: Response): Promise<OrgScope | null> {
  const user = req.user || req.session?.user;
  if (!user) {
    res.status(401).json({
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return null;
  }

  const requested = req.query?.organizationId;
  const hasRequested =
    requested !== undefined && requested !== null && requested !== '';

  if (hasRequested) {
    if (typeof requested !== 'string' || !isValidUUID(requested)) {
      res.status(400).json({
        message: 'Invalid organizationId',
        code: 'INVALID_ORGANIZATION_ID',
      });
      return null;
    }

    const accessible = await getUserAccessibleOrganizations(user.id, user.role);
    if (!accessible.includes(requested)) {
      res.status(403).json({
        message: 'Access denied to this organization',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      return null;
    }

    return { explicit: true, orgIds: [requested] };
  }

  const accessible = await getUserAccessibleOrganizations(user.id, user.role);
  return { explicit: false, orgIds: accessible };
}

/**
 * Outcome of a write-side org-membership check for a row that lives
 * inside a building. Callers should `return` immediately if `ok` is
 * false — `assertBuildingWriteAccess` has already written the
 * appropriate error response (404 if the building does not exist or
 * is inactive; 403 INSUFFICIENT_PERMISSIONS if it lives in an
 * organization the caller cannot access).
 *
 * Used by every bills-API write handler (Task #1271) to make sure a
 * manager attached to org-A cannot mutate, delete, re-attach, or
 * re-trigger AI on rows whose building belongs to an unrelated
 * tenant. The check is intentionally chained off the building row
 * rather than the bill row so that out-of-scope reads stay 404 (no
 * existence-oracle leak).
 */
export interface BuildingWriteAccess {
  ok: boolean;
  buildingId?: string;
  organizationId?: string;
}

/**
 * Verifies that `userId` has write access to the organization that
 * owns `buildingId`. Writes a 404/403 JSON response and returns
 * `{ ok: false }` on denial; otherwise returns the resolved
 * organization id so the caller can keep querying.
 *
 * The active building row is required — bills cannot be written
 * against archived/inactive buildings, matching the read-side
 * `getBuildingsByOrganizationIds` filters.
 */
export async function assertBuildingWriteAccess(
  res: Response,
  userId: string,
  buildingId: string | null | undefined,
  userRole?: string,
): Promise<BuildingWriteAccess> {
  if (!buildingId) {
    res.status(404).json({
      message: 'Building not found',
      code: 'BUILDING_NOT_FOUND',
    });
    return { ok: false };
  }
  const rows = await db
    .select({
      id: schema.buildings.id,
      organizationId: schema.buildings.organizationId,
    })
    .from(schema.buildings)
    .where(and(eq(schema.buildings.id, buildingId), eq(schema.buildings.isActive, true)))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({
      message: 'Building not found',
      code: 'BUILDING_NOT_FOUND',
    });
    return { ok: false };
  }
  const orgId = rows[0].organizationId;
  if (!orgId) {
    res.status(404).json({
      message: 'Building not found',
      code: 'BUILDING_NOT_FOUND',
    });
    return { ok: false };
  }
  const accessibleOrgIds = await getUserAccessibleOrganizations(userId, userRole);
  if (!accessibleOrgIds.includes(orgId)) {
    // Return 404 (not 403) to avoid confirming the building exists to callers
    // outside its organization — consistent with the 404-style existence-oracle
    // policy used on all cross-org read paths.
    res.status(404).json({
      message: 'Building not found',
      code: 'NOT_FOUND',
    });
    return { ok: false };
  }
  return { ok: true, buildingId, organizationId: orgId };
}

/**
 * Convenience wrapper that loads a bill row, then routes through
 * `assertBuildingWriteAccess` against its `buildingId`. Used by
 * bills-API handlers that take `:id` and need to load the bill
 * anyway. Returns `{ ok: false }` after writing 404/403 when:
 *   • the bill does not exist (matches the existing 404 shape used
 *     elsewhere in `server/api/bills.ts`),
 *   • the bill's building is inactive or missing,
 *   • the caller's accessible-orgs set does not include the
 *     building's organization.
 */
export async function assertBillWriteAccess(
  res: Response,
  userId: string,
  billId: string,
): Promise<{ ok: boolean; bill?: typeof schema.bills.$inferSelect }> {
  const billRows = await db
    .select()
    .from(schema.bills)
    .where(eq(schema.bills.id, billId))
    .limit(1);
  if (billRows.length === 0) {
    res.status(404).json({
      message: 'Bill not found',
    });
    return { ok: false };
  }
  const access = await assertBuildingWriteAccess(res, userId, billRows[0].buildingId);
  if (!access.ok) {
    return { ok: false };
  }
  return { ok: true, bill: billRows[0] };
}

