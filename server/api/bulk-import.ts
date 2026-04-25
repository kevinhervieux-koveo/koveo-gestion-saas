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

/**
 * Sessions that currently have a fire-and-forget `screen-all` loop
 * running on this process. Prevents the wizard's auto-trigger from
 * stacking up duplicate background passes when polling refreshes the
 * page (Task #575). Also doubles as the cancellation signal for
 * Task #593: the DELETE handler removes the session id from the set,
 * which the loop checks between iterations and bails on so a clear
 * stops the work immediately. Cleared inside the background job's
 * `finally`. Exported so integration tests can assert prompt cleanup.
 */
export const screenAllInProgress = new Set<string>();

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

/**
 * Per-step "run-all" support (Task #592).
 *
 * Each AI step has an idempotent server-side loop that walks every
 * eligible item in the session and runs the analyzer against it. The
 * UI auto-triggers this when an admin lands on Sorting / Branching /
 * Identification / Linking, the same way Screening already does, so
 * there is no per-file button to click.
 *
 * State lives in two places:
 *   - `inFlightRunAll` (in-process Set) prevents two parallel loops
 *     for the same (session, step) inside one Node process.
 *   - `session.progress.runAll[step]` is the durable progress payload
 *     the wizard polls — `{ total, processed, failed, startedAt,
 *     finishedAt }` — so refreshing the page (or hopping to another
 *     admin tab) shows the same "X of Y processed…" line.
 */
type AutoStep = 'screening' | 'sorting' | 'branching' | 'identification' | 'linking';

const AUTO_STEPS: readonly AutoStep[] = [
  'screening',
  'sorting',
  'branching',
  'identification',
  'linking',
] as const;

const STEP_ELIGIBLE_STATUSES: Record<AutoStep, schema.BulkImportItem['status'][]> = {
  screening: ['pending'],
  sorting: ['screened'],
  branching: ['sorted'],
  identification: ['branched'],
  linking: ['identified'],
};

const inFlightRunAll = new Set<string>();

interface RunAllProgress {
  total: number;
  processed: number;
  failed: number;
  startedAt: string;
  finishedAt: string | null;
}

function runAllKey(sessionId: string, step: AutoStep): string {
  return `${sessionId}:${step}`;
}

function getRunAllMap(
  progress: Record<string, unknown> | null | undefined,
): Record<string, RunAllProgress> {
  const raw = (progress ?? {}) as Record<string, unknown>;
  const existing = raw.runAll;
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    return { ...(existing as Record<string, RunAllProgress>) };
  }
  return {};
}

