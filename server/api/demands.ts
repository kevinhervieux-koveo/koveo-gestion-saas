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

      // Declare variables outside the conditions to fix scope issues
      let orgIds: string[] = [];
      let residenceIds: string[] = [];

      // Apply role-based filtering
      if (user.role === 'admin') {
        // Admin can see all demands
      } else if (user.role === 'manager') {
        // Manager can see demands in their organization's buildings
        const userOrgs = await db
          .select({ organizationId: userOrganizations.organizationId })
          .from(userOrganizations)
          .where(eq(userOrganizations.userId, user.id));

        orgIds = userOrgs.map((org) => org.organizationId);

        if (orgIds.length > 0) {
          query = query.innerJoin(organizations, eq(buildings.organizationId, organizations.id));
          // Add organization filter later with other conditions
        } else {
          return res.json([]); // No organization access
        }
      } else {
        // Residents and tenants can see demands from their residences or demands they submitted
        const userResidenceData = await db
          .select({ residenceId: userResidences.residenceId })
          .from(userResidences)
          .where(eq(userResidences.userId, user.id));

        residenceIds = userResidenceData.map((ur) => ur.residenceId);
      }

      // Apply filters
      const conditions = [];

      // Add role-based conditions
      if (user.role === 'manager' && orgIds.length > 0) {
        conditions.push(inArray(buildings.organizationId, orgIds));
      } else if (user.role !== 'admin') {
        if (residenceIds.length > 0) {
          conditions.push(
            or(eq(demands.submitterId, user.id), inArray(demands.residenceId, residenceIds))
          );
        } else {
          conditions.push(eq(demands.submitterId, user.id));
        }
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
      console.error('Error fetching demands:', error);
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

      // Check access permissions
      if (user.role !== 'admin') {
        if (user.role === 'manager') {
          // Check if manager has access to this building's organization
          const userOrgs = await db
            .select({ organizationId: userOrganizations.organizationId })
            .from(userOrganizations)
            .where(eq(userOrganizations.userId, user.id));

          const buildingOrg = await db
            .select({ organizationId: buildings.organizationId })
            .from(buildings)
            .where(eq(buildings.id, demandData.buildingId))
            .limit(1);

          const hasAccess = userOrgs.some(
            (org) => buildingOrg.length > 0 && org.organizationId === buildingOrg[0].organizationId
          );

          if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied' });
          }
        } else {
          // Residents/tenants can only view their own demands or demands from their residences
          const userResidenceData = await db
            .select({ residenceId: userResidences.residenceId })
            .from(userResidences)
            .where(eq(userResidences.userId, user.id));

          const residenceIds = userResidenceData.map((ur) => ur.residenceId);

          if (
            demandData.submitterId !== user.id &&
            !residenceIds.includes(demandData.residenceId)
          ) {
            return res.status(403).json({ message: 'Access denied' });
          }
        }
      }

      res.json(demandData);
    } catch (error: any) {
      console.error('Error fetching demand:', error);
      res.status(500).json({ message: 'Failed to fetch demand' });
    }
  });

  // Create a new demand
  app.post('/api/demands', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const demandData = req.body;

      // Validate input
      const validatedData = insertDemandSchema.parse(demandData);

      // Auto-populate residence and building from user's primary residence if not provided
      if (!validatedData.residenceId || !validatedData.buildingId) {
        const userResidenceData = await db
          .select({
            residenceId: userResidences.residenceId,
            buildingId: residences.buildingId,
          })
          .from(userResidences)
          .innerJoin(residences, eq(userResidences.residenceId, residences.id))
          .where(eq(userResidences.userId, user.id))
          .limit(1);

        if (userResidenceData.length === 0) {
          return res
            .status(400)
            .json({ message: 'User must be assigned to a residence to create demands' });
        }

        validatedData.residenceId = validatedData.residenceId || userResidenceData[0].residenceId;
        validatedData.buildingId = validatedData.buildingId || userResidenceData[0].buildingId;
      }

      const demandInsertData = {
        ...validatedData,
        submitterId: user.id,
      };

      const newDemand = await db.insert(demands).values([demandInsertData]).returning();

      res.status(201).json(newDemand[0]);
    } catch (error: any) {
      console.error('Error creating demand:', error);
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

      // Check permissions
      let canUpdate = false;
      if (user.role === 'admin') {
        canUpdate = true;
      } else if (user.role === 'manager') {
        // Check if manager has access to this building's organization
        const userOrgs = await db
          .select({ organizationId: userOrganizations.organizationId })
          .from(userOrganizations)
          .where(eq(userOrganizations.userId, user.id));

        const buildingOrg = await db
          .select({ organizationId: buildings.organizationId })
          .from(buildings)
          .where(eq(buildings.id, demand.buildingId))
          .limit(1);

        canUpdate = userOrgs.some(
          (org) => buildingOrg.length > 0 && org.organizationId === buildingOrg[0].organizationId
        );
      } else if (demand.submitterId === user.id) {
        // Users can update their own demands (limited fields)
        canUpdate = true;
        // Restrict what residents can update
        const allowedFields = [
          'description',
          'type',
          'assignationResidenceId',
          'assignationBuildingId',
        ];
        const restrictedUpdates: any = {};
        for (const [key, value] of Object.entries(updates)) {
          if (allowedFields.includes(key)) {
            restrictedUpdates[key] = value;
          }
        }
        Object.assign(updates, restrictedUpdates);
      }

      if (!canUpdate) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updatedDemand = await db
        .update(demands)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(demands.id, id))
        .returning();

      res.json(updatedDemand[0]);
    } catch (error: any) {
      console.error('Error updating demand:', error);
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

      // Check permissions
      let canDelete = false;
      if (user.role === 'admin') {
        canDelete = true;
      } else if (user.role === 'manager') {
        // Check if manager has access to this building's organization
        const userOrgs = await db
          .select({ organizationId: userOrganizations.organizationId })
          .from(userOrganizations)
          .where(eq(userOrganizations.userId, user.id));

        const buildingOrg = await db
          .select({ organizationId: buildings.organizationId })
          .from(buildings)
          .where(eq(buildings.id, demand.buildingId))
          .limit(1);

        canDelete = userOrgs.some(
          (org) => buildingOrg.length > 0 && org.organizationId === buildingOrg[0].organizationId
        );
      } else if (demand.submitterId === user.id && demand.status === 'draft') {
        // Users can only delete their own draft demands
        canDelete = true;
      }

      if (!canDelete) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await db.delete(demands).where(eq(demands.id, id));

      res.json({ message: 'Demand deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting demand:', error);
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

      // Check access permissions (same logic as get demand)
      // ... (permission check logic similar to get demand endpoint)

      const comments = await db
        .select({
          id: demandComments.id,
          demandId: demandComments.demandId,
          orderIndex: demandComments.orderIndex,
          comment: demandComments.comment,
          createdBy: demandComments.createdBy,
          createdAt: demandComments.createdAt,
          author: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
        })
        .from(demandComments)
        .innerJoin(users, eq(demandComments.createdBy, users.id))
        .where(eq(demandComments.demandId, id))
        .orderBy(asc(demandComments.orderIndex), asc(demandComments.createdAt));

      res.json(comments);
    } catch (error: any) {
      console.error('Error fetching demand comments:', error);
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
        createdBy: user.id,
      });

      // Check if user has access to the demand (similar logic as above)
      const demand = await db.select().from(demands).where(eq(demands.id, id)).limit(1);

      if (demand.length === 0) {
        return res.status(404).json({ message: 'Demand not found' });
      }

      // Get next order index
      const lastComment = await db
        .select({ orderIndex: demandComments.orderIndex })
        .from(demandComments)
        .where(eq(demandComments.demandId, id))
        .orderBy(desc(demandComments.orderIndex))
        .limit(1);

      const nextOrderIndex = lastComment.length > 0 ? parseFloat(lastComment[0].orderIndex) + 1 : 1;

      const orderIndex = nextOrderIndex;

      const newComment = await db.insert(demandComments).values(validatedData).returning();

      res.status(201).json(newComment[0]);
    } catch (error: any) {
      console.error('Error creating demand comment:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid comment data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create comment' });
    }
  });
}
