import { Express } from 'express';
import { db } from '../db';
import {
  demands,
  demandComments,
  residences,
  buildings,
  users,
  userResidences,
  userOrganizations,
  organizations,
} from '../../shared/schema';
import { eq, and, or, inArray, desc, asc } from 'drizzle-orm';
import { requireAuth } from '../auth/index';
import { insertDemandSchema, insertDemandCommentSchema } from '../../shared/schemas/operations';
import { z } from 'zod';

/**
 * Register demand routes for managing resident demands and complaints.
 *
 * @param app - Express application instance.
 */
/**
 * RegisterDemandRoutes function.
 * @param app
 * @returns Function result.
 */
export function registerDemandRoutes(app: Express) {
  // Get demands for a user (residents and managers)
  app.get('/api/demands', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const { buildingId, residenceId, type, status, search } = req.query;

      // Base query with joins
      let query = db
        .select({
          id: demands.id,
          submitterId: demands.submitterId,
          type: demands.type,
          assignationResidenceId: demands.assignationResidenceId,
          assignationBuildingId: demands.assignationBuildingId,
          description: demands.description,
          filePath: demands.filePath,
          fileName: demands.fileName,
          fileSize: demands.fileSize,
          residenceId: demands.residenceId,
          buildingId: demands.buildingId,
          status: demands.status,
          reviewedBy: demands.reviewedBy,
          reviewedAt: demands.reviewedAt,
          reviewNotes: demands.reviewNotes,
          createdAt: demands.createdAt,
          updatedAt: demands.updatedAt,
          submitter: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
          residence: {
            id: residences.id,
            unitNumber: residences.unitNumber,
            buildingId: residences.buildingId,
          },
          building: {
            id: buildings.id,
            name: buildings.name,
            address: buildings.address,
          },
        })
        .from(demands)
        .innerJoin(users, eq(demands.submitterId, users.id))
        .innerJoin(residences, eq(demands.residenceId, residences.id))
        .innerJoin(buildings, eq(demands.buildingId, buildings.id));

      // Apply role-based access control
      const conditions = [];
      
      if (user.role === 'admin') {
        // Admins can see all demands - no additional conditions needed
      } else if (user.role === 'manager') {
        // Managers can see demands from their organization's buildings
        const userOrganizationData = await db
          .select({ organizationId: userOrganizations.organizationId })
          .from(userOrganizations)
          .where(eq(userOrganizations.userId, user.id));
          
        if (userOrganizationData.length > 0) {
          const organizationId = userOrganizationData[0].organizationId;
          
          // Get buildings belonging to the manager's organization
          const organizationBuildings = await db
            .select({ buildingId: buildings.id })
            .from(buildings)
            .where(eq(buildings.organizationId, organizationId));
            
          if (organizationBuildings.length > 0) {
            const buildingIds = organizationBuildings.map(b => b.buildingId);
            conditions.push(inArray(demands.buildingId, buildingIds));
          } else {
            // Manager has no buildings - return empty results
            conditions.push(eq(demands.id, 'never-match'));
          }
        } else {
          // Manager not assigned to any organization - return empty results
          conditions.push(eq(demands.id, 'never-match'));
        }
      } else {
        // Residents and tenants can only see demands they created
        conditions.push(eq(demands.submitterId, user.id));
      }

      // Add filter conditions
      if (buildingId) {
        conditions.push(eq(demands.buildingId, buildingId));
      }
      if (residenceId) {
        conditions.push(eq(demands.residenceId, residenceId));
      }
      if (type) {
        conditions.push(eq(demands.type, type));
      }
      if (status) {
        conditions.push(eq(demands.status, status));
      }

      // Apply conditions to query if any exist
      let finalQuery;
      if (conditions.length > 0) {
        finalQuery = query.where(and(...conditions));
      } else {
        finalQuery = query;
      }

      const results = await finalQuery.orderBy(desc(demands.createdAt));

      // Filter by search term if provided
      let filteredResults = results;
      if (search) {
        const searchTerm = search.toLowerCase();
        filteredResults = results.filter(
          (demand) =>
            demand.description.toLowerCase().includes(searchTerm) ||
            demand.submitter.firstName?.toLowerCase().includes(searchTerm) ||
            demand.submitter.lastName?.toLowerCase().includes(searchTerm) ||
            demand.residence.unitNumber.toLowerCase().includes(searchTerm) ||
            demand.building.name.toLowerCase().includes(searchTerm)
        );
      }

      res.json(filteredResults);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch demands' });
    }
  });

  // Get a specific demand
  app.get('/api/demands/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const user = req.user;

      const demand = await db
        .select({
          id: demands.id,
          submitterId: demands.submitterId,
          type: demands.type,
          assignationResidenceId: demands.assignationResidenceId,
          assignationBuildingId: demands.assignationBuildingId,
          description: demands.description,
          filePath: demands.filePath,
          fileName: demands.fileName,
          fileSize: demands.fileSize,
          residenceId: demands.residenceId,
          buildingId: demands.buildingId,
          status: demands.status,
          reviewedBy: demands.reviewedBy,
          reviewedAt: demands.reviewedAt,
          reviewNotes: demands.reviewNotes,
          createdAt: demands.createdAt,
          updatedAt: demands.updatedAt,
          submitter: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
          residence: {
            id: residences.id,
            unitNumber: residences.unitNumber,
            buildingId: residences.buildingId,
          },
          building: {
            id: buildings.id,
            name: buildings.name,
            address: buildings.address,
          },
        })
        .from(demands)
        .innerJoin(users, eq(demands.submitterId, users.id))
        .innerJoin(residences, eq(demands.residenceId, residences.id))
        .innerJoin(buildings, eq(demands.buildingId, buildings.id))
        .where(eq(demands.id, id))
        .limit(1);

      if (demand.length === 0) {
        return res.status(404).json({ message: 'Demand not found' });
      }

      const demandData = demand[0];

      // Check access permissions based on user role
      let hasAccess = false;
      
      if (user.role === 'admin') {
        // Admins can view all demands
        hasAccess = true;
      } else if (user.role === 'manager') {
        // Managers can view demands from their organization's buildings
        const userOrganizationData = await db
          .select({ organizationId: userOrganizations.organizationId })
          .from(userOrganizations)
          .where(eq(userOrganizations.userId, user.id));
          
        if (userOrganizationData.length > 0) {
          const organizationId = userOrganizationData[0].organizationId;
          
          // Check if the demand's building belongs to the manager's organization
          const buildingOrganization = await db
            .select({ organizationId: buildings.organizationId })
            .from(buildings)
            .where(eq(buildings.id, demandData.buildingId))
            .limit(1);
            
          if (buildingOrganization.length > 0 && buildingOrganization[0].organizationId === organizationId) {
            hasAccess = true;
          }
        }
      } else {
        // Residents and tenants can only view their own demands
        hasAccess = demandData.submitterId === user.id;
      }
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json(demandData);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch demand' });
    }
  });

  // Create a new demand
  app.post('/api/demands', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const demandData = req.body;
      

      // Validate input using the corrected schema that already has optional fields
      const demandInputSchema = insertDemandSchema.omit({ submitterId: true });
      
      // Validate input
      const validatedData = demandInputSchema.parse(demandData);
      
      console.log('✅ Demand validation passed:', validatedData);

      // Implement role-based residence assignment validation
      if (user.role === 'admin') {
        // Admin can assign to any building/residence - no validation needed
        if (!validatedData.buildingId) {
          return res.status(400).json({ message: 'Building is required' });
        }
      } else if (user.role === 'manager') {
        // Manager can assign demands to all buildings assigned to them and their residences
        if (!validatedData.buildingId) {
          return res.status(400).json({ message: 'Building is required' });
        }
        
        // Verify manager has access to the specified building
        const userOrganizationData = await db
          .select({ organizationId: userOrganizations.organizationId })
          .from(userOrganizations)
          .where(eq(userOrganizations.userId, user.id));
          
        if (userOrganizationData.length === 0) {
          return res.status(403).json({ message: 'Manager not assigned to any organization' });
        }
        
        const organizationId = userOrganizationData[0].organizationId;
        const buildingAccess = await db
          .select({ id: buildings.id })
          .from(buildings)
          .where(and(eq(buildings.id, validatedData.buildingId), eq(buildings.organizationId, organizationId)))
          .limit(1);
          
        if (buildingAccess.length === 0) {
          return res.status(403).json({ message: 'Access denied to specified building' });
        }
        
        // If residence is specified, verify it belongs to the building
        if (validatedData.residenceId) {
          const residenceAccess = await db
            .select({ id: residences.id })
            .from(residences)
            .where(and(eq(residences.id, validatedData.residenceId), eq(residences.buildingId, validatedData.buildingId)))
            .limit(1);
            
          if (residenceAccess.length === 0) {
            return res.status(403).json({ message: 'Residence does not belong to specified building' });
          }
        }
      } else {
        // Resident and tenant can only assign residences assigned to them or their building
        const userResidenceData = await db
          .select({
            residenceId: userResidences.residenceId,
            buildingId: residences.buildingId,
          })
          .from(userResidences)
          .innerJoin(residences, eq(userResidences.residenceId, residences.id))
          .where(eq(userResidences.userId, user.id));

        if (userResidenceData.length === 0) {
          return res.status(400).json({ message: 'User must be assigned to a residence to create demands' });
        }

        // Auto-populate from user's primary residence if not provided
        if (!validatedData.residenceId || !validatedData.buildingId) {
          validatedData.residenceId = validatedData.residenceId || userResidenceData[0].residenceId;
          validatedData.buildingId = validatedData.buildingId || userResidenceData[0].buildingId;
        }
        
        // Validate that user has access to specified building/residence
        if (validatedData.buildingId) {
          const hasAccessToBuilding = userResidenceData.some(ur => ur.buildingId === validatedData.buildingId);
          if (!hasAccessToBuilding) {
            return res.status(403).json({ message: 'Access denied to specified building' });
          }
        }
        
        if (validatedData.residenceId) {
          const hasAccessToResidence = userResidenceData.some(ur => ur.residenceId === validatedData.residenceId);
          if (!hasAccessToResidence) {
            return res.status(403).json({ message: 'Access denied to specified residence' });
          }
        }
        
        // Ensure required fields are present after auto-population
        if (!validatedData.buildingId) {
          return res.status(400).json({ message: 'Building is required' });
        }
      }
      
      console.log('✅ Final demand data before insertion:', {
        buildingId: validatedData.buildingId,
        residenceId: validatedData.residenceId,
        type: validatedData.type,
        description: validatedData.description
      });

      const demandInsertData = {
        ...validatedData,
        buildingId: validatedData.buildingId,
        residenceId: validatedData.residenceId,
        submitterId: user.id,
        status: (validatedData.status as 'submitted' | 'under_review' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'cancelled') || 'submitted',
      };

      const newDemand = await db.insert(demands).values([demandInsertData]).returning();

      res.status(201).json(newDemand[0]);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid demand data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create demand' });
    }
  });

  // Update a demand
  app.put('/api/demands/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const updates = req.body;

      // Get the current demand
      const currentDemand = await db.select().from(demands).where(eq(demands.id, id)).limit(1);

      if (currentDemand.length === 0) {
        return res.status(404).json({ message: 'Demand not found' });
      }

      const demand = currentDemand[0];

      // Check permissions based on user role and update type
      let canUpdate = false;
      let allowedFields = [];
      
      if (user.role === 'admin') {
        // Admins can update any demand and any field
        canUpdate = true;
        allowedFields = ['status', 'reviewNotes', 'reviewedBy', 'reviewedAt', 'description', 'type'];
      } else if (user.role === 'manager') {
        // Managers can update demands from their organization's buildings (status/review fields only)
        const userOrganizationData = await db
          .select({ organizationId: userOrganizations.organizationId })
          .from(userOrganizations)
          .where(eq(userOrganizations.userId, user.id));
          
        if (userOrganizationData.length > 0) {
          const organizationId = userOrganizationData[0].organizationId;
          
          // Check if the demand's building belongs to the manager's organization
          const buildingOrganization = await db
            .select({ organizationId: buildings.organizationId })
            .from(buildings)
            .where(eq(buildings.id, demand.buildingId))
            .limit(1);
            
          if (buildingOrganization.length > 0 && buildingOrganization[0].organizationId === organizationId) {
            canUpdate = true;
            allowedFields = ['status', 'reviewNotes', 'reviewedBy', 'reviewedAt'];
          }
        }
      } else if (demand.submitterId === user.id) {
        // Residents and tenants can only update their own demands (limited fields)
        canUpdate = true;
        allowedFields = ['description', 'type'];
      }
      
      if (!canUpdate) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Filter updates to only allowed fields
      const filteredUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = value;
        }
      }
      
      // Add metadata for manager/admin updates
      if (user.role === 'admin' || user.role === 'manager') {
        if (updates.status && updates.status !== demand.status) {
          filteredUpdates['reviewedBy'] = user.id;
          filteredUpdates['reviewedAt'] = new Date();
        }
      }

      const updatedDemand = await db
        .update(demands)
        .set({ ...filteredUpdates, updatedAt: new Date() })
        .where(eq(demands.id, id))
        .returning();

      res.json(updatedDemand[0]);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to update demand' });
    }
  });

  // Delete a demand
  app.delete('/api/demands/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const user = req.user;

      // Get the current demand
      const currentDemand = await db.select().from(demands).where(eq(demands.id, id)).limit(1);

      if (currentDemand.length === 0) {
        return res.status(404).json({ message: 'Demand not found' });
      }

      const demand = currentDemand[0];

      // Check permissions based on user role
      let canDelete = false;
      
      if (user.role === 'admin') {
        // Admins can delete any demand
        canDelete = true;
      } else if (user.role === 'manager') {
        // Managers can delete demands from their organization's buildings
        const userOrganizationData = await db
          .select({ organizationId: userOrganizations.organizationId })
          .from(userOrganizations)
          .where(eq(userOrganizations.userId, user.id));
          
        if (userOrganizationData.length > 0) {
          const organizationId = userOrganizationData[0].organizationId;
          
          // Check if the demand's building belongs to the manager's organization
          const buildingOrganization = await db
            .select({ organizationId: buildings.organizationId })
            .from(buildings)
            .where(eq(buildings.id, demand.buildingId))
            .limit(1);
            
          if (buildingOrganization.length > 0 && buildingOrganization[0].organizationId === organizationId) {
            canDelete = true;
          }
        }
      } else if (demand.submitterId === user.id) {
        // Users can delete their own demands
        canDelete = true;
      }
      
      if (!canDelete) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Delete associated comments first (cascade delete)
      await db.delete(demandComments).where(eq(demandComments.demandId, id));
      
      // Then delete the demand
      await db.delete(demands).where(eq(demands.id, id));

      res.json({ message: 'Demand deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to delete demand' });
    }
  });

  // Get comments for a demand
  app.get('/api/demands/:id/comments', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const user = req.user;

      // First check if user has access to the demand
      const demand = await db.select().from(demands).where(eq(demands.id, id)).limit(1);

      if (demand.length === 0) {
        return res.status(404).json({ message: 'Demand not found' });
      }

      const demandData = demand[0];

      // Check access permissions based on user role
      let hasAccess = false;
      
      if (user.role === 'admin') {
        // Admins can view all demands
        hasAccess = true;
      } else if (user.role === 'manager') {
        // Managers can view demands from their organization's buildings
        const userOrganizationData = await db
          .select({ organizationId: userOrganizations.organizationId })
          .from(userOrganizations)
          .where(eq(userOrganizations.userId, user.id));
          
        if (userOrganizationData.length > 0) {
          const organizationId = userOrganizationData[0].organizationId;
          
          // Check if the demand's building belongs to the manager's organization
          const buildingOrganization = await db
            .select({ organizationId: buildings.organizationId })
            .from(buildings)
            .where(eq(buildings.id, demandData.buildingId))
            .limit(1);
            
          if (buildingOrganization.length > 0 && buildingOrganization[0].organizationId === organizationId) {
            hasAccess = true;
          }
        }
      } else {
        // Residents and tenants can only view their own demands
        hasAccess = demandData.submitterId === user.id;
      }
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const comments = await db
        .select({
          id: demandComments.id,
          demandId: demandComments.demandId,
          commentText: demandComments.commentText,
          commentType: demandComments.commentType,
          isInternal: demandComments.isInternal,
          commenterId: demandComments.commenterId,
          createdAt: demandComments.createdAt,
          author: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
        })
        .from(demandComments)
        .innerJoin(users, eq(demandComments.commenterId, users.id))
        .where(eq(demandComments.demandId, id))
        .orderBy(asc(demandComments.createdAt));

      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch demand comments' });
    }
  });

  // Create a comment on a demand
  app.post('/api/demands/:id/comments', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const commentData = req.body;

      // Validate input
      const validatedData = insertDemandCommentSchema.parse({
        ...commentData,
        demandId: id,
        commenterId: user.id,
      });

      // Check if user has access to the demand (same permission logic as GET comments)
      const demand = await db.select().from(demands).where(eq(demands.id, id)).limit(1);

      if (demand.length === 0) {
        return res.status(404).json({ message: 'Demand not found' });
      }

      const demandData = demand[0];

      // Check access permissions based on user role
      let hasAccess = false;
      
      if (user.role === 'admin') {
        // Admins can view all demands
        hasAccess = true;
      } else if (user.role === 'manager') {
        // Managers can view demands from their organization's buildings
        const userOrganizationData = await db
          .select({ organizationId: userOrganizations.organizationId })
          .from(userOrganizations)
          .where(eq(userOrganizations.userId, user.id));
          
        if (userOrganizationData.length > 0) {
          const organizationId = userOrganizationData[0].organizationId;
          
          // Check if the demand's building belongs to the manager's organization
          const buildingOrganization = await db
            .select({ organizationId: buildings.organizationId })
            .from(buildings)
            .where(eq(buildings.id, demandData.buildingId))
            .limit(1);
            
          if (buildingOrganization.length > 0 && buildingOrganization[0].organizationId === organizationId) {
            hasAccess = true;
          }
        }
      } else {
        // Residents and tenants can only view their own demands
        hasAccess = demandData.submitterId === user.id;
      }
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const newComment = await db.insert(demandComments).values(validatedData).returning();

      res.status(201).json(newComment[0]);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid comment data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create comment' });
    }
  });
}
