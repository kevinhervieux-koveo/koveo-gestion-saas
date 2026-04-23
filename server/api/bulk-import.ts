/**
 * Admin Bulk Document Import REST API (Task #451).
 *
 * Every endpoint here is gated to `admin`. Files are streamed onto disk
 * inside a per-session staging directory (under
 * `process.cwd()/.staging/bulk-import/<sessionId>/`) so the user can
 * leave the page and resume — nothing is committed to the real
 * `documents` table until the final "Linking" step accepts the item.
 */
import type { Express, Request, Response } from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { requireAuth, requireRole } from '../auth';

type AuthenticatedRequest = Request & { user?: { id: string; role: string } };
import { db } from '../db';
import * as schema from '@shared/schema';
import { storage } from '../storage';
import { bulkImportAnalyzer } from '../services/bulk-import-analyzer';
import { documentService } from '../services/document-service';
import { logError, logInfo } from '../utils/logger';

const STAGING_ROOT = path.join(process.cwd(), '.staging', 'bulk-import');

function stagingDirFor(sessionId: string): string {
  const dir = path.join(STAGING_ROOT, sessionId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeRmSession(sessionId: string): void {
  const dir = path.join(STAGING_ROOT, sessionId);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    logError('[bulk-import] failed to remove staging dir', err as Error);
  }
}

function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per file
});

const createSessionSchema = z.object({
  buildingId: z.string().min(1),
});

const updateStepSchema = z.object({
  currentStep: z.enum([
    'upload',
    'screening',
    'sorting',
    'branching',
    'identification',
    'linking',
    'complete',
  ]),
  progress: z.record(z.unknown()).optional(),
});

const updateItemSchema = z.object({
  status: z
    .enum([
      'pending',
      'screening',
      'screened',
      'sorted',
      'branched',
      'identified',
      'linked',
      'committed',
      'rejected',
      'duplicate',
    ])
    .optional(),
  screening: z.record(z.unknown()).optional(),
  sortingDecision: z.record(z.unknown()).optional(),
  branchDecision: z.record(z.unknown()).optional(),
  identification: z.record(z.unknown()).optional(),
  linkDecisions: z.record(z.unknown()).optional(),
  finalFileName: z.string().optional(),
});

async function loadSession(sessionId: string) {
  const [row] = await db
    .select()
    .from(schema.bulkImportSessions)
    .where(eq(schema.bulkImportSessions.id, sessionId));
  return row;
}

