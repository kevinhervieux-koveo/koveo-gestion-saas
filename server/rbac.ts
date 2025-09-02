import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { Request, Response, NextFunction } from 'express';

// Use shared database connection to avoid multiple pools
import { db } from './db';

/**
 * Authenticated user object with role-based access control information.
 * Contains user identity, role, and organization access rights for Quebec property management.
 * Used throughout the RBAC system for authorization decisions.
 *
 * @interface AuthenticatedUser
 * @property {string} id - Unique user identifier (UUID).
 * @property {string} username - User's login username.
 * @property {string} email - User's email address.
 * @property {string} firstName - User's first name.
 * @property {string} lastName - User's last name.
 * @property {'admin' | 'manager' | 'tenant' | 'resident'} role - User's primary role in the system.
 * @property {boolean} isActive - Whether the user account is active.
 * @property {string[]} [organizations] - Array of organization IDs the user can access.
 * @property {boolean} [canAccessAllOrganizations] - Whether user has global organization access (Koveo org).
 */
export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'tenant' | 'resident';
  isActive: boolean;
  organizations?: string[];
  canAccessAllOrganizations?: boolean;
}

/**
 * Context object for evaluating resource access permissions in the RBAC system.
 * Provides all necessary information to determine if a user can perform an action
 * on a specific resource within the property management hierarchy.
 *
 * @interface AccessContext
 * @property {AuthenticatedUser} user - The authenticated user requesting access.
 * @property {string} [organizationId] - Target organization ID for access check.
 * @property {string} [buildingId] - Target building ID for access check.
 * @property {string} [residenceId] - Target residence ID for access check.
 * @property {'organization' | 'building' | 'residence' | 'user' | 'bill' | 'maintenance' | 'document'} resourceType - Type of resource being accessed.
 * @property {'create' | 'read' | 'update' | 'delete'} action - Action being performed on the resource.
 */
export interface AccessContext {
  user: AuthenticatedUser;
  organizationId?: string;
  buildingId?: string;
  residenceId?: string;
  resourceType:
    | 'organization'
    | 'building'
    | 'residence'
    | 'user'
    | 'bill'
    | 'maintenance'
    | 'document';
  action: 'create' | 'read' | 'update' | 'delete';
}

/**
 * Retrieves all organization IDs that a user can access based on RBAC rules and memberships.
 * Implements Quebec property management access patterns including Demo organization access
 * for all users and Koveo organization global access privileges.
 *
 * @param {string} userId - UUID of the user to check organization access for.
 * @returns {Promise<string[]>} Promise resolving to array of accessible organization IDs.
 *
 * @example
 * ```typescript
 * const orgIds = await getUserAccessibleOrganizations('user-uuid');
 * ```
 */
/**
 * GetUserAccessibleOrganizations function.
 * @param userId
 * @returns Function result.
 */
export async function getUserAccessibleOrganizations(userId: string): Promise<string[]> {
  try {

    // Get user's organization memberships
    const userOrgs = await db.query.userOrganizations.findMany({
      where: and(
        eq(schema.userOrganizations.userId, userId),
        eq(schema.userOrganizations.isActive, true)
      ),
      with: {
        organization: true,
      },
    });


    // Get Demo organization ID (always accessible)
    const demoOrg = await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, 'Demo'),
    });


    const accessibleOrgIds = new Set<string>();

    // Add Demo organization (accessible to everyone)
    if (demoOrg) {
      accessibleOrgIds.add(demoOrg.id);
    }

    // Check each user organization membership
    for (const userOrg of userOrgs) {
      if (
        userOrg.canAccessAllOrganizations ||
        userOrg.organization?.name?.toLowerCase() === 'koveo'
      ) {
        // User can access all organizations (Koveo organization case or explicit flag)
        const allOrgs = await db.query.organizations.findMany({
          where: eq(schema.organizations.isActive, true),
        });
        allOrgs.forEach((org) => accessibleOrgIds.add(org.id));
        break;
      } else {
        // User can access their own organization
        accessibleOrgIds.add(userOrg.organizationId);
      }
    }

    const result = Array.from(accessibleOrgIds);
    return result;
    return [];
  }
}

