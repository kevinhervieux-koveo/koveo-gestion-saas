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
  app.get('/api/contacts/:entity/:entityId', requireAuth, async (req: any, res: any) => {
    try {
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
    } catch (error: any) {
      console.error('❌ Error fetching entity contacts:', error);
      res.status(500).json({ message: 'Failed to fetch contacts' });
    }
  });

  // Get contacts for a residence with access control
  app.get('/api/residences/:residenceId/contacts', requireAuth, async (req: any, res: any) => {
    try {
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
    } catch (error: any) {
      console.error('❌ Error fetching residence contacts:', error);
      res.status(500).json({ message: 'Failed to fetch residence contacts' });
    }
  });

  // Get contacts with filtering by entity and entityId
  app.get('/api/contacts', requireAuth, async (req: any, res: any) => {
    try {
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
    } catch (error: any) {
      console.error('❌ Error fetching contacts:', error);
      res.status(500).json({ message: 'Failed to fetch contacts' });
    }
  });

  // Create a new contact
  app.post('/api/contacts', requireAuth, async (req: any, res: any) => {
    try {
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
    } catch (error: any) {
      console.error('❌ Error creating contact:', error);
      res.status(500).json({ message: 'Failed to create contact' });
    }
  });

  // Update a contact
  app.patch('/api/contacts/:id', requireAuth, async (req: any, res: any) => {
    try {
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
    } catch (error: any) {
      console.error('❌ Error updating contact:', error);
      res.status(500).json({ message: 'Failed to update contact' });
    }
  });

  // Delete a contact
  app.delete('/api/contacts/:id', requireAuth, async (req: any, res: any) => {
    try {
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
    } catch (error: any) {
      console.error('❌ Error deleting contact:', error);
      res.status(500).json({ message: 'Failed to delete contact' });
    }
  });
}
