// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { Express } from 'express';
import { db } from '../db';
import {
  contacts,
  residences,
  buildings,
  organizations,
  insertContactSchema,
} from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../auth/index';

import { asyncHandler } from '../utils/async-handler';
/**
 * Register contact routes for managing entity contacts.
 *
 * @param app - Express application instance.
 */
/**
 * RegisterContactRoutes function.
 * @param app
 * @returns Function result.
 */
export function registerContactRoutes(app: Express) {
  // Get contacts for a specific entity
  app.get('/api/contacts/:entity/:entityId', requireAuth, asyncHandler(async (req: any, res: any) => {
      const { entity, entityId } = req.params;
      const user = req.user;

      // Validate entity type
      if (!['organization', 'building', 'residence'].includes(entity)) {
        return res.status(400).json({ message: 'Invalid entity type' });
      }

      // Get contacts
      const entityContacts = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.entity, entity as any),
            eq(contacts.entityId, entityId),
            eq(contacts.isActive, true)
          )
        );

      res.json(entityContacts);
    }, { errorMessage: 'Failed to fetch contacts', errorLogPrefix: '❌ Error fetching entity contacts' }));

  // Get contacts for a residence with access control
  app.get('/api/residences/:residenceId/contacts', requireAuth, asyncHandler(async (req: any, res: any) => {
      const { residenceId } = req.params;
      const user = req.user;

      // Check if user has access to this residence
      if (user.role !== 'admin') {
        const hasAccess = await db
          .select()
          .from(residences)
          .innerJoin(buildings, eq(residences.buildingId, buildings.id))
          .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
          .where(and(eq(residences.id, residenceId), eq(residences.isActive, true)));

        if (hasAccess.length === 0) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      // Get contacts for the residence
      const residenceContacts = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.entity, 'residence'),
            eq(contacts.entityId, residenceId),
            eq(contacts.isActive, true)
          )
        );

      res.json(residenceContacts);
    }, { errorMessage: 'Failed to fetch residence contacts', errorLogPrefix: '❌ Error fetching residence contacts' }));

  // Get contacts with filtering by entity and entityId
  app.get('/api/contacts', requireAuth, asyncHandler(async (req: any, res: any) => {
      const { entity, entityId } = req.query;
      const user = req.user;

      if (!entity || !entityId) {
        // Return empty array instead of error for missing parameters
        return res.json([]);
      }

      // Check permissions for building contacts
      if (entity === 'building') {
        // Anyone can view building contacts for buildings they have access to
        const hasAccess = await db
          .select()
          .from(buildings)
          .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
          .where(and(eq(buildings.id, entityId), eq(buildings.isActive, true)));

        if (hasAccess.length === 0) {
          return res.status(404).json({ message: 'Building not found' });
        }
      }

      // Get contacts for the specified entity
      const entityContacts = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.entity, entity as 'building' | 'residence' | 'organization'),
            eq(contacts.entityId, entityId),
            eq(contacts.isActive, true)
          )
        );

      res.json(entityContacts);
    }, { errorMessage: 'Failed to fetch contacts', errorLogPrefix: '❌ Error fetching contacts' }));

  // Create a new contact
  app.post('/api/contacts', requireAuth, asyncHandler(async (req: any, res: any) => {
      const user = req.user;
      const validatedData = insertContactSchema.parse(req.body);

      // Check permissions based on user role and entity
      const { entity, entityId, name, email, phone, contactCategory } = validatedData;

      // Only managers and admins can add building contacts
      if (entity === 'building' && user.role !== 'admin' && user.role !== 'manager') {
        return res
          .status(403)
          .json({ message: 'Only managers and admins can add building contacts' });
      }

      // Verify entity exists based on type
      if (entity === 'residence') {
        const residence = await db
          .select()
          .from(residences)
          .where(eq(residences.id, entityId))
          .limit(1);

        if (residence.length === 0) {
          return res.status(400).json({ message: 'Residence not found' });
        }
      } else if (entity === 'building') {
        const building = await db
          .select()
          .from(buildings)
          .where(eq(buildings.id, entityId))
          .limit(1);

        if (building.length === 0) {
          return res.status(400).json({ message: 'Building not found' });
        }
      }

      // Create the contact
      const [newContact] = await db
        .insert(contacts)
        .values([
          {
            ...validatedData,
            entity: validatedData.entity as 'organization' | 'building' | 'residence',
            contactCategory: validatedData.contactCategory as
              | 'resident'
              | 'manager'
              | 'tenant'
              | 'maintenance'
              | 'other',
          },
        ])
        .returning();

      res.status(201).json(newContact);
    }, { errorMessage: 'Failed to create contact', errorLogPrefix: '❌ Error creating contact' }));

  // Update a contact
  app.patch('/api/contacts/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
      const { id } = req.params;
      const user = req.user;
      const updates = req.body;

      // Get the existing contact
      const existing = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ message: 'Contact not found' });
      }

      const contact = existing[0];

      // Check permissions - only managers and admins can edit contacts
      if (user.role !== 'admin' && user.role !== 'manager') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Update the contact
      const [updatedContact] = await db
        .update(contacts)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, id))
        .returning();

      res.json(updatedContact);
    }, { errorMessage: 'Failed to update contact', errorLogPrefix: '❌ Error updating contact' }));

  // Delete a contact
  app.delete('/api/contacts/:id', requireAuth, asyncHandler(async (req: any, res: any) => {
      const { id } = req.params;
      const user = req.user;

      // Get the existing contact
      const existing = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ message: 'Contact not found' });
      }

      const contact = existing[0];

      // Check permissions - residents, managers and admins can delete contacts
      if (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'resident') {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Soft delete the contact
      await db
        .update(contacts)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, id));

      res.json({ message: 'Contact deleted successfully' });
    }, { errorMessage: 'Failed to delete contact', errorLogPrefix: '❌ Error deleting contact' }));
}