/**
 * Retrieves all residence IDs that a user can access based on tenant/resident assignments.
 * Used primarily for tenant and resident roles to determine which specific residences
 * they can view and interact with in the property management system.
 *
 * @param {string} userId - UUID of the user to check residence access for.
 * @returns {Promise<string[]>} Promise resolving to array of accessible residence IDs.
 *
 * @example
 * ```typescript
 * const residenceIds = await getUserAccessibleResidences('tenant-user-uuid');
 * ```
 */
/**
 * GetUserAccessibleResidences function.
 * @param userId
 * @returns Function result.
 */
export async function getUserAccessibleResidences(userId: string): Promise<string[]> {
  try {
    const userResidences = await db.query.userResidences.findMany({
      where: and(
        eq(schema.userResidences.userId, userId),
        eq(schema.userResidences.isActive, true)
      ),
    });

    return userResidences.map((ur) => ur.residenceId);
    return [];
  }
}

/**
 * Checks if a user belongs to the Open Demo organization (view-only demo users).
 * Open Demo users have restricted permissions and can only view/read data.
 *
 * @param {string} userId - UUID of the user to check.
 * @returns {Promise<boolean>} Promise resolving to true if user is an Open Demo user.
 */
export async function isOpenDemoUser(userId: string): Promise<boolean> {
  try {
    // Get Open Demo organization
    const openDemoOrg = await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, 'Open Demo'),
    });

    if (!openDemoOrg) {
      return false;
    }

    // Check if user belongs to Open Demo organization
    const userOrg = await db.query.userOrganizations.findFirst({
      where: and(
        eq(schema.userOrganizations.userId, userId),
        eq(schema.userOrganizations.organizationId, openDemoOrg.id),
        eq(schema.userOrganizations.isActive, true)
      ),
    });

    return !!userOrg;
    return false;
  }
}

/**
 * Checks if a user can perform a write operation (create, update, delete).
 * Open Demo users are restricted to read-only access.
 *
 * @param {string} userId - UUID of the user to check.
 * @param {'create' | 'update' | 'delete' | 'manage' | 'approve' | 'assign' | 'share' | 'export' | 'backup' | 'restore'} action - The action to check.
 * @returns {Promise<boolean>} Promise resolving to true if user can perform write operations.
 */
export async function canUserPerformWriteOperation(
  userId: string,
  action:
    | 'create'
    | 'update'
    | 'delete'
    | 'manage'
    | 'approve'
    | 'assign'
    | 'share'
    | 'export'
    | 'backup'
    | 'restore'
): Promise<boolean> {
  // Check if user is from Open Demo organization (view-only)
  const isOpenDemo = await isOpenDemoUser(userId);
  if (isOpenDemo) {
    return false; // Open Demo users cannot perform any write operations
  }

  return true; // Regular users can perform write operations based on their permissions
}

/**
 * Checks if a user has access to a specific organization based on RBAC rules.
 * Validates access through user organization memberships, Demo organization access,
 * and Koveo organization global privileges.
 *
 * @param {string} userId - UUID of the user to check access for.
 * @param {string} organizationId - UUID of the organization to check access to.
 * @returns {Promise<boolean>} Promise resolving to true if user can access the organization.
 *
 * @example
 * ```typescript
 * const hasAccess = await canUserAccessOrganization('user-uuid', 'org-uuid');
 * if (hasAccess) {
 *   // Allow access to organization data
 * }
 * ```
 */
/**
 * CanUserAccessOrganization function.
 * @param userId
 * @param organizationId
 * @returns Function result.
 */
export async function canUserAccessOrganization(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const accessibleOrgs = await getUserAccessibleOrganizations(userId);
  return accessibleOrgs.includes(organizationId);
}

/**
 * Checks if a user has access to a specific building through organization membership.
 * Buildings are accessible if the user can access the organization that owns the building.
 *
 * @param {string} userId - UUID of the user to check access for.
 * @param {string} buildingId - UUID of the building to check access to.
 * @returns {Promise<boolean>} Promise resolving to true if user can access the building.
 *
 * @example
 * ```typescript
 * const canView = await canUserAccessBuilding('user-uuid', 'building-uuid');
 * if (canView) {
 *   // Show building information
 * }
 * ```
 */
