/**
 * Organizations API endpoints for admin operations.
 * Provides CRUD operations for organization management.
 */

import { Express } from 'express';
import { db } from '../db';
import { organizations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../auth';

/**
 *
 * @param app
 */
export function registerOrganizationRoutes(app: Express): void {
  /**
   * GET /api/organizations - Retrieves organizations accessible to the current user
   * Returns array of organizations directly for frontend components
   */
  app.get('/api/organizations', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      console.log(`📊 Fetching organizations for user ${currentUser.id} with role ${currentUser.role}`);

      // Get organizations based on user role
      let organizationsQuery;
      
      if (currentUser.role === 'admin') {
        // Admin can see all organizations
        organizationsQuery = db
          .select({
            id: organizations.id,
            name: organizations.name,
            type: organizations.type,
            address: organizations.address,
            city: organizations.city,
            province: organizations.province,
            postalCode: organizations.postalCode,
            phone: organizations.phone,
            email: organizations.email,
            website: organizations.website,
            registrationNumber: organizations.registrationNumber,
            isActive: organizations.isActive,
            createdAt: organizations.createdAt,
          })
          .from(organizations)
          .where(eq(organizations.isActive, true))
          .orderBy(organizations.name);
      } else {
        // Other users see organizations they have access to
        // For now, return empty array for non-admin users
        // This can be extended later with proper RBAC
        organizationsQuery = db
          .select({
            id: organizations.id,
            name: organizations.name,
            type: organizations.type,
            address: organizations.address,
            city: organizations.city,
            province: organizations.province,
            postalCode: organizations.postalCode,
            phone: organizations.phone,
            email: organizations.email,
            website: organizations.website,
            registrationNumber: organizations.registrationNumber,
            isActive: organizations.isActive,
            createdAt: organizations.createdAt,
          })
          .from(organizations)
          .where(eq(organizations.isActive, true))
          .orderBy(organizations.name)
          .limit(0); // For now, limit to 0 for non-admin users
      }

      const userOrganizations = await organizationsQuery;
      console.log(`✅ Found ${userOrganizations.length} organizations for user ${currentUser.id}`);

      // Return array directly (not wrapped in object)
      res.json(userOrganizations);

    } catch (error) {
      console.error('❌ Error fetching organizations:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch organizations'
      });
    }
  });

  /**
   * GET /api/admin/organizations - Retrieves all organizations for admin users
   * Only admin users can access all organizations.
   */
  app.get('/api/admin/organizations', requireAuth, async (req: any, res) => {
    try {
      // Check if user is admin
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      console.log(`📊 Fetching all organizations for admin user ${currentUser.id}`);

      // Get all organizations for admin
      const allOrganizations = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          type: organizations.type,
          address: organizations.address,
          city: organizations.city,
          province: organizations.province,
          postalCode: organizations.postalCode,
          phone: organizations.phone,
          email: organizations.email,
          website: organizations.website,
          registrationNumber: organizations.registrationNumber,
          isActive: organizations.isActive,
          createdAt: organizations.createdAt,
        })
        .from(organizations)
        .where(eq(organizations.isActive, true))
        .orderBy(organizations.name);

      console.log(`✅ Found ${allOrganizations.length} organizations`);

      res.json({
        organizations: allOrganizations
      });

    } catch (error) {
      console.error('❌ Error fetching organizations:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch organizations'
      });
    }
  });

  /**
   * POST /api/organizations - Create a new organization
   * Allows authorized users to create organizations
   */
  app.post('/api/organizations', requireAuth, async (req: any, res) => {
    try {
      const currentUser = req.user || req.session?.user;
      if (!currentUser) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Only admin users can create organizations for now
      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          message: 'Admin access required to create organizations',
          code: 'ADMIN_REQUIRED'
        });
      }

      const organizationData = req.body;
      console.log('📥 Creating organization with data:', organizationData);

      // Insert new organization
      const [newOrganization] = await db.insert(organizations).values({
        name: organizationData.name,
        type: organizationData.type,
        address: organizationData.address,
        city: organizationData.city,
        province: organizationData.province || 'QC',
        postalCode: organizationData.postalCode,
        phone: organizationData.phone || null,
        email: organizationData.email || null,
        website: organizationData.website || null,
        registrationNumber: organizationData.registrationNumber || null,
      }).returning({
        id: organizations.id,
        name: organizations.name,
        type: organizations.type,
        address: organizations.address,
        city: organizations.city,
        province: organizations.province,
        postalCode: organizations.postalCode,
        phone: organizations.phone,
        email: organizations.email,
        website: organizations.website,
        registrationNumber: organizations.registrationNumber,
        isActive: organizations.isActive,
        createdAt: organizations.createdAt,
      });

      console.log('✅ Created organization:', newOrganization.name);
      res.status(201).json(newOrganization);

    } catch (error) {
      console.error('❌ Error creating organization:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create organization'
      });
    }
  });
}