import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { Request, Response, NextFunction } from 'express';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

/**
 *
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
 *
 */
export interface AccessContext {
  user: AuthenticatedUser;
  organizationId?: string;
  buildingId?: string;
  residenceId?: string;
  resourceType: 'organization' | 'building' | 'residence' | 'user' | 'bill' | 'maintenance' | 'document';
  action: 'create' | 'read' | 'update' | 'delete';
}

/**
 * Get user's accessible organization IDs based on RBAC rules.
 * @param userId
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
        organization: true
      }
    });

    // Get Demo organization ID (always accessible)
    const demoOrg = await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, 'Demo')
    });

    const accessibleOrgIds = new Set<string>();
    
    // Add Demo organization (accessible to everyone)
    if (demoOrg) {
      accessibleOrgIds.add(demoOrg.id);
    }

    // Check each user organization membership
    for (const userOrg of userOrgs) {
      if (userOrg.canAccessAllOrganizations) {
        // User can access all organizations (Koveo admin case)
        const allOrgs = await db.query.organizations.findMany({
          where: eq(schema.organizations.isActive, true)
        });
        allOrgs.forEach(org => accessibleOrgIds.add(org.id));
        break;
      } else {
        // User can access their own organization
        accessibleOrgIds.add(userOrg.organizationId);
      }
    }

    return Array.from(accessibleOrgIds);
  } catch (error) {
    console.error('Error getting user accessible organizations:', error);
    return [];
  }
}

/**
 * Get user's accessible residence IDs (for tenants/residents).
 * @param userId
 */
export async function getUserAccessibleResidences(userId: string): Promise<string[]> {
  try {
    const userResidences = await db.query.userResidences.findMany({
      where: and(
        eq(schema.userResidences.userId, userId),
        eq(schema.userResidences.isActive, true)
      )
    });

    return userResidences.map(ur => ur.residenceId);
  } catch (error) {
    console.error('Error getting user accessible residences:', error);
    return [];
  }
}

/**
 * Check if user can access a specific organization.
 * @param userId
 * @param organizationId
 */
export async function canUserAccessOrganization(userId: string, organizationId: string): Promise<boolean> {
  const accessibleOrgs = await getUserAccessibleOrganizations(userId);
  return accessibleOrgs.includes(organizationId);
}

/**
 * Check if user can access a specific building.
 * @param userId
 * @param buildingId
 */
export async function canUserAccessBuilding(userId: string, buildingId: string): Promise<boolean> {
  try {
    const building = await db.query.buildings.findFirst({
      where: eq(schema.buildings.id, buildingId)
    });

    if (!building) {return false;}

    return await canUserAccessOrganization(userId, building.organizationId);
  } catch (error) {
    console.error('Error checking building access:', error);
    return false;
  }
}

/**
 * Check if user can access a specific residence.
 * @param userId
 * @param residenceId
 */
export async function canUserAccessResidence(userId: string, residenceId: string): Promise<boolean> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId)
    });

    if (!user) {return false;}

    // Admins and managers can access any residence in their accessible organizations
    if (['admin', 'manager'].includes(user.role)) {
      const residence = await db.query.residences.findFirst({
        where: eq(schema.residences.id, residenceId),
        with: {
          building: true
        }
      });

      if (!residence) {return false;}

      return await canUserAccessOrganization(userId, residence.building.organizationId);
    }

    // Tenants/residents can only access their own residences
    const accessibleResidences = await getUserAccessibleResidences(userId);
    return accessibleResidences.includes(residenceId);
  } catch (error) {
    console.error('Error checking residence access:', error);
    return false;
  }
}

/**
 * Middleware to check organization access.
 * @param param
 */
export function requireOrganizationAccess(param: string = 'organizationId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED' 
      });
    }

    const organizationId = req.params[param] || req.body[param] || req.query[param];
    
    if (!organizationId) {
      return res.status(400).json({
        message: 'Organization ID is required',
        code: 'MISSING_ORGANIZATION_ID'
      });
    }

    try {
      const hasAccess = await canUserAccessOrganization(req.user.id, organizationId);
      
      if (!hasAccess) {
        return res.status(403).json({
          message: 'Access denied to this organization',
          code: 'ORGANIZATION_ACCESS_DENIED'
        });
      }

      next();
    } catch (error) {
      console.error('Organization access check error:', error);
      return res.status(500).json({
        message: 'Authorization check failed',
        code: 'AUTHORIZATION_ERROR'
      });
    }
  };
}

/**
 * Middleware to check building access.
 * @param param
 */