/**
 * CanUserAccessBuilding function.
 * @param userId
 * @param buildingId
 * @returns Function result.
 */
export async function canUserAccessBuilding(userId: string, buildingId: string): Promise<boolean> {
  try {
    const building = await db.query.buildings.findFirst({
      where: eq(schema.buildings.id, buildingId),
    });

    if (!building) {
      return false;
    }

    return await canUserAccessOrganization(userId, building.organizationId);
    return false;
  }
}

/**
 * Checks if a user has access to a specific residence based on role and assignments.
 * Admin/Manager roles can access residences in their organizations.
 * Tenant/Resident roles can only access their specifically assigned residences.
 *
 * @param {string} userId - UUID of the user to check access for.
 * @param {string} residenceId - UUID of the residence to check access to.
 * @returns {Promise<boolean>} Promise resolving to true if user can access the residence.
 *
 * @example
 * ```typescript
 * const canAccess = await canUserAccessResidence('tenant-uuid', 'residence-uuid');
 * if (canAccess) {
 *   // Show residence details and related data
 * }
 * ```
 */
/**
 * CanUserAccessResidence function.
 * @param userId
 * @param residenceId
 * @returns Function result.
 */
export async function canUserAccessResidence(
  userId: string,
  residenceId: string
): Promise<boolean> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      return false;
    }

    // Admins and managers can access any residence in their accessible organizations
    if (['admin', 'manager'].includes(user.role)) {
      const residence = await db.query.residences.findFirst({
        where: eq(schema.residences.id, residenceId),
        with: {
          building: true,
        },
      });

      if (!residence) {
        return false;
      }

      return await canUserAccessOrganization(userId, residence.building?.organizationId || '');
    }

    // Tenants/residents can only access their own residences
    const accessibleResidences = await getUserAccessibleResidences(userId);
    return accessibleResidences.includes(residenceId);
    return false;
  }
}

/**
 * Middleware to check organization access.
 * @param param
 */
/**
 * RequireOrganizationAccess function.
 * @param param
 * @returns Function result.
 */
export function requireOrganizationAccess(param: string = 'organizationId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const organizationId = req.params[param] || req.body[param] || req.query[param];

    if (!organizationId) {
      return res.status(400).json({
        message: 'Organization ID is required',
        code: 'MISSING_ORGANIZATION_ID',
      });
    }

    try {
      const hasAccess = await canUserAccessOrganization(req.user.id, organizationId);

      if (!hasAccess) {
        return res.status(403).json({
          message: 'Access denied to this organization',
          code: 'ORGANIZATION_ACCESS_DENIED',
        });
      }

      next();
      return res.status(500).json({
        message: 'Authorization check failed',
        code: 'AUTHORIZATION_ERROR',
      });
    }
  };
}

/**
 * Middleware to check building access.
 * @param param
 */
/**
 * RequireBuildingAccess function.
 * @param param
 * @returns Function result.
 */
export function requireBuildingAccess(param: string = 'buildingId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const buildingId = req.params[param] || req.body[param] || req.query[param];

    if (!buildingId) {
      return res.status(400).json({
        message: 'Building ID is required',
        code: 'MISSING_BUILDING_ID',
      });
    }

    try {
      const hasAccess = await canUserAccessBuilding(req.user.id, buildingId);

      if (!hasAccess) {
        return res.status(403).json({
          message: 'Access denied to this building',
          code: 'BUILDING_ACCESS_DENIED',
        });
      }

      next();
      return res.status(500).json({
        message: 'Authorization check failed',
        code: 'AUTHORIZATION_ERROR',
      });
    }
  };
}

/**
 * Middleware to check residence access.
 * @param param
 */
/**
 * RequireResidenceAccess function.
 * @param param
 * @returns Function result.
 */
