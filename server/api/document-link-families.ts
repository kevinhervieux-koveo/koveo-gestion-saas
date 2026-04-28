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
import {
  refuseIfKoveoSystemLinkFamily,
  refuseIfKoveoSystemLinkFamilyUpdate,
} from '../mcp/system-entity-guards';
import { logError, logInfo } from '../utils/logger';
import { buildCanonicalResult, normalizeFamilyName } from '../services/canonical-family-resolver';

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

/**
 * Check whether `proposedName` (after normalisation) collides with an existing
 * family visible to `organizationId`. Returns the first colliding family (for
 * the error message) or null when the name is free.
 *
 * @param excludeId  When updating an existing family, exclude its own row so
 *                   renaming to the same name (different case/whitespace) is
 *                   accepted.
 */
async function findNameCollision(
  proposedName: string,
  organizationId: string | null,
  excludeId?: string,
): Promise<{ id: string; name: string; isSystem: boolean } | null> {
  const norm = normalizeFamilyName(proposedName);

  const visibleFamilies = await db
    .select({ id: documentLinkFamilies.id, name: documentLinkFamilies.name, isSystem: documentLinkFamilies.isSystem })
    .from(documentLinkFamilies)
    .where(
      or(
        isNull(documentLinkFamilies.organizationId),
        organizationId
          ? eq(documentLinkFamilies.organizationId, organizationId)
          : sql`false`,
      ),
    );

  for (const f of visibleFamilies) {
    if (excludeId && f.id === excludeId) continue;
    if (normalizeFamilyName(f.name) === norm) return f;
  }
  return null;
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

      // Strip non-canonical duplicates so callers always receive a deduplicated
      // family list even if the backfill hasn't completed yet.
      const { duplicateToCanonical } = buildCanonicalResult(rows);
      const canonical = rows.filter((r) => !duplicateToCanonical.has(r.id));

      canonical.sort((a, b) => {
        if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      res.json({ families: canonical });
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
          // Block system-family creation if a family with the same normalised name already exists.
          const systemCollision = await findNameCollision(parsed.data.name, null);
          if (systemCollision) {
            return res.status(409).json({
              message: `A family named "${systemCollision.name}" already exists${systemCollision.isSystem ? ' as a Koveo system family' : ''}. Use the existing family instead of creating a duplicate.`,
              existingFamilyId: systemCollision.id,
              existingFamilyName: systemCollision.name,
            });
          }
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
        } else if (user.role !== 'admin' && user.role !== 'super_admin' && !orgIds.includes(organizationId)) {
          return res.status(403).json({ message: 'Cannot create family in this organization' });
        }

        // Block org-scoped creation if a family with the same normalised name is already visible to this org.
        const orgCollision = await findNameCollision(parsed.data.name, organizationId);
        if (orgCollision) {
          return res.status(409).json({
            message: `A family named "${orgCollision.name}" is already visible to this organization${orgCollision.isSystem ? ' as a Koveo system family' : ''}. Use the existing family instead of creating a duplicate.`,
            existingFamilyId: orgCollision.id,
            existingFamilyName: orgCollision.name,
          });
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
        const systemRefusal = refuseIfKoveoSystemLinkFamilyUpdate(family);
        if (systemRefusal) {
          return res.status(403).json({ message: systemRefusal.content[0].text });
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

        // Block rename if the new name collides with another family visible to this org.
        if (parsed.data.name !== undefined) {
          const orgIdForCollision = family.organizationId;
          const collision = await findNameCollision(parsed.data.name, orgIdForCollision, id);
          if (collision) {
            return res.status(409).json({
              message: `A family named "${collision.name}" is already visible to this organization${collision.isSystem ? ' as a Koveo system family' : ''}. Use the existing family instead of creating a duplicate.`,
              existingFamilyId: collision.id,
              existingFamilyName: collision.name,
            });
          }
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
        if (user.role !== 'super_admin') {
          const systemRefusal = refuseIfKoveoSystemLinkFamily(family);
          if (systemRefusal) {
            return res.status(403).json({ message: systemRefusal.content[0].text });
          }
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
