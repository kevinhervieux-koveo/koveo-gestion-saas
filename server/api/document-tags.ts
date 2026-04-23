import type { Express } from 'express';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth';
import { db } from '../db';
import { storage } from '../storage';
import {
  documentTags,
  documentTagAssignments,
  documents,
  insertDocumentTagSchema,
} from '../../shared/schemas/documents';
import { logError, logInfo } from '../utils/logger';

const tagInputSchema = insertDocumentTagSchema
  .pick({
    name: true,
    description: true,
    scope: true,
    importance: true,
    suggestedProfessionals: true,
  })
  .extend({
    description: z.string().optional().nullable(),
    suggestedProfessionals: z.array(z.string()).default([]),
  });

const tagUpdateSchema = tagInputSchema.partial();

/**
 * Get the organization IDs the user has access to.
 */
async function getUserOrgIds(userId: string): Promise<string[]> {
  const orgs = await storage.getUserOrganizations(userId);
  return orgs.map((o) => o.organizationId);
}

/**
 * Fetch tags assigned to a set of documents. Returns a map of documentId -> tag rows.
 */
export async function getTagsForDocuments(documentIds: string[]) {
  if (documentIds.length === 0) {
    return new Map<string, Array<typeof documentTags.$inferSelect>>();
  }
  const rows = await db
    .select({
      documentId: documentTagAssignments.documentId,
      tag: documentTags,
    })
    .from(documentTagAssignments)
    .innerJoin(documentTags, eq(documentTagAssignments.tagId, documentTags.id))
    .where(inArray(documentTagAssignments.documentId, documentIds));

  const map = new Map<string, Array<typeof documentTags.$inferSelect>>();
  for (const r of rows) {
    const arr = map.get(r.documentId) || [];
    arr.push(r.tag);
    map.set(r.documentId, arr);
  }
  return map;
}