export function requireResidenceAccess(param: string = 'residenceId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const residenceId = req.params[param] || req.body[param] || req.query[param];

    if (!residenceId) {
      return res.status(400).json({
        message: 'Residence ID is required',
        code: 'MISSING_RESIDENCE_ID',
      });
    }

    try {
      const hasAccess = await canUserAccessResidence(req.user.id, residenceId);

      if (!hasAccess) {
        return res.status(403).json({
          message: 'Access denied to this residence',
          code: 'RESIDENCE_ACCESS_DENIED',
        });
      }

      next();
      return res.status(500).json({
        message: 'Authorization check failed',
        code: 'AUTHORIZATION_ERROR',
      });
    }
  };
}

/**
 * Filter organizations based on user access.
 * @param userId
 * @param organizations
 */
/**
 * FilterOrganizationsByAccess function.
 * @param userId
 * @param organizations
 * @returns Function result.
 */
export async function filterOrganizationsByAccess(
  userId: string,
  organizations: any[]
): Promise<any[]> {
  const accessibleOrgIds = await getUserAccessibleOrganizations(userId);
  return organizations.filter((org) => accessibleOrgIds.includes(org.id));
}

/**
 * Filter buildings based on user access.
 * @param userId
 * @param buildings
 */
/**
 * FilterBuildingsByAccess function.
 * @param userId
 * @param buildings
 * @returns Function result.
 */
export async function filterBuildingsByAccess(userId: string, buildings: any[]): Promise<any[]> {
  const accessibleOrgIds = await getUserAccessibleOrganizations(userId);
  return buildings.filter((building) => accessibleOrgIds.includes(building.organizationId));
}

/**
 * Filter residences based on user access.
 * @param userId
 * @param residences
 */
/**
 * FilterResidencesByAccess function.
 * @param userId
 * @param residences
 * @returns Function result.
 */
export async function filterResidencesByAccess(userId: string, residences: any[]): Promise<any[]> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user) {
    return [];
  }

  // For admins/managers, filter by organization access
  if (['admin', 'manager'].includes(user.role)) {
    const accessibleOrgIds = await getUserAccessibleOrganizations(userId);

    // Get all buildings in accessible organizations
    const accessibleBuildings = await db.query.buildings.findMany({
      where: inArray(schema.buildings.organizationId, accessibleOrgIds),
    });

    const accessibleBuildingIds = accessibleBuildings.map((b) => b.id);
    return residences.filter((residence: any) =>
      accessibleBuildingIds.includes(residence.buildingId)
    );
  }

  // For tenants/residents, only show their own residences
  const accessibleResidenceIds = await getUserAccessibleResidences(userId);
  return residences.filter((residence: any) => accessibleResidenceIds.includes(residence.id));
}

/**
 * Get organization filter for database queries.
 * @param userId
 */
/**
 * GetOrganizationFilter function.
 * @param userId
 * @returns Function result.
 */
export async function getOrganizationFilter(userId: string) {
  const accessibleOrgIds = await getUserAccessibleOrganizations(userId);
  return inArray(schema.organizations.id, accessibleOrgIds);
}

/**
 * Get building filter for database queries.
 * @param userId
 */
/**
 * GetBuildingFilter function.
 * @param userId
 * @returns Function result.
 */
export async function getBuildingFilter(userId: string) {
  const accessibleOrgIds = await getUserAccessibleOrganizations(userId);
  return inArray(schema.buildings.organizationId, accessibleOrgIds);
}

/**
 * Get residence filter for database queries.
 * @param userId
 */
/**
 * GetResidenceFilter function.
 * @param userId
 * @returns Function result.
 */
export async function getResidenceFilter(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user) {
    return eq(schema.residences.id, 'never-match');
  }

  // For admins/managers, filter by organization access
  if (['admin', 'manager'].includes(user.role)) {
    const accessibleOrgIds = await getUserAccessibleOrganizations(userId);

    // Get all buildings in accessible organizations
    const accessibleBuildings = await db.query.buildings.findMany({
      where: inArray(schema.buildings.organizationId, accessibleOrgIds),
    });

    const accessibleBuildingIds = accessibleBuildings.map((b) => b.id);
    return inArray(schema.residences.buildingId, accessibleBuildingIds);
  }

  // For tenants/residents, only show their own residences
  const accessibleResidenceIds = await getUserAccessibleResidences(userId);
  return inArray(schema.residences.id, accessibleResidenceIds);
}
