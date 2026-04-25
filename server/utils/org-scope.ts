import type { Response } from 'express';
import { isValidUUID } from './validation-helpers';
import { getUserAccessibleOrganizations } from '../rbac';

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

    const accessible = await getUserAccessibleOrganizations(user.id);
    if (!accessible.includes(requested)) {
      res.status(403).json({
        message: 'Access denied to this organization',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      return null;
    }

    return { explicit: true, orgIds: [requested] };
  }

  const accessible = await getUserAccessibleOrganizations(user.id);
  return { explicit: false, orgIds: accessible };
}
