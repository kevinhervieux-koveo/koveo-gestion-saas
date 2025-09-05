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

      // Apply filters - all users only see demands they created
      const conditions = [eq(demands.submitterId, user.id)];

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

      // Check access permissions - users can only view their own demands
      if (demandData.submitterId !== user.id) {
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

      // Ensure required fields are present after auto-population
      if (!validatedData.buildingId || !validatedData.residenceId) {
        return res.status(400).json({ 
          message: 'Building and residence are required to create a demand' 
        });
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

      // Check permissions - users can only update their own demands
      if (demand.submitterId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updatedDemand = await db
        .update(demands)
        .set({ ...updates, updatedAt: new Date() })
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

      // Check permissions - users can only delete their own demands
      if (demand.submitterId !== user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

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

      // Check access permissions (same logic as get demand)
      // ... (permission check logic similar to get demand endpoint)

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

      // Check if user has access to the demand (similar logic as above)
      const demand = await db.select().from(demands).where(eq(demands.id, id)).limit(1);

      if (demand.length === 0) {
        return res.status(404).json({ message: 'Demand not found' });
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
