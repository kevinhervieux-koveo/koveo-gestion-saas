import type { Express } from 'express';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth';
import { db } from '../db';
import { storage } from '../storage';
import {
  documentLinkFamilies,
  insertDocumentLinkFamilySchema,
} from '../../shared/schemas/documents';
import { refuseIfKoveoSystemLinkFamily } from '../mcp/system-entity-guards';
import { logError, logInfo } from '../utils/logger';

const familyInputSchema = z.object({
  name: z.string().min(1, 'Family name is required').max(150),
  description: z.string().optional().nullable(),
});

const familyCreateSchema = familyInputSchema.extend({
  isSystem: z.boolean().optional().default(false),
});

const familyUpdateSchema = familyInputSchema.partial();

async function getUserOrgIds(userId: string): Promise<string[]> {
  const orgs = await storage.getUserOrganizations(userId);
  return orgs.map((o) => o.organizationId);
}

export function registerDocumentLinkFamilyRoutes(app: Express): void {
  logInfo('[DOC LINK FAMILIES] Registering document link family routes');

  app.get('/api/document-link-families', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const orgIds = user.role === 'admin' ? undefined : await getUserOrgIds(user.id);

      const conditions =
        user.role === 'admin'
          ? undefined
          : or(
              eq(documentLinkFamilies.isSystem, true),
              orgIds && orgIds.length > 0
                ? inArray(documentLinkFamilies.organizationId, orgIds)
                : sql`false`,
            );

      const rows = conditions
        ? await db.select().from(documentLinkFamilies).where(conditions)
        : await db.select().from(documentLinkFamilies);

      rows.sort((a, b) => {
        if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      res.json({ families: rows });
    } catch (error: any) {
      logError('[DOC LINK FAMILIES] Failed to list families', error);
      res.status(500).json({ message: 'Failed to list document link families' });
    }
  });

  app.post(
    '/api/document-link-families',
    requireAuth,
    requireRole(['admin', 'manager', 'demo_manager']),
    async (req: any, res) => {
      try {
        const user = req.user;
        const parsed = familyCreateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid family', errors: parsed.error.errors });
        }

        const wantsSystem = parsed.data.isSystem === true;

        if (wantsSystem && user.role !== 'super_admin') {
          return res.status(403).json({ message: 'Only super admins can create Koveo system families' });
        }

        if (wantsSystem) {
          const [created] = await db
            .insert(documentLinkFamilies)
            .values({
              organizationId: null,
              name: parsed.data.name,
              description: parsed.data.description ?? null,
              isSystem: true,
              source: 'koveo',
            })
            .returning();
          return res.status(201).json(created);
        }

        const orgIds = await getUserOrgIds(user.id);
        let organizationId = req.body.organizationId as string | undefined;
        if (!organizationId) {
          if (orgIds.length === 0) {
            return res.status(400).json({ message: 'No organization for user' });
          }
          organizationId = orgIds[0];
        } else if (user.role !== 'admin' && !orgIds.includes(organizationId)) {
          return res.status(403).json({ message: 'Cannot create family in this organization' });
        }

        const [created] = await db
          .insert(documentLinkFamilies)
          .values({
            organizationId,
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            isSystem: false,
            source: organizationId,
          })
          .returning();
        res.status(201).json(created);
      } catch (error: any) {
        logError('[DOC LINK FAMILIES] Failed to create family', error);
        res.status(500).json({ message: 'Failed to create family' });
      }
    },
  );

  app.patch(
    '/api/document-link-families/:id',
    requireAuth,
    requireRole(['admin', 'manager', 'demo_manager']),
    async (req: any, res) => {
      try {
        const user = req.user;
        const { id } = req.params;
        const [family] = await db
          .select()
          .from(documentLinkFamilies)
          .where(eq(documentLinkFamilies.id, id));
        if (!family) {
          return res.status(404).json({ message: 'Family not found' });
        }
        if (family.isSystem && user.role !== 'super_admin') {
          return res.status(403).json({ message: 'Only super admins can modify Koveo system families' });
        }
        if (!family.isSystem && user.role !== 'admin') {
          const orgIds = await getUserOrgIds(user.id);
          if (!family.organizationId || !orgIds.includes(family.organizationId)) {
            return res.status(403).json({ message: 'Access denied' });
          }
        }
        const parsed = familyUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid family', errors: parsed.error.errors });
        }
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (parsed.data.name !== undefined) updates.name = parsed.data.name;
        if (parsed.data.description !== undefined) updates.description = parsed.data.description;

        const [updated] = await db
          .update(documentLinkFamilies)
          .set(updates)
          .where(eq(documentLinkFamilies.id, id))
          .returning();
        res.json(updated);
      } catch (error: any) {
        logError('[DOC LINK FAMILIES] Failed to update family', error);
        res.status(500).json({ message: 'Failed to update family' });
      }
    },
  );

  app.delete(
    '/api/document-link-families/:id',
    requireAuth,
    requireRole(['admin', 'manager', 'demo_manager']),
    async (req: any, res) => {
      try {
        const user = req.user;
        const { id } = req.params;
        const [family] = await db
          .select()
          .from(documentLinkFamilies)
          .where(eq(documentLinkFamilies.id, id));
        if (!family) {
          return res.status(404).json({ message: 'Family not found' });
        }
        const systemRefusal = refuseIfKoveoSystemLinkFamily(family);
        if (systemRefusal) {
          return res.status(403).json({ message: systemRefusal.content[0].text });
        }
        if (!family.isSystem && user.role !== 'admin') {
          const orgIds = await getUserOrgIds(user.id);
          if (!family.organizationId || !orgIds.includes(family.organizationId)) {
            return res.status(403).json({ message: 'Access denied' });
          }
        }
        await db.delete(documentLinkFamilies).where(eq(documentLinkFamilies.id, id));
        res.json({ success: true });
      } catch (error: any) {
        logError('[DOC LINK FAMILIES] Failed to delete family', error);
        res.status(500).json({ message: 'Failed to delete family' });
      }
    },
  );
}