export function registerDocumentTagRoutes(app: Express): void {
  logInfo('[DOC TAGS] Registering document tag routes');

  // List all tags available to the caller (system tags + tags from caller's organizations)
  app.get('/api/document-tags', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const orgIds = user.role === 'admin' ? undefined : await getUserOrgIds(user.id);

      const conditions =
        user.role === 'admin'
          ? undefined
          : or(
              eq(documentTags.isSystem, true),
              orgIds && orgIds.length > 0
                ? inArray(documentTags.organizationId, orgIds)
                : sql`false`,
            );

      const rows = conditions
        ? await db.select().from(documentTags).where(conditions)
        : await db.select().from(documentTags);

      // Sort: system first, then by name
      rows.sort((a, b) => {
        if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      res.json({ tags: rows });
    } catch (error: any) {
      logError('[DOC TAGS] Failed to list tags', error);
      res.status(500).json({ message: 'Failed to list document tags' });
    }
  });

  // Create a new custom tag for the caller's organization
  app.post(
    '/api/document-tags',
    requireAuth,
    requireRole(['admin', 'manager', 'demo_manager']),
    async (req: any, res) => {
      try {
        const user = req.user;
        const parsed = tagInputSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid tag', errors: parsed.error.errors });
        }

        const orgIds = await getUserOrgIds(user.id);
        let organizationId = req.body.organizationId as string | undefined;
        if (!organizationId) {
          if (orgIds.length === 0) {
            return res.status(400).json({ message: 'No organization for user' });
          }
          organizationId = orgIds[0];
        } else if (user.role !== 'admin' && !orgIds.includes(organizationId)) {
          return res.status(403).json({ message: 'Cannot create tag in this organization' });
        }

        const [created] = await db
          .insert(documentTags)
          .values({
            organizationId,
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            scope: parsed.data.scope,
            importance: parsed.data.importance,
            suggestedProfessionals: parsed.data.suggestedProfessionals,
            isSystem: false,
            source: organizationId,
          })
          .returning();
        res.status(201).json(created);
      } catch (error: any) {
        logError('[DOC TAGS] Failed to create tag', error);
        res.status(500).json({ message: 'Failed to create tag' });
      }
    },
  );

  // Update an existing custom tag
  app.patch(
    '/api/document-tags/:id',
    requireAuth,
    requireRole(['admin', 'manager', 'demo_manager']),
    async (req: any, res) => {
      try {
        const user = req.user;
        const { id } = req.params;
        const [tag] = await db.select().from(documentTags).where(eq(documentTags.id, id));
        if (!tag) {
          return res.status(404).json({ message: 'Tag not found' });
        }
        if (tag.isSystem) {
          return res.status(403).json({ message: 'System tags cannot be modified' });
        }
        if (user.role !== 'admin') {
          const orgIds = await getUserOrgIds(user.id);
          if (!tag.organizationId || !orgIds.includes(tag.organizationId)) {
            return res.status(403).json({ message: 'Access denied' });
          }
        }
        const parsed = tagUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid tag', errors: parsed.error.errors });
        }
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (parsed.data.name !== undefined) updates.name = parsed.data.name;
        if (parsed.data.description !== undefined) updates.description = parsed.data.description;
        if (parsed.data.scope !== undefined) updates.scope = parsed.data.scope;
        if (parsed.data.importance !== undefined) updates.importance = parsed.data.importance;
        if (parsed.data.suggestedProfessionals !== undefined)
          updates.suggestedProfessionals = parsed.data.suggestedProfessionals;

        const [updated] = await db
          .update(documentTags)
          .set(updates)
          .where(eq(documentTags.id, id))
          .returning();
        res.json(updated);
      } catch (error: any) {
        logError('[DOC TAGS] Failed to update tag', error);
        res.status(500).json({ message: 'Failed to update tag' });
      }
    },
  );

  // Delete a custom tag
  app.delete(
    '/api/document-tags/:id',
    requireAuth,
    requireRole(['admin', 'manager', 'demo_manager']),
    async (req: any, res) => {
      try {
        const user = req.user;
        const { id } = req.params;
        const [tag] = await db.select().from(documentTags).where(eq(documentTags.id, id));
        if (!tag) {
          return res.status(404).json({ message: 'Tag not found' });
        }
        if (tag.isSystem) {
          return res.status(403).json({ message: 'System tags cannot be deleted' });
        }
        if (user.role !== 'admin') {
          const orgIds = await getUserOrgIds(user.id);
          if (!tag.organizationId || !orgIds.includes(tag.organizationId)) {
            return res.status(403).json({ message: 'Access denied' });
          }
        }
        await db.delete(documentTags).where(eq(documentTags.id, id));
        res.json({ success: true });
      } catch (error: any) {
        logError('[DOC TAGS] Failed to delete tag', error);
        res.status(500).json({ message: 'Failed to delete tag' });
      }
    },
  );

  // Assign a tag to a document
  app.post('/api/documents/:id/tags', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const documentId = req.params.id;
      const { tagId } = req.body as { tagId?: string };
      if (!tagId) return res.status(400).json({ message: 'tagId is required' });

      // Verify document access
      const orgIds = await getUserOrgIds(user.id);
      const doc = await storage.getDocumentWithScope(documentId, user.id, user.role, orgIds);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }

      const [tag] = await db.select().from(documentTags).where(eq(documentTags.id, tagId));
      if (!tag) {
        return res.status(404).json({ message: 'Tag not found' });
      }
      if (!tag.isSystem && user.role !== 'admin' && (!tag.organizationId || !orgIds.includes(tag.organizationId))) {
        return res.status(403).json({ message: 'Access denied to tag' });
      }

      try {
        const [assignment] = await db
          .insert(documentTagAssignments)
          .values({ documentId, tagId })
          .returning();
        res.status(201).json(assignment);
      } catch (e: any) {
        // Likely unique constraint -> already assigned, treat as success
        const [existing] = await db
          .select()
          .from(documentTagAssignments)
          .where(
            and(
              eq(documentTagAssignments.documentId, documentId),
              eq(documentTagAssignments.tagId, tagId),
            ),
          );
        res.status(200).json(existing);
      }
    } catch (error: any) {
      logError('[DOC TAGS] Failed to assign tag', error);
      res.status(500).json({ message: 'Failed to assign tag' });
    }
  });

  // Remove a tag from a document
  app.delete('/api/documents/:id/tags/:tagId', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const { id: documentId, tagId } = req.params;
      const orgIds = await getUserOrgIds(user.id);
      const doc = await storage.getDocumentWithScope(documentId, user.id, user.role, orgIds);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }
      await db
        .delete(documentTagAssignments)
        .where(
          and(
            eq(documentTagAssignments.documentId, documentId),
            eq(documentTagAssignments.tagId, tagId),
          ),
        );
      res.json({ success: true });
    } catch (error: any) {
      logError('[DOC TAGS] Failed to unassign tag', error);
      res.status(500).json({ message: 'Failed to unassign tag' });
    }
  });

  // Bulk get tags for a document
  app.get('/api/documents/:id/tags', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const documentId = req.params.id;
      const orgIds = await getUserOrgIds(user.id);
      const doc = await storage.getDocumentWithScope(documentId, user.id, user.role, orgIds);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found or access denied' });
      }
      const map = await getTagsForDocuments([documentId]);
      res.json({ tags: map.get(documentId) || [] });
    } catch (error: any) {
      logError('[DOC TAGS] Failed to fetch document tags', error);
      res.status(500).json({ message: 'Failed to fetch document tags' });
    }
  });
}
