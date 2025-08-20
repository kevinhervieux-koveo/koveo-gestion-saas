import { Express } from 'express';
import { db } from '../db.js';
import { contacts, residences, buildings, organizations } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../auth/index.js';
import { insertContactSchema } from '../../shared/schemas/property.js';

/**
 * Register contact routes for managing entity contacts.
 * 
 * @param app - Express application instance
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
        .where(and(
          eq(contacts.entity, entity as any),
          eq(contacts.entityId, entityId),
          eq(contacts.isActive, true)
        ));

      res.json(entityContacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
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
          .where(and(
            eq(residences.id, residenceId),
            eq(residences.isActive, true)
          ));

        if (hasAccess.length === 0) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      // Get contacts for the residence
      const residenceContacts = await db
        .select()
        .from(contacts)
        .where(and(
          eq(contacts.entity, 'residence'),
          eq(contacts.entityId, residenceId),
          eq(contacts.isActive, true)
        ));

      res.json(residenceContacts);
    } catch (error) {
      console.error('Error fetching residence contacts:', error);
      res.status(500).json({ message: 'Failed to fetch residence contacts' });
    }
  });

  // Create a new contact
  app.post('/api/contacts', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const validatedData = insertContactSchema.parse(req.body);

      // Check permissions based on user role and entity
      const { entity, entityId, name, email, phone, contactCategory } = validatedData;

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
      }

      // Create the contact
      const [newContact] = await db
        .insert(contacts)
        .values([{
          ...validatedData,
          contactCategory: validatedData.contactCategory as 'resident' | 'manager' | 'tenant' | 'maintenance' | 'other'
        }])
        .returning();

      res.status(201).json(newContact);
    } catch (error) {
      console.error('Error creating contact:', error);
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
      const existing = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, id))
        .limit(1);

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
    } catch (error) {
      console.error('Error updating contact:', error);
      res.status(500).json({ message: 'Failed to update contact' });
    }
  });

  // Delete a contact
  app.delete('/api/contacts/:id', requireAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const user = req.user;

      // Get the existing contact
      const existing = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, id))
        .limit(1);

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
    } catch (error) {
      console.error('Error deleting contact:', error);
      res.status(500).json({ message: 'Failed to delete contact' });
    }
  });
}