async function patchRunAllProgress(
  sessionId: string,
  step: AutoStep,
  patch: Partial<RunAllProgress>,
): Promise<void> {
  const session = await loadSession(sessionId);
  if (!session) return;
  const runAll = getRunAllMap(session.progress);
  const current = runAll[step] ?? {
    total: 0,
    processed: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  runAll[step] = { ...current, ...patch };
  const nextProgress = {
    ...((session.progress ?? {}) as Record<string, unknown>),
    runAll,
  };
  await db
    .update(schema.bulkImportSessions)
    .set({ progress: nextProgress, updatedAt: new Date() })
    .where(eq(schema.bulkImportSessions.id, sessionId));
}

/**
 * Run a single AI step against one staged item and persist the result.
 * Centralised so per-item endpoints and the run-all loop share the
 * exact same behaviour (and therefore the per-item "Retry" button is
 * a true retry, not a different code path).
 */
async function processItemForStep(
  step: AutoStep,
  item: schema.BulkImportItem,
  sessionItems: { id: string; name: string }[],
): Promise<schema.BulkImportItem> {
  if (step === 'screening') {
    const result = await bulkImportAnalyzer.screen({
      originalName: item.originalName,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      stagedPath: item.stagedPath,
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
    return updated;
  }
  if (step === 'sorting') {
    const result = await bulkImportAnalyzer.suggestMergeOrSplit({
      originalName: item.originalName,
      siblingNames: sessionItems.filter((s) => s.id !== item.id).map((s) => s.name),
      stagedPath: item.stagedPath,
      mimeType: item.mimeType,
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
    return updated;
  }
  if (step === 'branching') {
    const description =
      (item.screening as { description?: string } | null)?.description ?? '';
    const result = await bulkImportAnalyzer.suggestBranch({
      originalName: item.originalName,
      description,
      stagedPath: item.stagedPath,
      mimeType: item.mimeType,
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
    return updated;
  }
  if (step === 'identification') {
    const branch =
      (item.branchDecision as { branch?: string } | null)?.branch ?? 'building_documents';
    const description =
      (item.screening as { description?: string } | null)?.description ?? '';
    const result = await bulkImportAnalyzer.identify({
      originalName: item.originalName,
      description,
      branch,
      stagedPath: item.stagedPath,
      mimeType: item.mimeType,
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
    return updated;
  }
  // linking
  const result = await bulkImportAnalyzer.suggestLinks({
    originalName: item.originalName,
    candidates: sessionItems.filter((c) => c.id !== item.id),
    stagedPath: item.stagedPath,
    mimeType: item.mimeType,
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
  return updated;
}

/**
 * Spawn the background loop that walks every eligible item for a step.
 * Fire-and-forget: returns the kicked-off promise so tests can `await`
 * it but production callers (the route) just throw it on the floor and
 * let the Node event loop drain it after the response goes out. This is
 * what lets an admin navigate away mid-run without the work stopping.
 */
async function runAllForStep(sessionId: string, step: AutoStep): Promise<void> {
  const key = runAllKey(sessionId, step);
  if (inFlightRunAll.has(key)) return;
  inFlightRunAll.add(key);

  try {
    const items = await db
      .select()
      .from(schema.bulkImportItems)
      .where(eq(schema.bulkImportItems.sessionId, sessionId));

    const eligibleStatuses = STEP_ELIGIBLE_STATUSES[step];
    const eligible = items.filter((i) => eligibleStatuses.includes(i.status));
    const sessionItems = items.map((i) => ({ id: i.id, name: i.originalName }));

    await patchRunAllProgress(sessionId, step, {
      total: eligible.length,
      processed: 0,
      failed: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    });

    if (eligible.length === 0) {
      await patchRunAllProgress(sessionId, step, {
        finishedAt: new Date().toISOString(),
      });
      return;
    }

    let processed = 0;
    let failed = 0;
    for (const item of eligible) {
      // Cooperative cancellation (Task #593): if the admin cleared the
      // session via DELETE the key is removed from `inFlightRunAll`, so
      // we bail out before doing any more work or burning AI tokens on
      // a session whose rows are about to be wiped. Generalizes the
      // screening-only cancellation from Task #593 to all five steps.
      if (!inFlightRunAll.has(key)) break;

      try {
        await processItemForStep(step, item, sessionItems);
      } catch (err) {
        failed += 1;
        logError(
          `[bulk-import] run-all ${step} failed for item ${item.id}`,
          err as Error,
        );
      }
      processed += 1;
      // Persist after every item so the polling client sees movement.
      await patchRunAllProgress(sessionId, step, { processed, failed });
    }

    await patchRunAllProgress(sessionId, step, {
      finishedAt: new Date().toISOString(),
    });
    logInfo('[bulk-import] run-all finished', {
      metadata: { sessionId, step, processed, failed },
    });
  } catch (err) {
    logError('[bulk-import] run-all loop crashed', err as Error);
    try {
      await patchRunAllProgress(sessionId, step, {
        finishedAt: new Date().toISOString(),
      });
    } catch {
      /* swallow — already in error path */
    }
  } finally {
    inFlightRunAll.delete(key);
  }
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
      // Cancel any in-flight run-all loop FIRST so it stops on its
      // next iteration instead of racing with the row/file cleanup
      // below (Task #593, generalized from screening-only to all five
      // steps in Task #592). The loop checks `inFlightRunAll.has(key)`
      // between items, so deleting the keys here is the cancellation
      // signal.
      for (const key of inFlightRunAll) {
        if (key.startsWith(`${session.id}:`)) {
          inFlightRunAll.delete(key);
        }
      }
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

  /**
   * Hard-delete a session — permanently removes the session, its items,
   * and any staged files from disk (Task #696). Unlike the "clear"
   * endpoint above which marks the session as `cleared` but leaves the
   * row in place for the history list, this endpoint removes the row
   * entirely so it disappears from the "Past sessions" view. Cancels
   * any in-flight run-all loop first using the same cooperative
   * cancellation signal as the clear path.
   */
  app.delete(
    '/api/admin/bulk-import/sessions/:id/hard',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      const session = await loadSession(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      for (const key of inFlightRunAll) {
        if (key.startsWith(`${session.id}:`)) {
          inFlightRunAll.delete(key);
        }
      }
      await db
        .delete(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.sessionId, session.id));
      await db
        .delete(schema.bulkImportSessions)
        .where(eq(schema.bulkImportSessions.id, session.id));
      safeRmSession(session.id);
      logInfo('[bulk-import] session hard-deleted', {
        metadata: { sessionId: session.id },
      });
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

  /**
   * Stream a staged item's raw bytes so the wizard can render real
   * thumbnails / inline previews (Task #457). Admin-only, scoped to the
   * item's own staging directory; we never let callers escape via
   * `..` because the path comes straight from the DB row, not the URL.
   */
  app.get(
    '/api/admin/bulk-import/items/:id/file',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      const [item] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, req.params.id));
      if (!item) return res.status(404).json({ error: 'Item not found' });

      const resolved = path.resolve(item.stagedPath);
      const stagingRoot = path.resolve(STAGING_ROOT);
      if (!resolved.startsWith(stagingRoot + path.sep)) {
        return res.status(400).json({ error: 'Invalid staged path' });
      }
      if (!fs.existsSync(resolved)) {
        return res.status(404).json({ error: 'Staged file missing' });
      }

      res.setHeader('Content-Type', item.mimeType ?? 'application/octet-stream');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(item.originalName)}"`,
      );
      fs.createReadStream(resolved).pipe(res);
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

  /**
   * Per-item AI step endpoints. The wizard auto-runs every step in
   * bulk via `/sessions/:id/run-all` (Task #592), so these handlers
   * are now reserved for the per-row "Retry" button shown when a
   * single item came back in a fallback state. Keeping them as thin
   * wrappers around the shared `processItemForStep` helper guarantees
   * the retry path produces exactly the same result as the bulk loop.
   */
  function registerPerItemStep(action: string, step: AutoStep) {
    app.post(
      `/api/admin/bulk-import/items/:id/${action}`,
      requireAuth,
      requireRole(['admin']),
      async (req: AuthenticatedRequest, res: Response) => {
        try {
          const [item] = await db
            .select()
            .from(schema.bulkImportItems)
            .where(eq(schema.bulkImportItems.id, req.params.id));
          if (!item) return res.status(404).json({ error: 'Item not found' });
          const sessionItems = await db
            .select({
              id: schema.bulkImportItems.id,
              name: schema.bulkImportItems.originalName,
            })
            .from(schema.bulkImportItems)
            .where(eq(schema.bulkImportItems.sessionId, item.sessionId));
          const updated = await processItemForStep(step, item, sessionItems);
          return res.json(updated);
        } catch (err) {
          logError(`[bulk-import] per-item ${step} failed`, err as Error);
          return res.status(500).json({ error: `Failed to run ${step}` });
        }
      },
    );
  }
  registerPerItemStep('screen', 'screening');
  registerPerItemStep('sort', 'sorting');
  registerPerItemStep('branch', 'branching');
  registerPerItemStep('identify', 'identification');
  registerPerItemStep('link', 'linking');

  /**
   * Auto-run an AI step for every eligible item in one session
   * (Task #592, generalizing Task #575's screening-only auto loop).
   * Idempotent: a second call while a loop is already in flight returns
   * the current progress instead of starting a parallel run. The actual
   * processing happens in the background so admins can navigate away
   * mid-run, and the loop is cooperatively cancellable via
   * `inFlightRunAll` (see Task #593) — clearing the session removes
   * the in-flight key, which the loop checks between items.
   */
  const runAllSchema = z.object({
    step: z.enum(['screening', 'sorting', 'branching', 'identification', 'linking']),
  });
  app.post(
    '/api/admin/bulk-import/sessions/:id/run-all',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { step } = runAllSchema.parse(req.body);
        const session = await loadSession(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const key = runAllKey(session.id, step);
        const alreadyRunning = inFlightRunAll.has(key);

        if (!alreadyRunning) {
          // Fire-and-forget: kick off the loop and respond immediately.
          // The Node event loop will keep draining it after the HTTP
          // response goes out, which is what lets the admin navigate
          // away mid-run.
          void runAllForStep(session.id, step);
        }

        // Return the current progress snapshot (wait briefly for the
        // loop to write its initial entry so the client doesn't see
        // a stale `null`).
        const fresh = await loadSession(session.id);
        const runAll = getRunAllMap(fresh?.progress);
        return res.json({
          step,
          alreadyRunning,
          progress: runAll[step] ?? null,
        });
      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
        logError('[bulk-import] run-all failed', err as Error);
        return res.status(500).json({ error: 'Failed to start run-all' });
      }
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
