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
import { and, desc, eq, inArray } from 'drizzle-orm';
import { requireAuth, requireRole } from '../auth';
import { canUserAccessOrganization } from '../rbac';

type AuthenticatedRequest = Request & { user?: { id: string; role: string } };
import { db } from '../db';
import * as schema from '@shared/schema';
import { storage } from '../storage';
import {
  bulkImportAnalyzer,
  isBulkImportAiAvailable,
  type QuickAnalysis,
  type SiblingContext,
  BRANCH_SUB_CATEGORIES,
  type BranchDestination,
} from '../services/bulk-import-analyzer';
import { rotateAndRewriteStagedFile } from '../services/bulk-import-rotation';
import { documentService } from '../services/document-service';
import { logError, logInfo, logWarn } from '../utils/logger';
import type { BulkImportFallbackReason } from '@shared/schemas/bulk-import';
import { fixLatin1MisdecodeFilename } from '../utils/filenameNormalization';
import { buildContentDisposition } from '../utils/content-disposition';

const STAGING_ROOT = path.join(process.cwd(), '.staging', 'bulk-import');

/**
 * Pull the Screening AI's quickAnalysis fields (typeGuess, bucketGuess,
 * reason) out of a stored screening JSON blob and return them as flat
 * scalar fields. Both the lite polling endpoint and the full session
 * endpoint surface these so the wizard and the history view render the
 * same AI guesses without re-uploading the file (Tasks #767, #771, #782).
 */
function extractScreeningQuickAnalysisFields(
  json: Record<string, unknown> | null | undefined,
): {
  screeningTypeGuess: string | null;
  screeningBucketGuess: string | null;
  screeningQaReason: string | null;
} {
  if (!json) return { screeningTypeGuess: null, screeningBucketGuess: null, screeningQaReason: null };
  const qa = json.quickAnalysis as Record<string, unknown> | null | undefined;
  if (!qa) return { screeningTypeGuess: null, screeningBucketGuess: null, screeningQaReason: null };
  return {
    screeningTypeGuess: (qa.typeGuess as string | null | undefined) ?? null,
    screeningBucketGuess: (qa.bucketGuess as string | null | undefined) ?? null,
    screeningQaReason: (qa.reason as string | null | undefined) ?? null,
  };
}

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

const ZIP_MIMES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'multipart/x-zip',
]);