export function requireBuildingAccess(param: string = 'buildingId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED' 
      });
    }

    const buildingId = req.params[param] || req.body[param] || req.query[param];
    
    if (!buildingId) {
      return res.status(400).json({
        message: 'Building ID is required',
        code: 'MISSING_BUILDING_ID'
      });
    }

    try {
      const hasAccess = await canUserAccessBuilding(req.user.id, buildingId);
      
      if (!hasAccess) {
        return res.status(403).json({
          message: 'Access denied to this building',
          code: 'BUILDING_ACCESS_DENIED'
        });
      }

      next();
    } catch (error) {
      console.error('Building access check error:', error);
      return res.status(500).json({
        message: 'Authorization check failed',
        code: 'AUTHORIZATION_ERROR'
      });
    }
  };
}

/**
 * Middleware to check residence access.
 * @param param
 */
export function requireResidenceAccess(param: string = 'residenceId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED' 
      });
    }

    const residenceId = req.params[param] || req.body[param] || req.query[param];
    
    if (!residenceId) {
      return res.status(400).json({
        message: 'Residence ID is required',
        code: 'MISSING_RESIDENCE_ID'
      });
    }

    try {
      const hasAccess = await canUserAccessResidence(req.user.id, residenceId);
      
      if (!hasAccess) {
        return res.status(403).json({
          message: 'Access denied to this residence',
          code: 'RESIDENCE_ACCESS_DENIED'
        });
      }

      next();
    } catch (error) {
      console.error('Residence access check error:', error);
      return res.status(500).json({
        message: 'Authorization check failed',
        code: 'AUTHORIZATION_ERROR'
      });
    }
  };
}

/**
 * Filter organizations based on user access.
 * @param userId
 * @param organizations
 */
export async function filterOrganizationsByAccess(userId: string, organizations: any[]): Promise<any[]> {
  const accessibleOrgIds = await getUserAccessibleOrganizations(userId);
  return organizations.filter(org => accessibleOrgIds.includes(org.id));
}

/**
 * Filter buildings based on user access.
 * @param userId
 * @param buildings
 */
export async function filterBuildingsByAccess(userId: string, buildings: any[]): Promise<any[]> {
  const accessibleOrgIds = await getUserAccessibleOrganizations(userId);
  return buildings.filter(building => accessibleOrgIds.includes(building.organizationId));
}

/**
 * Filter residences based on user access.
 * @param userId
 * @param residences
 */
export async function filterResidencesByAccess(userId: string, residences: any[]): Promise<any[]> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId)
  });

  if (!user) {return [];}

  // For admins/managers, filter by organization access
  if (['admin', 'manager'].includes(user.role)) {
    const accessibleOrgIds = await getUserAccessibleOrganizations(userId);
    
    // Get all buildings in accessible organizations
    const accessibleBuildings = await db.query.buildings.findMany({
      where: inArray(schema.buildings.organizationId, accessibleOrgIds)
    });
    
    const accessibleBuildingIds = accessibleBuildings.map(b => b.id);
    return residences.filter(residence => accessibleBuildingIds.includes(residence.buildingId));
  }

  // For tenants/residents, only show their own residences
  const accessibleResidenceIds = await getUserAccessibleResidences(userId);
  return residences.filter(residence => accessibleResidenceIds.includes(residence.id));
}

/**
 * Get organization filter for database queries.
 * @param userId
 */
export async function getOrganizationFilter(userId: string) {
  const accessibleOrgIds = await getUserAccessibleOrganizations(userId);
  return inArray(schema.organizations.id, accessibleOrgIds);
}

/**
 * Get building filter for database queries.
 * @param userId
 */
export async function getBuildingFilter(userId: string) {
  const accessibleOrgIds = await getUserAccessibleOrganizations(userId);
  return inArray(schema.buildings.organizationId, accessibleOrgIds);
}

/**
 * Get residence filter for database queries.
 * @param userId
 */
export async function getResidenceFilter(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId)
  });

  if (!user) {return eq(schema.residences.id, 'never-match');}

  // For admins/managers, filter by organization access
  if (['admin', 'manager'].includes(user.role)) {
    const accessibleOrgIds = await getUserAccessibleOrganizations(userId);
    
    // Get all buildings in accessible organizations
    const accessibleBuildings = await db.query.buildings.findMany({
      where: inArray(schema.buildings.organizationId, accessibleOrgIds)
    });
    
    const accessibleBuildingIds = accessibleBuildings.map(b => b.id);
    return inArray(schema.residences.buildingId, accessibleBuildingIds);
  }

  // For tenants/residents, only show their own residences
  const accessibleResidenceIds = await getUserAccessibleResidences(userId);
  return inArray(schema.residences.id, accessibleResidenceIds);
}