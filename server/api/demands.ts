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
import { eq, and, or, inArray, desc, asc, sql } from 'drizzle-orm';
import { requireAuth } from '../auth/index';
import { insertDemandSchema, insertDemandCommentSchema } from '../../shared/schemas/operations';
import { z } from 'zod';
import { demandNotificationService } from '../services/demand-notification-service';
import { ObjectStorageService } from '../objectStorage';
import { canUserAccessOrganization, getUserAccessibleOrganizations } from '../rbac';

import { asyncHandler } from '../utils/async-handler';
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
  app.get('/api/demands', requireAuth, asyncHandler(async (req: any, res: any) => {
      const user = req.user;
      const { buildingId, residenceId, type, status, search, submitterId } = req.query;

      // Base query with joins - use left joins to handle optional residence relationships
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
        .leftJoin(residences, eq(demands.residenceId, residences.id))
        .innerJoin(buildings, eq(demands.buildingId, buildings.id));

      // Apply role-based access control
      const conditions = [];
      
      // If submitterId is provided, use it to filter (allows "my demands only" view for all roles)
      if (submitterId) {
        // Security: users can only request their own demands via submitterId
        if (submitterId !== user.id) {
          return res.status(403).json({ message: 'Access denied: cannot view other users\' demands' });
        }
        conditions.push(eq(demands.submitterId, user.id));
      } else if (user.role === 'admin') {
        // Admins can see all demands - no additional conditions needed
      } else if (user.role === 'manager' || user.role === 'demo_manager') {
        // Managers can see demands from all their accessible organizations' buildings
        const accessibleOrgIds = await getUserAccessibleOrganizations(user.id);
          
        if (accessibleOrgIds.length > 0) {
          // Get buildings belonging to all accessible organizations
          const organizationBuildings = await db
            .select({ buildingId: buildings.id })
            .from(buildings)
            .where(inArray(buildings.organizationId, accessibleOrgIds));
            
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
        // Residents and tenants can only see demands they personally created
        conditions.push(eq(demands.submitterId, user.id));
      }

      // Add filter conditions
      if (buildingId) {
        conditions.push(eq(demands.buildingId, buildingId));
      }
      if (residenceId) {
        // Filter by both residenceId and assignationResidenceId
        conditions.push(
          or(
            eq(demands.residenceId, residenceId),
            eq(demands.assignationResidenceId, residenceId)
          )
        );
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

      // Post-process to fetch residence data for demands with assignationResidenceId but null residence
      const demandsNeedingResidenceData = results.filter(
        demand => !demand.residence?.id && demand.assignationResidenceId
      );
      
      if (demandsNeedingResidenceData.length > 0) {
        const assignationResidenceIds = demandsNeedingResidenceData.map(d => d.assignationResidenceId);
        
        // Fetch assignation residence data in a single query
        const assignationResidencesData = await db
          .select({
            id: residences.id,
            unitNumber: residences.unitNumber,
            buildingId: residences.buildingId,
          })
          .from(residences)
          .where(inArray(residences.id, assignationResidenceIds));
        
        // Create a map for quick lookup
        const residenceMap = new Map(
          assignationResidencesData.map(r => [r.id, r])
        );
        
        // Update residence data for demands that need it
        demandsNeedingResidenceData.forEach(demand => {
          const residenceData = residenceMap.get(demand.assignationResidenceId);
          if (residenceData) {
            demand.residence = residenceData;
          }
        });
      }

      // Filter by search term if provided
      let filteredResults = results;
      if (search) {
        const searchTerm = search.toLowerCase();
        filteredResults = results.filter(
          (demand) =>
            demand.description.toLowerCase().includes(searchTerm) ||
            demand.submitter.firstName?.toLowerCase().includes(searchTerm) ||
            demand.submitter.lastName?.toLowerCase().includes(searchTerm) ||
            demand.residence?.unitNumber?.toLowerCase().includes(searchTerm) ||
            demand.building.name.toLowerCase().includes(searchTerm)
        );
      }

      res.json(filteredResults);
    }, { errorMessage: 'Failed to fetch demands', errorLogPrefix: 'Error fetching demands' }));

  // Get a specific demand
  app.get('/api/demands/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
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
        .leftJoin(residences, eq(demands.residenceId, residences.id))
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
      } else if (user.role === 'manager' || user.role === 'demo_manager') {
        // Managers can view demands from all their accessible organizations' buildings
        const buildingOrganization = await db
          .select({ organizationId: buildings.organizationId })
          .from(buildings)
          .where(eq(buildings.id, demandData.buildingId))
          .limit(1);
          
        if (buildingOrganization.length > 0) {
          hasAccess = await canUserAccessOrganization(user.id, buildingOrganization[0].organizationId);
        }
      } else {
        // Residents and tenants can only view demands they personally created
        hasAccess = demandData.submitterId === user.id;
      }
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Post-process to fetch residence data if needed
      if (!demandData.residence?.id && demandData.assignationResidenceId) {
        const assignationResidenceData = await db
          .select({
            id: residences.id,
            unitNumber: residences.unitNumber,
            buildingId: residences.buildingId,
          })
          .from(residences)
          .where(eq(residences.id, demandData.assignationResidenceId))
          .limit(1);
        
        if (assignationResidenceData.length > 0) {
          demandData.residence = assignationResidenceData[0];
        }
      }

      res.json(demandData);
    }, { errorMessage: 'Failed to fetch demand', errorLogPrefix: 'Error fetching demand' }));

  // Create a new demand
  app.post('/api/demands', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const demandData = req.body;
      

      // Validate input using the corrected schema that already has optional fields
      const demandInputSchema = insertDemandSchema.omit({ submitterId: true });
      
      // Validate input
      const validatedData = demandInputSchema.parse(demandData);
      
      // console.log('✅ Demand validation passed:', validatedData);

      // Implement role-based residence assignment validation
      if (user.role === 'admin') {
        // Admin can assign to any building/residence - no validation needed
        if (!validatedData.buildingId) {
          return res.status(400).json({ message: 'Building is required' });
        }
      } else if (user.role === 'manager' || user.role === 'demo_manager') {
        // Manager can assign demands to all buildings in their accessible organizations
        if (!validatedData.buildingId) {
          return res.status(400).json({ message: 'Building is required' });
        }
        
        // Verify manager has access to the specified building's organization
        const buildingData = await db
          .select({ organizationId: buildings.organizationId })
          .from(buildings)
          .where(eq(buildings.id, validatedData.buildingId))
          .limit(1);
          
        if (buildingData.length === 0) {
          return res.status(404).json({ message: 'Building not found' });
        }
        
        const hasAccess = await canUserAccessOrganization(user.id, buildingData[0].organizationId);
        if (!hasAccess) {
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
          .where(
            and(
              eq(userResidences.userId, user.id),
              // Task #144: only currently-active residency links grant
              // a tenant the right to create demands on a residence.
              eq(userResidences.isActive, true)
            )
          );

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
      
      // console.log('✅ Final demand data before insertion:', {
      //   buildingId: validatedData.buildingId,
      //   residenceId: validatedData.residenceId,
      //   type: validatedData.type,
      //   description: validatedData.description
      // });

      // Handle file attachments if provided
      let fileInfo: { filePath?: string; fileName?: string; fileSize?: number } = {};
      
      if (demandData.attachments && Array.isArray(demandData.attachments) && demandData.attachments.length > 0) {
        const firstAttachment = demandData.attachments[0];
        
        // Check if attachment is an object with url and originalName (new format)
        // or just a string URL (old format for backward compatibility)
        if (typeof firstAttachment === 'object' && firstAttachment.url) {
          fileInfo = {
            filePath: firstAttachment.url,
            fileName: firstAttachment.originalName || firstAttachment.url.split('/').pop() || '',
            fileSize: firstAttachment.size || 0,
          };
        } else if (typeof firstAttachment === 'string') {
          // Old format: just a URL string
          const fileName = firstAttachment.split('/').pop() || '';
          
          // Get file size from filesystem if file exists
          let fileSize = 0;
          try {
            const fs = await import('fs');
            const path = await import('path');
            const fullPath = path.join(process.cwd(), firstAttachment.replace(/^\//, ''));
            if (fs.existsSync(fullPath)) {
              const stats = fs.statSync(fullPath);
              fileSize = stats.size;
            }
          } catch (error) {
            // If we can't get file size, just set it to 0
          }
          
          fileInfo = {
            filePath: firstAttachment,
            fileName: fileName,
            fileSize: fileSize,
          };
        }
      }

      const demandInsertData = {
        type: validatedData.type,
        description: validatedData.description,
        buildingId: validatedData.buildingId,
        residenceId: validatedData.residenceId,
        assignationBuildingId: validatedData.assignationBuildingId,
        assignationResidenceId: validatedData.assignationResidenceId,
        submitterId: user.id,
        status: (validatedData.status as 'submitted' | 'under_review' | 'approved' | 'rejected' | 'in_progress' | 'completed' | 'cancelled') || 'submitted',
        filePath: fileInfo.filePath,
        fileName: fileInfo.fileName,
        fileSize: fileInfo.fileSize,
      };

      // Verify object ownership before binding a client-supplied /objects/ path.
      // If the object already has an ACL set by a different user, reject the
      // request to prevent path-rebinding / ACL-hijacking attacks.
      if (fileInfo.filePath && fileInfo.filePath.startsWith('/objects/')) {
        try {
          const objectStorageService = new ObjectStorageService();
          const existingAcl = await objectStorageService.getExistingObjectAcl(fileInfo.filePath);
          if (existingAcl && existingAcl.owner && existingAcl.owner !== user.id) {
            return res.status(403).json({ message: 'Access denied: object belongs to another user' });
          }
        } catch (aclCheckError) {
          if (process.env.NODE_ENV === 'development') console.error('Failed to check ACL on demand file:', aclCheckError);
        }
      }

      const newDemand = await db.insert(demands).values([demandInsertData]).returning();

      // Set ACL on object storage file if it's an object storage path
      if (fileInfo.filePath && fileInfo.filePath.startsWith('/objects/')) {
        try {
          const objectStorageService = new ObjectStorageService();
          await objectStorageService.trySetObjectEntityAclPolicy(fileInfo.filePath, {
            visibility: 'private',
            owner: user.id,
          });
        } catch (aclError) {
          if (process.env.NODE_ENV === 'development') console.error('Failed to set ACL on demand file:', aclError);
        }
      }

      res.status(201).json(newDemand[0]);
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') console.error('Error creating demand:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid demand data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create demand' });
    }
  });

  // Update a demand
  app.put('/api/demands/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
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
      } else if (user.role === 'manager' || user.role === 'demo_manager') {
        // Managers can update demands from all their accessible organizations' buildings (status/review fields only)
        const buildingOrganization = await db
          .select({ organizationId: buildings.organizationId })
          .from(buildings)
          .where(eq(buildings.id, demand.buildingId))
          .limit(1);
          
        if (buildingOrganization.length > 0) {
          const hasAccess = await canUserAccessOrganization(user.id, buildingOrganization[0].organizationId);
          if (hasAccess) {
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
      if (user.role === 'admin' || user.role === 'manager' || user.role === 'demo_manager') {
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

      if (
        (user.role === 'admin' || user.role === 'manager' || user.role === 'demo_manager') &&
        demand.submitterId &&
        demand.submitterId !== user.id
      ) {
        try {
          demandNotificationService.notifyDemandEdited(id, user.id, demand.submitterId).catch(err => {
            if (process.env.NODE_ENV === 'development') console.error('Failed to send demand edit notification:', err);
          });
        } catch (notificationError) {
          if (process.env.NODE_ENV === 'development') console.error('Error initiating demand edit notification:', notificationError);
        }
      }

      res.json(updatedDemand[0]);
    }, { errorMessage: 'Failed to update demand', errorLogPrefix: 'Error updating demand' }));

  // Delete a demand
  app.delete('/api/demands/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
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
      } else if (user.role === 'manager' || user.role === 'demo_manager') {
        // Managers can delete demands from all their accessible organizations' buildings
        const buildingOrganization = await db
          .select({ organizationId: buildings.organizationId })
          .from(buildings)
          .where(eq(buildings.id, demand.buildingId))
          .limit(1);
          
        if (buildingOrganization.length > 0) {
          canDelete = await canUserAccessOrganization(user.id, buildingOrganization[0].organizationId);
        }
      } else if (demand.submitterId === user.id) {
        // Users can delete their own demands
        canDelete = true;
      }
      
      if (!canDelete) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Delete comments + demand atomically: a failure on the second
      // statement must not leave the demand row alive with no comments.
      await db.transaction(async (tx) => {
        await tx.delete(demandComments).where(eq(demandComments.demandId, id));
        await tx.delete(demands).where(eq(demands.id, id));
      });

      res.json({ message: 'Demand deleted successfully' });
    }, { errorMessage: 'Failed to delete demand', errorLogPrefix: 'Error deleting demand' }));

  // Get comments for a demand
  app.get('/api/demands/:id/comments', requireAuth, asyncHandler(async (req: any, res: any) => {
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
      } else if (user.role === 'manager' || user.role === 'demo_manager') {
        // Managers can view demands from all their accessible organizations' buildings
        const buildingOrganization = await db
          .select({ organizationId: buildings.organizationId })
          .from(buildings)
          .where(eq(buildings.id, demandData.buildingId))
          .limit(1);
          
        if (buildingOrganization.length > 0) {
          hasAccess = await canUserAccessOrganization(user.id, buildingOrganization[0].organizationId);
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
    }, { errorMessage: 'Failed to fetch demand comments', errorLogPrefix: 'Error fetching demand comments' }));

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
        // Admins can comment on all demands
        hasAccess = true;
      } else if (user.role === 'manager' || user.role === 'demo_manager') {
        // Managers can comment on demands from all their accessible organizations' buildings
        const buildingOrganization = await db
          .select({ organizationId: buildings.organizationId })
          .from(buildings)
          .where(eq(buildings.id, demandData.buildingId))
          .limit(1);
          
        if (buildingOrganization.length > 0) {
          hasAccess = await canUserAccessOrganization(user.id, buildingOrganization[0].organizationId);
        }
      } else {
        // Residents and tenants can only comment on their own demands
        hasAccess = demandData.submitterId === user.id;
      }
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const newComment = await db.insert(demandComments).values(validatedData).returning();

      if (demandData.submitterId) {
        try {
          demandNotificationService.notifyDemandCommented(
            id,
            user.id,
            user.role,
            demandData.submitterId,
            demandData.buildingId
          ).catch(err => {
            if (process.env.NODE_ENV === 'development') console.error('Failed to send demand comment notification:', err);
          });
        } catch (notificationError) {
          if (process.env.NODE_ENV === 'development') console.error('Error initiating demand comment notification:', notificationError);
        }
      }

      res.status(201).json(newComment[0]);
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') console.error('Error creating comment:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid comment data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create comment' });
    }
  });
}