export function registerBulkImportRoutes(app: Express): void {
  /** Create a new session (or return the existing active one) for a building. */
  app.post(
    '/api/admin/bulk-import/sessions',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { buildingId } = createSessionSchema.parse(req.body);
        const building = await storage.getBuilding(buildingId);
        if (!building) return res.status(404).json({ error: 'Building not found' });

        const [existing] = await db
          .select()
          .from(schema.bulkImportSessions)
          .where(
            and(
              eq(schema.bulkImportSessions.buildingId, buildingId),
              eq(schema.bulkImportSessions.adminUserId, req.user!.id),
              inArray(schema.bulkImportSessions.status, ['active', 'paused']),
            ),
          )
          .limit(1);
        if (existing) return res.json(existing);

        const [created] = await db
          .insert(schema.bulkImportSessions)
          .values({
            buildingId,
            organizationId: building.organizationId,
            adminUserId: req.user!.id,
            currentStep: 'upload',
            status: 'active',
            progress: {},
          })
          .returning();
        stagingDirFor(created.id);
        return res.status(201).json(created);
      } catch (err) {
        logError('[bulk-import] create session failed', err as Error);
        if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Failed to create session' });
      }
    },
  );

  /** List sessions visible to the caller (admin can see them all). */
  app.get(
    '/api/admin/bulk-import/sessions',
    requireAuth,
    requireRole(['admin']),
    async (_req: AuthenticatedRequest, res: Response) => {
      const rows = await db.select().from(schema.bulkImportSessions);
      return res.json(rows);
    },
  );

  /** Fetch a single session WITH its items (resume payload). */
  app.get(
    '/api/admin/bulk-import/sessions/:id',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      const session = await loadSession(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      const items = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.sessionId, session.id));
      return res.json({ session, items });
    },
  );

  /** Update step / progress / status (autosave for resume-on-reload). */
  app.patch(
    '/api/admin/bulk-import/sessions/:id',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const data = updateStepSchema.partial().extend({
          status: z.enum(['active', 'paused', 'completed', 'cleared']).optional(),
        }).parse(req.body);
        const [updated] = await db
          .update(schema.bulkImportSessions)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(schema.bulkImportSessions.id, req.params.id))
          .returning();
        if (!updated) return res.status(404).json({ error: 'Session not found' });
        return res.json(updated);
      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
        logError('[bulk-import] update session failed', err as Error);
        return res.status(500).json({ error: 'Failed to update session' });
      }
    },
  );

  /** Clear all — wipe the session, its items, and staging files. */
  app.delete(
    '/api/admin/bulk-import/sessions/:id',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      const session = await loadSession(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      await db
        .update(schema.bulkImportSessions)
        .set({ status: 'cleared', updatedAt: new Date() })
        .where(eq(schema.bulkImportSessions.id, session.id));
      await db
        .delete(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.sessionId, session.id));
      safeRmSession(session.id);
      logInfo('[bulk-import] session cleared', { metadata: { sessionId: session.id } });
      return res.json({ ok: true });
    },
  );

  /** Upload a folder/zip's worth of files into a session. */
  app.post(
    '/api/admin/bulk-import/sessions/:id/items',
    requireAuth,
    requireRole(['admin']),
    upload.array('files', 200),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const session = await loadSession(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

        const dir = stagingDirFor(session.id);
        const created: schema.BulkImportItem[] = [];

        for (const file of files) {
          const hash = sha256(file.buffer);
          const stagedPath = path.join(dir, `${hash}_${file.originalname}`);
          fs.writeFileSync(stagedPath, file.buffer);

          // Dedup against this organization's fingerprint cache.
          const [dupe] = await db
            .select()
            .from(schema.clientDocumentFingerprints)
            .where(
              and(
                eq(schema.clientDocumentFingerprints.organizationId, session.organizationId),
                eq(schema.clientDocumentFingerprints.contentHash, hash),
              ),
            )
            .limit(1);

          const [row] = await db
            .insert(schema.bulkImportItems)
            .values({
              sessionId: session.id,
              originalPath: file.originalname,
              originalName: file.originalname,
              stagedPath,
              contentHash: hash,
              mimeType: file.mimetype,
              fileSize: file.size,
              status: dupe ? 'duplicate' : 'pending',
            })
            .returning();
          created.push(row);
        }
        return res.status(201).json(created);
      } catch (err) {
        logError('[bulk-import] upload failed', err as Error);
        return res.status(500).json({ error: 'Failed to upload files' });
      }
    },
  );

  /** Patch a single item's per-step decisions. */
  app.patch(
    '/api/admin/bulk-import/items/:id',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const data = updateItemSchema.parse(req.body);
        const [updated] = await db
          .update(schema.bulkImportItems)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(schema.bulkImportItems.id, req.params.id))
          .returning();
        if (!updated) return res.status(404).json({ error: 'Item not found' });
        return res.json(updated);
      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
        return res.status(500).json({ error: 'Failed to update item' });
      }
    },
  );

  /** Run AI screening for one item. */
  app.post(
    '/api/admin/bulk-import/items/:id/screen',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      const [item] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, req.params.id));
      if (!item) return res.status(404).json({ error: 'Item not found' });
      const result = await bulkImportAnalyzer.screen({
        originalName: item.originalName,
        mimeType: item.mimeType,
        fileSize: item.fileSize,
      });
      const [updated] = await db
        .update(schema.bulkImportItems)
        .set({
          screening: result as unknown as Record<string, unknown>,
          status: 'screened',
          updatedAt: new Date(),
        })
        .where(eq(schema.bulkImportItems.id, item.id))
        .returning();
      return res.json(updated);
    },
  );

  /** Run AI sort/merge/split for one item. */
  app.post(
    '/api/admin/bulk-import/items/:id/sort',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      const [item] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, req.params.id));
      if (!item) return res.status(404).json({ error: 'Item not found' });
      const siblings = await db
        .select({
          id: schema.bulkImportItems.id,
          name: schema.bulkImportItems.originalName,
        })
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.sessionId, item.sessionId));
      const result = await bulkImportAnalyzer.suggestMergeOrSplit({
        originalName: item.originalName,
        siblingNames: siblings.filter((s) => s.id !== item.id).map((s) => s.name),
      });
      const [updated] = await db
        .update(schema.bulkImportItems)
        .set({
          sortingDecision: result as unknown as Record<string, unknown>,
          status: 'sorted',
          updatedAt: new Date(),
        })
        .where(eq(schema.bulkImportItems.id, item.id))
        .returning();
      return res.json(updated);
    },
  );

  /** Run AI branch suggestion. */
  app.post(
    '/api/admin/bulk-import/items/:id/branch',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      const [item] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, req.params.id));
      if (!item) return res.status(404).json({ error: 'Item not found' });
      const description =
        (item.screening as { description?: string } | null)?.description ?? '';
      const result = await bulkImportAnalyzer.suggestBranch({
        originalName: item.originalName,
        description,
      });
      const [updated] = await db
        .update(schema.bulkImportItems)
        .set({
          branchDecision: result as unknown as Record<string, unknown>,
          status: 'branched',
          updatedAt: new Date(),
        })
        .where(eq(schema.bulkImportItems.id, item.id))
        .returning();
      return res.json(updated);
    },
  );

  /** Run AI identification (name/tags/metadata). */
  app.post(
    '/api/admin/bulk-import/items/:id/identify',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      const [item] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, req.params.id));
      if (!item) return res.status(404).json({ error: 'Item not found' });
      const branch =
        (item.branchDecision as { branch?: string } | null)?.branch ?? 'building_documents';
      const description =
        (item.screening as { description?: string } | null)?.description ?? '';
      const result = await bulkImportAnalyzer.identify({
        originalName: item.originalName,
        description,
        branch,
      });
      const [updated] = await db
        .update(schema.bulkImportItems)
        .set({
          identification: result as unknown as Record<string, unknown>,
          status: 'identified',
          updatedAt: new Date(),
        })
        .where(eq(schema.bulkImportItems.id, item.id))
        .returning();
      return res.json(updated);
    },
  );

  /** Run AI link suggestions for one item. */
  app.post(
    '/api/admin/bulk-import/items/:id/link',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      const [item] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, req.params.id));
      if (!item) return res.status(404).json({ error: 'Item not found' });
      const candidates = await db
        .select({
          id: schema.bulkImportItems.id,
          name: schema.bulkImportItems.originalName,
        })
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.sessionId, item.sessionId));
      const result = await bulkImportAnalyzer.suggestLinks({
        originalName: item.originalName,
        candidates: candidates.filter((c) => c.id !== item.id),
      });
      const [updated] = await db
        .update(schema.bulkImportItems)
        .set({
          linkDecisions: result as unknown as Record<string, unknown>,
          status: 'linked',
          updatedAt: new Date(),
        })
        .where(eq(schema.bulkImportItems.id, item.id))
        .returning();
      return res.json(updated);
    },
  );

  /**
   * Commit one staged item to the real `documents` table. The actual
   * file bytes are uploaded via the existing object-storage flow on the
   * client (the bulk-import staging dir is just for AI analysis); here
   * we register the document row, the dedup fingerprint, and link the
   * staged item back to the new document id.
   */
  app.post(
    '/api/admin/bulk-import/items/:id/commit',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const [item] = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.id, req.params.id));
        if (!item) return res.status(404).json({ error: 'Item not found' });
        const session = await loadSession(item.sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const ident =
          (item.identification as {
            name?: string;
            description?: string;
            tags?: string[];
            effectiveDate?: string;
          } | null) ?? {};
        const branch =
          (item.branchDecision as { branch?: string } | null)?.branch ??
          'building_documents';

        const filePath = documentService.normalizePath(
          documentService.buildHierarchicalPath(
            { type: 'documents', buildingId: session.buildingId },
            item.originalName,
          ),
        );

        const [doc] = await db
          .insert(schema.documents)
          .values({
            name: ident.name ?? item.originalName,
            description: ident.description ?? null,
            documentType: branch,
            filePath,
            fileName: item.originalName,
            originalFileName: item.originalName,
            fileSize: item.fileSize ?? null,
            mimeType: item.mimeType ?? null,
            buildingId: session.buildingId,
            uploadedById: req.user!.id,
            effectiveDate: ident.effectiveDate ? new Date(ident.effectiveDate) : null,
          })
          .returning();

        // Idempotent fingerprint upsert.
        await db
          .insert(schema.clientDocumentFingerprints)
          .values({
            organizationId: session.organizationId,
            buildingId: session.buildingId,
            contentHash: item.contentHash,
            finalDocumentId: doc.id,
          })
          .onConflictDoNothing({
            target: [
              schema.clientDocumentFingerprints.organizationId,
              schema.clientDocumentFingerprints.contentHash,
            ],
          });

        const [updated] = await db
          .update(schema.bulkImportItems)
          .set({
            finalDocumentId: doc.id,
            status: 'committed',
            updatedAt: new Date(),
          })
          .where(eq(schema.bulkImportItems.id, item.id))
          .returning();
        return res.json({ item: updated, document: doc });
      } catch (err) {
        logError('[bulk-import] commit failed', err as Error);
        return res.status(500).json({ error: 'Failed to commit item' });
      }
    },
  );
}