export function isZipFile(file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>): boolean {
  if (ZIP_MIMES.has(file.mimetype.toLowerCase())) return true;
  if (file.originalname.toLowerCase().endsWith('.zip')) return true;
  return false;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per file
  fileFilter: (_req, file, cb) => {
    if (isZipFile(file)) {
      cb(null, false);
    } else {
      cb(null, true);
    }
  },
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
 * Emit a structured warning at the API layer when an analyzer call returns
 * a per-call failure (`api_error` or `unreadable_response`) so admins can
 * trace the failed Bulk Import row back to its session and retry it from
 * the admin panel. The analyzer-level log (Task #801) only knows the
 * filename and step; this log adds itemId + bulkImportSession (the session
 * UUID), which only the API layer has cheaply on hand.
 *
 * Other fallbackReason values (`oversize`, `unsupported_mime`,
 * `extraction_failed`, `missing_file`, `no_api_key`) are deterministic
 * pre-call decisions, not failed AI calls, so they are deliberately not
 * logged here — they would just be noise for ops.
 *
 * Note on the `bulkImportSession` field name: the shared logger
 * (server/utils/logger.ts) auto-redacts any metadata key whose lowercased
 * name contains `sessionid` / `session_id` because those normally hold
 * HTTP cookie session IDs. Our value is a non-secret bulk-import session
 * UUID, but the sanitizer can't tell the difference, so we deliberately
 * pick a key name that does not match the sensitive-field substrings —
 * otherwise the value ops actually need would print as `[REDACTED]`.
 */
export function logPerFileAiFailure(
  step: AutoStep,
  item: Pick<schema.BulkImportItem, 'id' | 'sessionId' | 'originalName'>,
  fallbackReason: BulkImportFallbackReason | null | undefined,
): void {
  if (fallbackReason !== 'api_error' && fallbackReason !== 'unreadable_response') {
    return;
  }
  logWarn('[bulk-import] per-file AI failure', {
    metadata: {
      step,
      itemId: item.id,
      bulkImportSession: item.sessionId,
      originalName: item.originalName,
      fallbackReason,
    },
  });
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
  sessionItems: { id: string; name: string; screening?: Record<string, unknown> | null }[],
  residences?: Array<{ id: string; unitNumber: string }>,
): Promise<schema.BulkImportItem> {
  if (step === 'screening') {
    const result = await bulkImportAnalyzer.screen({
      originalName: item.originalName,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      stagedPath: item.stagedPath,
      itemId: item.id,
      sessionId: item.sessionId,
    });
    logPerFileAiFailure(step, item, result.fallbackReason);

    // Apply rotation in place so Branching and all later steps read
    // the upright version of the document. Failures are silent — the
    // original file stays, rotation is logged, and the UI still shows
    // the rotationDegrees from Screening.
    let contentHash = item.contentHash;
    let rotationApplied = false;
    if (result.rotationDegrees !== 0 && item.stagedPath) {
      const newHash = await rotateAndRewriteStagedFile({
        stagedPath: item.stagedPath,
        mimeType: item.mimeType,
        rotationDegrees: result.rotationDegrees,
      });
      if (newHash) {
        contentHash = newHash;
        rotationApplied = true;
      }
    }

    // Persist `rotationApplied` alongside the screening result so the
    // admin UI can distinguish "AI suggested rotation AND we corrected
    // the file in place" from "AI suggested rotation but rewrite failed
    // / format unsupported, file untouched" (Task #772).
    const screeningWithRotation = {
      ...(result as unknown as Record<string, unknown>),
      rotationApplied,
    };

    const [updated] = await db
      .update(schema.bulkImportItems)
      .set({
        screening: screeningWithRotation,
        contentHash,
        status: 'screened',
        updatedAt: new Date(),
      })
      .where(eq(schema.bulkImportItems.id, item.id))
      .returning();
    return updated;
  }
  if (step === 'sorting') {
    // Build sibling context including each sibling's quickAnalysis from
    // their stored screening blob so the Branching analyzer can use it.
    const siblings: SiblingContext[] = sessionItems
      .filter((s) => s.id !== item.id)
      .map((s) => {
        const sc = s.screening as Record<string, unknown> | null | undefined;
        const qa = sc?.quickAnalysis as QuickAnalysis | null | undefined;
        return { id: s.id, name: s.name, quickAnalysis: qa ?? null };
      });

    const myScreening = item.screening as Record<string, unknown> | null | undefined;
    const myQa = myScreening?.quickAnalysis as QuickAnalysis | null | undefined;
    const myIsMultiDocument = typeof myScreening?.isMultiDocument === 'boolean'
      ? myScreening.isMultiDocument
      : null;

    const result = await bulkImportAnalyzer.suggestMergeOrSplit({
      originalName: item.originalName,
      siblings,
      quickAnalysis: myQa ?? null,
      isMultiDocument: myIsMultiDocument,
      stagedPath: item.stagedPath,
      mimeType: item.mimeType,
      itemId: item.id,
      sessionId: item.sessionId,
    });
    logPerFileAiFailure(step, item, result.fallbackReason);
    const sortingDecisionWithState: Record<string, unknown> = {
      ...(result as unknown as Record<string, unknown>),
      decisionState: 'pending',
    };
    const [updated] = await db
      .update(schema.bulkImportItems)
      .set({
        sortingDecision: sortingDecisionWithState,
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
      residences,
      itemId: item.id,
      sessionId: item.sessionId,
    });
    logPerFileAiFailure(step, item, result.fallbackReason);
    // Preserve any existing residenceManualOverride the admin may have
    // set on a prior attempt; only overwrite the AI-generated fields.
    const existingDecision = (item.branchDecision ?? {}) as Record<string, unknown>;
    const nextDecision: Record<string, unknown> = {
      ...result,
      residenceManualOverride: existingDecision.residenceManualOverride ?? false,
    };
    // Gate: don't promote to `branched` if destination is residence_documents
    // but no residenceId was resolved. The admin must pick one via the
    // set-residence endpoint before the item can advance.
    const advanceToBranched =
      result.branch !== 'residence_documents' || !!result.residenceId;
    const [updated] = await db
      .update(schema.bulkImportItems)
      .set({
        branchDecision: nextDecision,
        status: advanceToBranched ? 'branched' : 'sorted',
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
      itemId: item.id,
      sessionId: item.sessionId,
    });
    logPerFileAiFailure(step, item, result.fallbackReason);
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
    itemId: item.id,
    sessionId: item.sessionId,
  });
  logPerFileAiFailure(step, item, result.fallbackReason);
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
    const sessionItems = items.map((i) => ({
      id: i.id,
      name: i.originalName,
      screening: i.screening as Record<string, unknown> | null,
    }));

    // Fetch the session's building residences once so every item in the
    // branching loop can receive the same list without N extra queries.
    let sessionResidences: Array<{ id: string; unitNumber: string }> | undefined;
    if (step === 'branching') {
      const session = await loadSession(sessionId);
      if (session?.buildingId) {
        const rows = await db
          .select({ id: schema.residences.id, unitNumber: schema.residences.unitNumber })
          .from(schema.residences)
          .where(
            and(
              eq(schema.residences.buildingId, session.buildingId),
              eq(schema.residences.isActive, true),
            ),
          );
        sessionResidences = rows;
      }
    }

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
        await processItemForStep(step, item, sessionItems, sessionResidences);
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
  /**
   * Lightweight health probe for the AI side of the bulk-import
   * pipeline. Returns whether `ANTHROPIC_API_KEY` is configured and an
   * Anthropic client can be constructed. The admin Bulk Document
   * Import page polls this once on mount so it can render a single
   * page-level "AI unavailable — results are filename-only stubs"
   * banner instead of relying on per-document fallback badges alone.
   *
   * No payload validation; no DB hits. Admin-gated like the rest of
   * this router so we don't leak deployment configuration to non-admin
   * users.
   */
  app.get(
    '/api/admin/bulk-import/ai-status',
    requireAuth,
    requireRole(['admin']),
    async (_req: AuthenticatedRequest, res: Response) => {
      return res.json({ available: isBulkImportAiAvailable() });
    },
  );

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

  /**
   * List sessions visible to the caller with server-side pagination
   * (Task #727). Returns the most recent sessions first (createdAt DESC)
   * and applies org-scoping so admins without global access only see
   * sessions belonging to their own organisations.
   *
   * Query params:
   *   limit  — max rows to return (default 20, cap 100)
   *   offset — number of rows to skip (default 0)
   */
  app.get(
    '/api/admin/bulk-import/sessions',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
        const offset = Math.max(Number(req.query.offset) || 0, 0);

        // Org-scoping: check whether this admin has cross-org access.
        const userOrgs = await db
          .select({
            organizationId: schema.userOrganizations.organizationId,
            canAccessAllOrganizations: schema.userOrganizations.canAccessAllOrganizations,
          })
          .from(schema.userOrganizations)
          .where(
            and(
              eq(schema.userOrganizations.userId, req.user!.id),
              eq(schema.userOrganizations.isActive, true),
            ),
          );

        const hasGlobalAccess = userOrgs.some((o) => o.canAccessAllOrganizations);

        // Use limit+1 to detect whether there is a next page without a
        // separate COUNT(*) query.
        let rows: typeof schema.bulkImportSessions.$inferSelect[];
        if (hasGlobalAccess) {
          rows = await db
            .select()
            .from(schema.bulkImportSessions)
            .orderBy(desc(schema.bulkImportSessions.createdAt))
            .limit(limit + 1)
            .offset(offset);
        } else if (userOrgs.length === 0) {
          rows = [];
        } else {
          const orgIds = userOrgs.map((o) => o.organizationId);
          rows = await db
            .select()
            .from(schema.bulkImportSessions)
            .where(inArray(schema.bulkImportSessions.organizationId, orgIds))
            .orderBy(desc(schema.bulkImportSessions.createdAt))
            .limit(limit + 1)
            .offset(offset);
        }

        const hasMore = rows.length > limit;
        const sessions = hasMore ? rows.slice(0, limit) : rows;
        return res.json({ sessions, limit, offset, hasMore });
      } catch (err) {
        logError('[bulk-import] list sessions failed', err as Error);
        return res.status(500).json({ error: 'Failed to list sessions' });
      }
    },
  );

  /**
   * Lightweight polling endpoint for the active-session wizard
   * (Task #727). Returns the session row plus a lean item shape that
   * omits the heavy AI decision JSON blobs — just the scalar fields
   * the status badges, confidence badges, and progress bars need.
   * The full item payload (including AI JSON) is still available via
   * GET /sessions/:id (used by the history detail view on expand).
   */
  app.get(
    '/api/admin/bulk-import/sessions/:id/lite',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      const session = await loadSession(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });

      const rows = await db
        .select({
          id: schema.bulkImportItems.id,
          originalName: schema.bulkImportItems.originalName,
          mimeType: schema.bulkImportItems.mimeType,
          status: schema.bulkImportItems.status,
          preExcludeStatus: schema.bulkImportItems.preExcludeStatus,
          excludeSource: schema.bulkImportItems.excludeSource,
          screening: schema.bulkImportItems.screening,
          sortingDecision: schema.bulkImportItems.sortingDecision,
          branchDecision: schema.bulkImportItems.branchDecision,
          identification: schema.bulkImportItems.identification,
          linkDecisions: schema.bulkImportItems.linkDecisions,
        })
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.sessionId, session.id));

      // Pre-extract confidence + fallbackReason from each step's JSON so
      // the client never has to download or parse the full AI decision blob.
      function extractStep(json: Record<string, unknown> | null | undefined) {
        if (!json) return { confidence: null, fallbackReason: null };
        return {
          confidence: (json.confidence as number | null | undefined) ?? null,
          fallbackReason: (json.fallbackReason as string | null | undefined) ?? null,
        };
      }

      function extractSortingStep(json: Record<string, unknown> | null | undefined) {
        const base = extractStep(json);
        if (!json) return {
          ...base,
          decision: null,
          reason: null,
          mergeWithItemId: null,
          mergeWithItemIds: null,
          splitAtPage: null,
          decisionState: null,
          manualOverride: false,
        };
        const raw = json.decision as string | null | undefined;
        const decision =
          raw === 'keep' || raw === 'merge' || raw === 'split' ? raw : null;
        const reason = (json.reason as string | null | undefined) ?? null;
        const mergeWithItemId = (json.mergeWithItemId as string | null | undefined) ?? null;
        const mergeWithItemIds = Array.isArray(json.mergeWithItemIds)
          ? (json.mergeWithItemIds as string[])
          : null;
        const splitAtPage = (json.splitAtPage as number | null | undefined) ?? null;
        const rawState = json.decisionState as string | null | undefined;
        const decisionState =
          rawState === 'pending' || rawState === 'accepted' || rawState === 'rejected'
            ? rawState
            : null;
        const manualOverride = (json.manualOverride as boolean | null | undefined) ?? false;
        return { ...base, decision, reason, mergeWithItemId, mergeWithItemIds, splitAtPage, decisionState, manualOverride };
      }

      function extractIdentificationStep(json: Record<string, unknown> | null | undefined) {
        const base = extractStep(json);
        if (!json) return { ...base, name: null, description: null, tags: null, effectiveDate: null };
        return {
          ...base,
          name: (json.name as string | null | undefined) ?? null,
          description: (json.description as string | null | undefined) ?? null,
          tags: Array.isArray(json.tags) ? (json.tags as string[]) : null,
          effectiveDate: (json.effectiveDate as string | null | undefined) ?? null,
        };
      }

      function extractLinkingStep(json: Record<string, unknown> | null | undefined) {
        const base = extractStep(json);
        if (!json) return { ...base, linkingReason: null, beforeItemId: null, afterItemId: null };
        return {
          ...base,
          linkingReason: (json.reason as string | null | undefined) ?? null,
          beforeItemId: (json.beforeItemId as string | null | undefined) ?? null,
          afterItemId: (json.afterItemId as string | null | undefined) ?? null,
        };
      }

      // Surface rotation outcome so the Screening row can render a
      // "Rotated Xdeg" badge (Task #772). `rotationApplied` is only true
      // when the staged file was actually rewritten in place — failed or
      // unsupported rotations leave it false so no badge is shown.
      function extractScreeningRotation(json: Record<string, unknown> | null | undefined) {
        if (!json) return { rotationDegrees: 0, rotationApplied: false };
        const raw = json.rotationDegrees;
        const rotationDegrees =
          raw === 90 || raw === 180 || raw === 270 ? (raw as 90 | 180 | 270) : 0;
        const rotationApplied = json.rotationApplied === true;
        return { rotationDegrees, rotationApplied };
      }

      function extractBranchStep(json: Record<string, unknown> | null | undefined) {
        const base = extractStep(json);
        if (!json) return {
          ...base,
          branch: null,
          subCategory: null,
          branchReason: null,
          manualOverride: false,
          residenceId: null,
          residenceConfidence: null,
          residenceReason: null,
          residenceFallbackReason: null,
          residenceManualOverride: false,
        };
        const validBranches: BranchDestination[] = [
          'building_documents', 'residence_documents', 'demand', 'bill', 'maintenance', 'other',
        ];
        const rawBranch = json.branch as string | null | undefined;
        const branch: BranchDestination | null =
          rawBranch && validBranches.includes(rawBranch as BranchDestination)
            ? (rawBranch as BranchDestination)
            : null;
        const subCategory = (json.subCategory as string | null | undefined) ?? null;
        const branchReason = (json.reason as string | null | undefined) ?? null;
        const manualOverride = (json.manualOverride as boolean | null | undefined) ?? false;
        const residenceId = (json.residenceId as string | null | undefined) ?? null;
        const residenceConfidence = (json.residenceConfidence as number | null | undefined) ?? null;
        const residenceReason = (json.residenceReason as string | null | undefined) ?? null;
        const residenceFallbackReason = (json.residenceFallbackReason as string | null | undefined) ?? null;
        const residenceManualOverride = (json.residenceManualOverride as boolean | null | undefined) ?? false;
        return {
          ...base,
          branch,
          subCategory,
          branchReason,
          manualOverride,
          residenceId,
          residenceConfidence,
          residenceReason,
          residenceFallbackReason,
          residenceManualOverride,
        };
      }

      const items = rows.map((r) => ({
        id: r.id,
        originalName: r.originalName,
        mimeType: r.mimeType,
        status: r.status,
        preExcludeStatus: r.preExcludeStatus,
        excludeSource: r.excludeSource,
        ...(() => {
          const sc = extractStep(r.screening);
          const sqaFields = extractScreeningQuickAnalysisFields(r.screening);
          const srot = extractScreeningRotation(r.screening);
          const so = extractSortingStep(r.sortingDecision);
          const br = extractBranchStep(r.branchDecision);
          const id = extractIdentificationStep(r.identification);
          const lk = extractLinkingStep(r.linkDecisions);
          return {
            screeningConfidence: sc.confidence,
            screeningFallback: sc.fallbackReason,
            ...sqaFields,
            screeningRotationDegrees: srot.rotationDegrees,
            screeningRotationApplied: srot.rotationApplied,
            sortingConfidence: so.confidence,
            sortingFallback: so.fallbackReason,
            sortingDecision: so.decision,
            sortingReason: so.reason,
            sortingMergeWithItemId: so.mergeWithItemId,
            sortingMergeWithItemIds: so.mergeWithItemIds,
            sortingSplitAtPage: so.splitAtPage,
            sortingDecisionState: so.decisionState,
            sortingManualOverride: so.manualOverride,
            branchingConfidence: br.confidence,
            branchingFallback: br.fallbackReason,
            branch: br.branch,
            subCategory: br.subCategory,
            branchReason: br.branchReason,
            branchManualOverride: br.manualOverride,
            residenceId: br.residenceId,
            residenceConfidence: br.residenceConfidence,
            residenceReason: br.residenceReason,
            residenceFallbackReason: br.residenceFallbackReason,
            residenceManualOverride: br.residenceManualOverride,
            identificationConfidence: id.confidence,
            identificationFallback: id.fallbackReason,
            identificationName: id.name,
            identificationDescription: id.description,
            identificationTags: id.tags,
            identificationEffectiveDate: id.effectiveDate,
            linkingConfidence: lk.confidence,
            linkingFallback: lk.fallbackReason,
            linkingReason: lk.linkingReason,
            linkingBeforeItemId: lk.beforeItemId,
            linkingAfterItemId: lk.afterItemId,
          };
        })(),
      }));

      return res.json({ session, items });
    },
  );

  /**
   * Lightweight buildings list for the bulk-import building picker
   * (Task #727). Returns only the scalar fields the picker card needs
   * (id, name, organizationId, address, city, province, buildingType,
   * totalUnits) — no commonSpaces counts, no statistics, no residence
   * joins. Applies the same org/global-access scoping as the standard
   * /api/buildings endpoint so the results never exceed what the caller
   * is allowed to see.
   */
  app.get(
    '/api/admin/bulk-import/buildings-lite',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userOrgs = await db
          .select({
            organizationId: schema.userOrganizations.organizationId,
            canAccessAllOrganizations: schema.userOrganizations.canAccessAllOrganizations,
          })
          .from(schema.userOrganizations)
          .where(
            and(
              eq(schema.userOrganizations.userId, req.user!.id),
              eq(schema.userOrganizations.isActive, true),
            ),
          );

        const hasGlobalAccess = userOrgs.some((o) => o.canAccessAllOrganizations);

        const fields = {
          id: schema.buildings.id,
          name: schema.buildings.name,
          organizationId: schema.buildings.organizationId,
          address: schema.buildings.address,
          city: schema.buildings.city,
          province: schema.buildings.province,
          buildingType: schema.buildings.buildingType,
          totalUnits: schema.buildings.totalUnits,
        } as const;

        let rows: {
          id: string;
          name: string;
          organizationId: string;
          address: string | null;
          city: string | null;
          province: string | null;
          buildingType: string | null;
          totalUnits: number | null;
        }[];

        if (hasGlobalAccess) {
          rows = await db
            .select(fields)
            .from(schema.buildings)
            .where(eq(schema.buildings.isActive, true))
            .orderBy(schema.buildings.name);
        } else if (userOrgs.length === 0) {
          rows = [];
        } else {
          const orgIds = userOrgs.map((o) => o.organizationId);
          rows = await db
            .select(fields)
            .from(schema.buildings)
            .where(
              and(
                eq(schema.buildings.isActive, true),
                inArray(schema.buildings.organizationId, orgIds),
              ),
            )
            .orderBy(schema.buildings.name);
        }

        return res.json(rows);
      } catch (err) {
        logError('[bulk-import] buildings-lite failed', err as Error);
        return res.status(500).json({ error: 'Failed to fetch buildings' });
      }
    },
  );

  /**
   * Fetch a single session WITH its items (full resume payload). Each
   * item carries the same flat `screeningTypeGuess` / `screeningBucketGuess`
   * / `screeningQaReason` fields the lite endpoint exposes (Task #782) so
   * the history view can surface the AI's quickAnalysis without re-parsing
   * the heavy `screening` JSON blob client-side.
   */
  app.get(
    '/api/admin/bulk-import/sessions/:id',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      const session = await loadSession(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      const rows = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.sessionId, session.id));
      const items = rows.map((row) => ({
        ...row,
        ...extractScreeningQuickAnalysisFields(
          row.screening as Record<string, unknown> | null | undefined,
        ),
      }));
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

  /** Upload a batch of individual files into a session (ZIP archives are filtered out by multer). */
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

          // Fix Latin-1 mis-decode: multer may decode UTF-8 filename bytes as
          // Latin-1, turning é (0xC3 0xA9) into the two-char sequence "Ã©".
          // Re-interpret as UTF-8 so accented names round-trip correctly.
          const correctedName = fixLatin1MisdecodeFilename(file.originalname);

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

          // Duplicate check wins; only test the exclusion store when there
          // is no committed fingerprint for this file in this org.
          const [excluded] = dupe
            ? []
            : await db
                .select()
                .from(schema.clientExcludedFingerprints)
                .where(
                  and(
                    eq(schema.clientExcludedFingerprints.organizationId, session.organizationId),
                    eq(schema.clientExcludedFingerprints.contentHash, hash),
                  ),
                )
                .limit(1);

          const [row] = await db
            .insert(schema.bulkImportItems)
            .values({
              sessionId: session.id,
              originalPath: correctedName,
              originalName: correctedName,
              stagedPath,
              contentHash: hash,
              mimeType: file.mimetype,
              fileSize: file.size,
              ...(dupe
                ? { status: 'duplicate' }
                : excluded
                  ? {
                      status: 'rejected',
                      preExcludeStatus: 'pending',
                      excludeSource: 'prior_session',
                    }
                  : { status: 'pending' }),
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
        buildContentDisposition(item.originalName, { type: 'inline' }),
      );
      fs.createReadStream(resolved).pipe(res);
    },
  );

  /**
   * Return the total page count of a staged PDF item so the manual
   * sorting picker can render a live "page X of N — first part: X
   * pages, second part: (N - X) pages" badge next to the split-page
   * input (Task #824). The wizard fetches this once when the picker
   * opens — keystrokes on the split input recompute the badge in the
   * client, no re-fetch is needed.
   *
   * Non-PDF items return a 400 because the picker only shows the
   * split control for PDFs anyway. The staged path is resolved and
   * validated against `STAGING_ROOT` exactly like the `/file`
   * endpoint above so a poisoned `stagedPath` row can never coax us
   * into reading arbitrary files off disk.
   */
  app.get(
    '/api/admin/bulk-import/items/:id/page-count',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      const [item] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, req.params.id));
      if (!item) return res.status(404).json({ error: 'Item not found' });

      const isPdf = (item.mimeType ?? '').toLowerCase() === 'application/pdf';
      if (!isPdf) {
        return res
          .status(400)
          .json({ error: 'Page count is only available for PDF items' });
      }
      if (!item.stagedPath) {
        return res.status(404).json({ error: 'Staged file missing' });
      }

      const resolved = path.resolve(item.stagedPath);
      const stagingRoot = path.resolve(STAGING_ROOT);
      if (!resolved.startsWith(stagingRoot + path.sep)) {
        return res.status(400).json({ error: 'Invalid staged path' });
      }
      if (!fs.existsSync(resolved)) {
        return res.status(404).json({ error: 'Staged file missing' });
      }

      try {
        const { PDFDocument } = await import('pdf-lib');
        const bytes = fs.readFileSync(resolved);
        const doc = await PDFDocument.load(new Uint8Array(bytes), {
          ignoreEncryption: true,
        });
        return res.json({ totalPages: doc.getPageCount() });
      } catch (err) {
        logError('[bulk-import] page-count failed', err as Error);
        return res.status(500).json({ error: 'Failed to read PDF page count' });
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

  /**
   * Exclude / un-exclude a single staged item from the AI pipeline
   * (Task #717). Excluded items are flipped to the existing `rejected`
   * status, which every run-all loop already filters out via
   * `STEP_ELIGIBLE_STATUSES`, so no additional guard is needed in the
   * step processors. The pre-exclusion status is remembered on the row
   * so re-including the item drops it back exactly where it was — for
   * example, an item the AI had already screened comes back as
   * `screened`, not `pending`.
   *
   * Body: `{ excluded: boolean }`. Idempotent in both directions.
   * Validates that the requesting admin actually belongs to (or has
   * cross-org access to) the session's organization before mutating
   * (Task #720 covers this guard end-to-end against real Postgres).
   */
  const excludeItemSchema = z.object({ excluded: z.boolean() });
  app.patch(
    '/api/admin/bulk-import/items/:itemId/exclude',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { excluded } = excludeItemSchema.parse(req.body);
        const [item] = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.id, req.params.itemId));
        if (!item) return res.status(404).json({ error: 'Item not found' });

        const session = await loadSession(item.sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const allowed = await canUserAccessOrganization(
          req.user!.id,
          session.organizationId,
        );
        if (!allowed) {
          return res
            .status(403)
            .json({ error: 'You do not have access to this session' });
        }

        // Refuse to flip terminal states. `committed` items are real
        // documents now, and `duplicate` items were skipped by the
        // dedup check on upload — neither needs (or should support) an
        // exclusion toggle.
        if (item.status === 'committed' || item.status === 'duplicate') {
          return res.status(400).json({
            error: `Cannot change exclusion of a ${item.status} item`,
          });
        }

        if (excluded) {
          // Already excluded — upsert the fingerprint (idempotent) and
          // return the unchanged item so the caller's state stays correct.
          if (item.status === 'rejected') {
            await db
              .insert(schema.clientExcludedFingerprints)
              .values({
                organizationId: session.organizationId,
                contentHash: item.contentHash,
                source: 'manual',
              })
              .onConflictDoNothing({
                target: [
                  schema.clientExcludedFingerprints.organizationId,
                  schema.clientExcludedFingerprints.contentHash,
                ],
              });
            return res.json(item);
          }
          // Exclude the item and persist the fingerprint in a single
          // transaction so the item state and the fingerprint cache
          // never disagree.
          const [updated] = await db.transaction(async (tx) => {
            const rows = await tx
              .update(schema.bulkImportItems)
              .set({
                status: 'rejected',
                preExcludeStatus: item.status,
                excludeSource: null,
                updatedAt: new Date(),
              })
              .where(eq(schema.bulkImportItems.id, item.id))
              .returning();
            await tx
              .insert(schema.clientExcludedFingerprints)
              .values({
                organizationId: session.organizationId,
                contentHash: item.contentHash,
                source: 'manual',
              })
              .onConflictDoNothing({
                target: [
                  schema.clientExcludedFingerprints.organizationId,
                  schema.clientExcludedFingerprints.contentHash,
                ],
              });
            return rows;
          });
          return res.json(updated);
        }

        // Un-exclude: only meaningful if the item is currently rejected.
        if (item.status !== 'rejected') return res.json(item);
        // Fall back to `pending` if we don't have a recorded
        // pre-exclusion status (e.g. items rejected by an older code
        // path before this column existed).
        const restored = item.preExcludeStatus ?? 'pending';
        // Remove the item exclusion and the persisted fingerprint in a
        // single transaction so both are always in sync.
        const [updated] = await db.transaction(async (tx) => {
          const rows = await tx
            .update(schema.bulkImportItems)
            .set({
              status: restored,
              preExcludeStatus: null,
              excludeSource: null,
              updatedAt: new Date(),
            })
            .where(eq(schema.bulkImportItems.id, item.id))
            .returning();
          await tx
            .delete(schema.clientExcludedFingerprints)
            .where(
              and(
                eq(schema.clientExcludedFingerprints.organizationId, session.organizationId),
                eq(schema.clientExcludedFingerprints.contentHash, item.contentHash),
              ),
            );
          return rows;
        });
        return res.json(updated);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ error: err.errors });
        }
        logError('[bulk-import] exclude/unexclude failed', err as Error);
        return res.status(500).json({ error: 'Failed to update exclusion' });
      }
    },
  );

  /**
   * Reassign a single item's branch destination and sub-category
   * without re-running the AI (Task #768). The existing `branchDecision`
   * blob is preserved except for `branch`, `subCategory`, and a new
   * `manualOverride: true` flag so the UI can indicate the admin
   * overrode the AI. The `{ branch, subCategory }` pair is validated
   * against the per-branch vocabulary; mismatched pairs are rejected
   * with 400.
   */
  const reassignSchema = z.object({
    branch: z.enum([
      'building_documents',
      'residence_documents',
      'demand',
      'bill',
      'maintenance',
      'other',
    ]),
    subCategory: z.string().min(1),
  });
  app.post(
    '/api/admin/bulk-import/items/:id/reassign',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { branch, subCategory } = reassignSchema.parse(req.body);
        const allowedSubCats = BRANCH_SUB_CATEGORIES[branch as BranchDestination] as readonly string[];
        if (!allowedSubCats.includes(subCategory)) {
          return res.status(400).json({
            error: `subCategory "${subCategory}" is not valid for branch "${branch}". Allowed: ${allowedSubCats.join(', ')}`,
          });
        }
        const [item] = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.id, req.params.id));
        if (!item) return res.status(404).json({ error: 'Item not found' });
        const existing = (item.branchDecision ?? {}) as Record<string, unknown>;
        const oldBranch = existing.branch as string | null | undefined;
        const updated_decision: Record<string, unknown> = {
          ...existing,
          branch,
          subCategory,
          manualOverride: true,
        };
        // When reassigning away from residence_documents, clear all
        // residence-specific fields so they don't become stale.
        if (oldBranch === 'residence_documents' && branch !== 'residence_documents') {
          delete updated_decision.residenceId;
          delete updated_decision.residenceConfidence;
          delete updated_decision.residenceReason;
          delete updated_decision.residenceFallbackReason;
          delete updated_decision.residenceManualOverride;
        }
        // When reassigning into residence_documents, leave residence
        // fields unset — the admin must pick one via the picker.
        const [updated] = await db
          .update(schema.bulkImportItems)
          .set({
            branchDecision: updated_decision,
            updatedAt: new Date(),
          })
          .where(eq(schema.bulkImportItems.id, item.id))
          .returning();
        return res.json(updated);
      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
        logError('[bulk-import] reassign failed', err as Error);
        return res.status(500).json({ error: 'Failed to reassign item' });
      }
    },
  );

  /**
   * Reassign every item in a destination group at once (Task #776).
   * The Sorting step shows files grouped by their current branch; this
   * endpoint backs the per-group "Reassign all in group" button so the
   * admin doesn't need to click the per-file picker N times. The body
   * carries the explicit `itemIds` the client wants moved (already
   * filtered to non-excluded items belonging to the visible group), the
   * new `branch`, and the new `subCategory`. The handler resolves all
   * matching rows in a single SELECT scoped to the URL session id and
   * then issues one UPDATE per eligible row inside a single request —
   * the client only invalidates the session cache once afterwards
   * instead of after every per-file mutation, which is what the task
   * cares about.
   *
   * Validation:
   *   - `branch` / `subCategory` must be a valid pair from the same
   *     vocabulary as the per-file reassign endpoint.
   *   - `itemIds` must be non-empty. Ids that don't belong to the URL
   *     session are simply not returned by the in-session SELECT, so
   *     they are never updated (cross-session leakage is prevented at
   *     the SELECT level rather than by a strict 400). The response
   *     reports `{ updated, items }` so the client can detect a
   *     partial match if it ever sends stale ids.
   *   - Items that are excluded (status === 'rejected') or already
   *     committed/duplicate are skipped server-side as a safety net
   *     even if the client accidentally includes them, mirroring the
   *     per-file reassign behavior.
   */
  const bulkReassignSchema = z.object({
    branch: z.enum([
      'building_documents',
      'residence_documents',
      'demand',
      'bill',
      'maintenance',
      'other',
    ]),
    subCategory: z.string().min(1),
    itemIds: z.array(z.string().min(1)).min(1),
  });
  app.post(
    '/api/admin/bulk-import/sessions/:id/items/reassign-bulk',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { branch, subCategory, itemIds } = bulkReassignSchema.parse(req.body);
        const allowedSubCats = BRANCH_SUB_CATEGORIES[branch as BranchDestination] as readonly string[];
        if (!allowedSubCats.includes(subCategory)) {
          return res.status(400).json({
            error: `subCategory "${subCategory}" is not valid for branch "${branch}". Allowed: ${allowedSubCats.join(', ')}`,
          });
        }
        const session = await loadSession(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const uniqueIds = Array.from(new Set(itemIds));
        const rows = await db
          .select()
          .from(schema.bulkImportItems)
          .where(
            and(
              eq(schema.bulkImportItems.sessionId, session.id),
              inArray(schema.bulkImportItems.id, uniqueIds),
            ),
          );

        const updatable = rows.filter(
          (r) => r.status !== 'rejected' && r.status !== 'committed' && r.status !== 'duplicate',
        );
        if (updatable.length === 0) {
          return res.json({ updated: 0, items: [] });
        }

        const now = new Date();
        const updated: schema.BulkImportItem[] = [];
        for (const row of updatable) {
          const existing = (row.branchDecision ?? {}) as Record<string, unknown>;
          const updated_decision: Record<string, unknown> = {
            ...existing,
            branch,
            subCategory,
            manualOverride: true,
          };
          const [u] = await db
            .update(schema.bulkImportItems)
            .set({
              branchDecision: updated_decision,
              updatedAt: now,
            })
            .where(eq(schema.bulkImportItems.id, row.id))
            .returning();
          if (u) updated.push(u);
        }
        return res.json({ updated: updated.length, items: updated });
      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
        logError('[bulk-import] bulk reassign failed', err as Error);
        return res.status(500).json({ error: 'Failed to bulk reassign items' });
      }
    },
  );

  /**
   * Set (or clear) the residence assigned to a single Sorting-step item
   * (Task #780). Only valid for items whose branchDecision.branch is
   * `residence_documents`. Setting a residenceId also advances the item
   * from `sorted` to `branched` (the normal promotion gate, which is
   * bypassed when the AI couldn't resolve a residence). Clearing
   * (null) reverts the item back to `sorted` so it stays in the
   * "Residence required" state.
   */
  const setResidenceSchema = z.object({
    residenceId: z.string().min(1).nullable(),
  });
  app.post(
    '/api/admin/bulk-import/items/:id/set-residence',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { residenceId } = setResidenceSchema.parse(req.body);
        const [item] = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.id, req.params.id));
        if (!item) return res.status(404).json({ error: 'Item not found' });
        const existing = (item.branchDecision ?? {}) as Record<string, unknown>;
        if (existing.branch !== 'residence_documents') {
          return res.status(400).json({
            error: 'Residence can only be set on items routed to residence_documents',
          });
        }

        // Validate residenceId belongs to the session's building and org.
        if (residenceId !== null) {
          const session = await loadSession(item.sessionId);
          if (!session) return res.status(404).json({ error: 'Session not found' });
          const canAccess = await canUserAccessOrganization(req.user!.id, session.organizationId);
          if (!canAccess) return res.status(403).json({ error: 'Forbidden' });
          const [residence] = await db
            .select({ id: schema.residences.id, buildingId: schema.residences.buildingId })
            .from(schema.residences)
            .where(eq(schema.residences.id, residenceId));
          if (!residence) return res.status(404).json({ error: 'Residence not found' });
          if (residence.buildingId !== session.buildingId) {
            return res.status(400).json({
              error: 'Residence does not belong to this session\'s building',
            });
          }
        }

        const aiResidenceId = (existing.residenceId as string | null | undefined) ?? null;
        const isManualOverride = residenceId !== aiResidenceId;
        const updated_decision: Record<string, unknown> = {
          ...existing,
          residenceId,
          residenceManualOverride: residenceId !== null ? isManualOverride : false,
        };
        const newStatus = residenceId !== null
          ? 'branched'
          : 'sorted';
        const [updated] = await db
          .update(schema.bulkImportItems)
          .set({
            branchDecision: updated_decision,
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(schema.bulkImportItems.id, item.id))
          .returning();
        return res.json(updated);
      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
        logError('[bulk-import] set-residence failed', err as Error);
        return res.status(500).json({ error: 'Failed to set residence' });
      }
    },
  );

  /**
   * Set (or update) the sorting-step decision for a single item —
   * accept the AI's suggestion, reject it, or commit a manual choice.
   *
   * Actions:
   *   - 'accept'  → marks decisionState='accepted', triggers PDF
   *                 merge/split file operation when the AI chose
   *                 merge or split.
   *   - 'reject'  → clears decisionState to 'rejected' so the UI
   *                 shows the manual picker.
   *   - 'manual'  → saves the caller's own decision with
   *                 manualOverride=true and decisionState='accepted',
   *                 then triggers the same file operation as accept.
   *
   * For merge the two staged PDFs are combined into one using pdf-lib;
   * the surviving item's stagedPath is updated, the merged-away item
   * is excluded (status='rejected').
   * For split the PDF is cut at `splitAtPage`; the original item is
   * updated to pages 1..N and a new sibling item is inserted for
   * pages N+1..end.
   * For keep (or non-PDF) the file is left untouched.
   */
  const setSortingDecisionSchema = z.object({
    action: z.enum(['accept', 'reject', 'manual']),
    decision: z.enum(['keep', 'merge', 'split']).optional(),
    mergeWithItemId: z.string().min(1).optional(),
    mergeWithItemIds: z.string().min(1).array().min(1).optional(),
    splitAtPage: z.number().int().min(1).optional(),
  });
  app.post(
    '/api/admin/bulk-import/items/:id/set-sorting-decision',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { action, decision: manualDecision, mergeWithItemId: manualMergeId, mergeWithItemIds: manualMergeIds, splitAtPage: manualSplitAt } =
          setSortingDecisionSchema.parse(req.body);

        const [item] = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.id, req.params.id));
        if (!item) return res.status(404).json({ error: 'Item not found' });

        const existing = (item.sortingDecision ?? {}) as Record<string, unknown>;

        if (action === 'reject') {
          const updated_decision: Record<string, unknown> = {
            ...existing,
            decisionState: 'rejected',
          };
          const [updated] = await db
            .update(schema.bulkImportItems)
            .set({ sortingDecision: updated_decision, updatedAt: new Date() })
            .where(eq(schema.bulkImportItems.id, item.id))
            .returning();
          return res.json(updated);
        }

        // Determine the effective decision (AI suggestion or caller override)
        const isManual = action === 'manual';
        const effectiveDecision = isManual
          ? (manualDecision ?? 'keep')
          : ((existing.decision as string | null | undefined) ?? 'keep');
        // Ordered list of sibling IDs for N-way merge. Prefer the explicit
        // ordered list; fall back to the single-id field; fall back to whatever
        // the existing decision stored.
        const effectiveMergeIds: string[] | undefined = isManual
          ? (manualMergeIds ?? (manualMergeId ? [manualMergeId] : undefined))
          : (Array.isArray(existing.mergeWithItemIds)
              ? (existing.mergeWithItemIds as string[])
              : (existing.mergeWithItemId as string | null | undefined)
                ? [(existing.mergeWithItemId as string)]
                : undefined);
        const effectiveMergeId = effectiveMergeIds?.[0];
        const effectiveSplitAt = isManual
          ? manualSplitAt
          : (existing.splitAtPage as number | null | undefined);

        const updated_decision: Record<string, unknown> = {
          ...existing,
          decisionState: 'accepted',
          ...(isManual && {
            decision: effectiveDecision,
            mergeWithItemId: effectiveMergeId ?? null,
            mergeWithItemIds: effectiveMergeIds ?? null,
            splitAtPage: effectiveSplitAt ?? null,
            manualOverride: true,
          }),
        };

        const isPdf = (item.mimeType ?? '').toLowerCase() === 'application/pdf';

        // --- MERGE ---
        if (effectiveDecision === 'merge' && effectiveMergeIds && effectiveMergeIds.length > 0 && isPdf) {
          if (!item.stagedPath || !fs.existsSync(item.stagedPath)) {
            return res.status(400).json({ error: 'Staged file missing for this item' });
          }

          const { PDFDocument } = await import('pdf-lib');

          // Load the lead PDF.
          const leadBytes = fs.readFileSync(item.stagedPath);
          const leadPdf = await PDFDocument.load(new Uint8Array(leadBytes), { ignoreEncryption: true });

          // Load and validate each sibling in order, then append.
          const siblingItems: (typeof item)[] = [];
          for (const siblingId of effectiveMergeIds) {
            const [siblingItem] = await db
              .select()
              .from(schema.bulkImportItems)
              .where(eq(schema.bulkImportItems.id, siblingId));
            if (!siblingItem) {
              return res.status(404).json({ error: `Merge target item not found: ${siblingId}` });
            }
            if ((siblingItem.sessionId as string) !== item.sessionId) {
              return res.status(400).json({ error: `Merge target belongs to a different session: ${siblingId}` });
            }
            if ((siblingItem.mimeType ?? '').toLowerCase() !== 'application/pdf') {
              return res.status(400).json({ error: 'Can only merge PDF files together' });
            }
            if (!siblingItem.stagedPath || !fs.existsSync(siblingItem.stagedPath)) {
              return res.status(400).json({ error: `Staged file missing for merge target: ${siblingId}` });
            }
            const sibBytes = fs.readFileSync(siblingItem.stagedPath);
            const sibPdf = await PDFDocument.load(new Uint8Array(sibBytes), { ignoreEncryption: true });
            const indices = Array.from({ length: sibPdf.getPageCount() }, (_, i) => i);
            const copiedPages = await leadPdf.copyPages(sibPdf, indices);
            for (const page of copiedPages) leadPdf.addPage(page);
            siblingItems.push(siblingItem);
          }

          const mergedBytes = Buffer.from(await leadPdf.save());
          const mergedHash = crypto.createHash('sha256').update(mergedBytes).digest('hex');
          const dir = stagingDirFor(item.sessionId);
          const newPath = path.join(dir, `merged_${mergedHash}_${item.originalName}`);
          fs.writeFileSync(newPath, mergedBytes);

          updated_decision.mergeWithItemIds = effectiveMergeIds;
          updated_decision.mergedFromItemIds = effectiveMergeIds;
          // Keep single-id field for backward compat
          if (siblingItems.length === 1) {
            updated_decision.mergedFromItemId = siblingItems[0].id;
          }

          const [updatedItem] = await db
            .update(schema.bulkImportItems)
            .set({
              stagedPath: newPath,
              contentHash: mergedHash,
              sortingDecision: updated_decision,
              updatedAt: new Date(),
            })
            .where(eq(schema.bulkImportItems.id, item.id))
            .returning();

          // Exclude every merged-away sibling with a back-pointer to the lead.
          for (const siblingItem of siblingItems) {
            const siblingDecision: Record<string, unknown> = {
              ...((siblingItem.sortingDecision ?? {}) as Record<string, unknown>),
              decisionState: 'accepted',
              decision: 'merge',
              mergedIntoItemId: item.id,
            };
            await db
              .update(schema.bulkImportItems)
              .set({
                status: 'rejected',
                preExcludeStatus: siblingItem.status,
                sortingDecision: siblingDecision,
                updatedAt: new Date(),
              })
              .where(eq(schema.bulkImportItems.id, siblingItem.id));
          }

          return res.json(updatedItem);
        }

        // --- SPLIT ---
        if (effectiveDecision === 'split' && effectiveSplitAt != null && isPdf) {
          if (!item.stagedPath || !fs.existsSync(item.stagedPath)) {
            return res.status(400).json({ error: 'Staged file missing for this item' });
          }

          const { PDFDocument } = await import('pdf-lib');
          const srcBytes = fs.readFileSync(item.stagedPath);
          const srcDoc = await PDFDocument.load(new Uint8Array(srcBytes), { ignoreEncryption: true });
          const totalPages = srcDoc.getPageCount();
          const splitPage = Math.max(1, Math.min(effectiveSplitAt, totalPages - 1));

          // First part: pages 0..splitPage-1
          const docFirst = await PDFDocument.create();
          const firstIndices = Array.from({ length: splitPage }, (_, i) => i);
          const firstPages = await docFirst.copyPages(srcDoc, firstIndices);
          for (const p of firstPages) docFirst.addPage(p);
          const firstBytes = Buffer.from(await docFirst.save());
          const firstHash = crypto.createHash('sha256').update(firstBytes).digest('hex');

          // Second part: pages splitPage..totalPages-1
          const docSecond = await PDFDocument.create();
          const secondIndices = Array.from({ length: totalPages - splitPage }, (_, i) => i + splitPage);
          const secondPages = await docSecond.copyPages(srcDoc, secondIndices);
          for (const p of secondPages) docSecond.addPage(p);
          const secondBytes = Buffer.from(await docSecond.save());
          const secondHash = crypto.createHash('sha256').update(secondBytes).digest('hex');

          const dir = stagingDirFor(item.sessionId);
          const firstPath = path.join(dir, `split1_${firstHash}_${item.originalName}`);
          const secondName = `split2_${item.originalName}`;
          const secondPath = path.join(dir, `split2_${secondHash}_${item.originalName}`);
          fs.writeFileSync(firstPath, firstBytes);
          fs.writeFileSync(secondPath, secondBytes);

          // Update original item with first part
          updated_decision.splitTotalPages = totalPages;
          updated_decision.splitAtPage = splitPage;
          const [updatedItem] = await db
            .update(schema.bulkImportItems)
            .set({
              stagedPath: firstPath,
              contentHash: firstHash,
              sortingDecision: updated_decision,
              updatedAt: new Date(),
            })
            .where(eq(schema.bulkImportItems.id, item.id))
            .returning();

          // Insert new sibling item for second part
          const siblingDecision: Record<string, unknown> = {
            decision: 'keep',
            reason: 'Created from split',
            confidence: 1,
            decisionState: 'accepted',
            splitFromItemId: item.id,
            splitAtPage: splitPage,
            manualOverride: isManual,
          };
          await db
            .insert(schema.bulkImportItems)
            .values({
              sessionId: item.sessionId,
              originalPath: secondName,
              originalName: secondName,
              stagedPath: secondPath,
              contentHash: secondHash,
              mimeType: item.mimeType,
              fileSize: secondBytes.length,
              status: 'sorted',
              sortingDecision: siblingDecision,
            });

          return res.json(updatedItem);
        }

        // --- KEEP (or no file operation needed) ---
        const [updated] = await db
          .update(schema.bulkImportItems)
          .set({ sortingDecision: updated_decision, updatedAt: new Date() })
          .where(eq(schema.bulkImportItems.id, item.id))
          .returning();
        return res.json(updated);

      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
        logError('[bulk-import] set-sorting-decision failed', err as Error);
        return res.status(500).json({ error: 'Failed to set sorting decision' });
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
              screening: schema.bulkImportItems.screening,
            })
            .from(schema.bulkImportItems)
            .where(eq(schema.bulkImportItems.sessionId, item.sessionId));

          // For the branching retry, fetch the session's building
          // residences so the AI can suggest a concrete residenceId.
          let residences: Array<{ id: string; unitNumber: string }> | undefined;
          if (step === 'branching') {
            const session = await loadSession(item.sessionId);
            if (session?.buildingId) {
              residences = await db
                .select({ id: schema.residences.id, unitNumber: schema.residences.unitNumber })
                .from(schema.residences)
                .where(
                  and(
                    eq(schema.residences.buildingId, session.buildingId),
                    eq(schema.residences.isActive, true),
                  ),
                );
            }
          }

          const updated = await processItemForStep(
            step,
            item,
            sessionItems.map((s) => ({
              id: s.id,
              name: s.name,
              screening: s.screening as Record<string, unknown> | null,
            })),
            residences,
          );
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
        const branchDecision = (item.branchDecision as {
          branch?: string;
          residenceId?: string | null;
        } | null) ?? {};
        const branch = branchDecision.branch ?? 'building_documents';
        const residenceId = branch === 'residence_documents'
          ? (branchDecision.residenceId ?? null)
          : null;

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
            ...(residenceId ? { residenceId } : {}),
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
