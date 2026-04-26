/**
 * Admin Bulk Document Import REST API (Task #451).
 *
 * Every endpoint here is gated to `admin`. Files are streamed onto disk
 * inside a per-session staging directory under the configured
 * bulk-import staging root (see `getBulkImportStagingRoot()` — the
 * `BULK_IMPORT_STAGING_ROOT` env var, defaulting to
 * `process.cwd()/.staging/bulk-import/`) so the user can leave the page
 * and resume — nothing is committed to the real `documents` table
 * until the final "Linking" step accepts the item.
 */
import type { Express, NextFunction, Request, Response } from 'express';
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
import { parsePeriodHint } from '../services/period-hint-parser';
import { documentService } from '../services/document-service';
import { logError, logInfo, logWarn } from '../utils/logger';
import type { BulkImportFallbackReason } from '@shared/schemas/bulk-import';
import { fixLatin1MisdecodeFilename } from '../utils/filenameNormalization';
import { buildContentDisposition } from '../utils/content-disposition';

/**
 * Default staging root used when `BULK_IMPORT_STAGING_ROOT` is not set
 * (Task #1080). Lives under `process.cwd()` so a fresh dev workspace
 * works without any extra configuration.
 */
const DEFAULT_STAGING_ROOT = path.join(process.cwd(), '.staging', 'bulk-import');

/**
 * Resolve the bulk-import staging root (Task #1080). All on-disk
 * helpers — the upload route's multer destination, `stagingDirFor`,
 * `safeRmSession`, `sweepStagingOrphans`, and the per-request path
 * traversal guards — funnel through this one getter so a single
 * `BULK_IMPORT_STAGING_ROOT` env var moves the entire staging tree:
 *
 *   - Ops can point staging at a faster volume (or a tmpfs) without
 *     touching code.
 *   - Tests can point staging at an isolated `mkdtempSync` directory
 *     so a parallel test run cannot have its real staging files swept
 *     by a unit test.
 *
 * Read lazily (per call) instead of cached at module load so a test
 * that flips the env var between cases takes effect immediately
 * without the cost of re-`require()`-ing this large module.
 */
export function getBulkImportStagingRoot(): string {
  const envRoot = process.env.BULK_IMPORT_STAGING_ROOT;
  if (envRoot && envRoot.length > 0) return envRoot;
  return DEFAULT_STAGING_ROOT;
}

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
  screeningPeriodHint: string | null;
  /**
   * True when an admin manually overrode `periodHint` via the inline
   * editor on the Sorting row (Task #997). The flag lives on the
   * screening blob alongside `periodHint` itself; it lets the chip
   * surface a "Manual" tag so admins can tell their override apart
   * from the AI's guess.
   */
  screeningPeriodHintManualOverride: boolean;
} {
  const periodHint =
    json && typeof json.periodHint === 'string' && json.periodHint.length > 0
      ? (json.periodHint as string)
      : null;
  const periodHintManualOverride =
    !!(json && (json as Record<string, unknown>).periodHintManualOverride === true);
  if (!json) {
    return {
      screeningTypeGuess: null,
      screeningBucketGuess: null,
      screeningQaReason: null,
      screeningPeriodHint: null,
      screeningPeriodHintManualOverride: false,
    };
  }
  const qa = json.quickAnalysis as Record<string, unknown> | null | undefined;
  if (!qa) {
    return {
      screeningTypeGuess: null,
      screeningBucketGuess: null,
      screeningQaReason: null,
      screeningPeriodHint: periodHint,
      screeningPeriodHintManualOverride: periodHintManualOverride,
    };
  }
  return {
    screeningTypeGuess: (qa.typeGuess as string | null | undefined) ?? null,
    screeningBucketGuess: (qa.bucketGuess as string | null | undefined) ?? null,
    screeningQaReason: (qa.reason as string | null | undefined) ?? null,
    screeningPeriodHint: periodHint,
    screeningPeriodHintManualOverride: periodHintManualOverride,
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
  const dir = path.join(getBulkImportStagingRoot(), sessionId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeRmSession(sessionId: string): void {
  const dir = path.join(getBulkImportStagingRoot(), sessionId);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    logError('[bulk-import] failed to remove staging dir', err as Error);
  }
}

/**
 * Default age cutoff for the staging janitor's `.upload-tmp-*` sweep
 * (Task #1066). The upload route names every multer temp file
 * `.upload-tmp-<ts>-<pid>-<rand>` and renames it to
 * `<hash>_<originalName>` on success. A temp file older than this
 * cutoff therefore could not belong to any in-flight upload — the route
 * either renamed it long ago or the writer crashed mid-upload — so it
 * is safe to delete. One hour is comfortably longer than the worst-case
 * upload of the 100MB-per-file limit on Replit's network and longer
 * than any HTTP timeout in front of the route.
 */
export const STAGING_TMP_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Default interval between staging-janitor passes (Task #1066). We run
 * once at startup and then on this cadence forever. 15 minutes is
 * frequent enough that even an aggressive misbehaving client cannot let
 * gigabytes accumulate between passes, but rare enough that the
 * `bulk_import_sessions` lookup never adds meaningful load.
 */
export const STAGING_JANITOR_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Walk the bulk-import staging root once and remove orphan files left
 * behind by harder-than-graceful failures (Task #1066). The upload
 * route already cleans up after multer errors, missing-session 404s,
 * and per-file insert failures; this sweep covers the cases the
 * request handler cannot see — the Node process being killed
 * mid-upload, an admin deleting the session row out from under an
 * in-flight upload, etc.
 *
 * Two classes of orphan are removed:
 *   1. `.upload-tmp-*` files older than `maxTmpAgeMs` (default 1 hour).
 *      These are multer temp files whose route handler never got the
 *      chance to rename them to `<hash>_<originalName>`. The age
 *      cutoff is the "no live writer" proxy: no normal upload runs
 *      that long, so a stale temp file means its writer is gone.
 *   2. Whole session directories whose `<sessionId>` has no row in
 *      `bulk_import_sessions`. These accumulate when a session row is
 *      deleted (or never committed) but the staged files outlive it.
 *
 * Returns counters so the caller can decide whether to log the result
 * and so the integration test can assert the sweep did the right work.
 *
 * Best-effort throughout: any per-file or per-dir error is logged and
 * skipped so a single bad inode never aborts the whole pass.
 *
 * Reads the staging root via `getBulkImportStagingRoot()` so tests can
 * isolate the sweep by setting `BULK_IMPORT_STAGING_ROOT` to a
 * `mkdtempSync` directory (Task #1080). The previous per-call
 * `stagingRoot` opt is no longer needed and has been removed.
 */
export async function sweepStagingOrphans(opts?: {
  maxTmpAgeMs?: number;
  now?: number;
}): Promise<{
  removedTmp: number;
  removedSessionDirs: number;
  inspectedDirs: number;
}> {
  const maxTmpAgeMs = opts?.maxTmpAgeMs ?? STAGING_TMP_MAX_AGE_MS;
  const now = opts?.now ?? Date.now();
  const stagingRoot = getBulkImportStagingRoot();
  let removedTmp = 0;
  let removedSessionDirs = 0;
  let inspectedDirs = 0;

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(stagingRoot, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return { removedTmp, removedSessionDirs, inspectedDirs };
    }
    logError('[bulk-import] janitor failed to list staging root', err as Error);
    return { removedTmp, removedSessionDirs, inspectedDirs };
  }

  const sessionDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  if (sessionDirs.length === 0) {
    return { removedTmp, removedSessionDirs, inspectedDirs };
  }

  // Look up which session ids still have a live row. We do a single
  // `IN (...)` query so the janitor's DB cost is O(1) per pass even on
  // a host with hundreds of leftover dirs.
  let liveSessionIds = new Set<string>();
  try {
    const rows = await db
      .select({ id: schema.bulkImportSessions.id })
      .from(schema.bulkImportSessions)
      .where(inArray(schema.bulkImportSessions.id, sessionDirs));
    liveSessionIds = new Set(rows.map((r) => r.id));
  } catch (err) {
    logError(
      '[bulk-import] janitor failed to look up live session ids; skipping pass',
      err as Error,
    );
    return { removedTmp, removedSessionDirs, inspectedDirs };
  }

  for (const dirName of sessionDirs) {
    inspectedDirs++;
    const sessionDir = path.join(stagingRoot, dirName);

    if (!liveSessionIds.has(dirName)) {
      // Whole-session orphan: the session row is gone, so no future
      // request can reference these files. Drop the dir wholesale.
      try {
        await fs.promises.rm(sessionDir, { recursive: true, force: true });
        removedSessionDirs++;
      } catch (err) {
        logError(
          `[bulk-import] janitor failed to remove orphan session dir ${dirName}`,
          err as Error,
        );
      }
      continue;
    }

    // Live session: only sweep stale `.upload-tmp-*` files. Anything
    // named `<hash>_<originalName>` is, by definition, a successfully
    // staged file referenced from a `bulk_import_items` row.
    let files: string[];
    try {
      files = await fs.promises.readdir(sessionDir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') continue;
      logError(
        `[bulk-import] janitor failed to list session dir ${dirName}`,
        err as Error,
      );
      continue;
    }
    for (const fname of files) {
      if (!fname.startsWith('.upload-tmp-')) continue;
      const filePath = path.join(sessionDir, fname);
      try {
        const stat = await fs.promises.stat(filePath);
        if (now - stat.mtimeMs >= maxTmpAgeMs) {
          await fs.promises.unlink(filePath);
          removedTmp++;
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') continue;
        logError(
          `[bulk-import] janitor failed to remove stale temp file ${filePath}`,
          err as Error,
        );
      }
    }
  }

  return { removedTmp, removedSessionDirs, inspectedDirs };
}

let stagingJanitorTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the staging janitor (Task #1066): runs `sweepStagingOrphans`
 * once on startup and then on a recurring interval. Idempotent — a
 * second call is a no-op so a hot-reload during development cannot
 * stack timers. Uses `unref()` so the timer never keeps the Node
 * process alive on its own.
 */
export function startStagingJanitor(
  intervalMs: number = STAGING_JANITOR_INTERVAL_MS,
): void {
  void runStagingJanitorOnce();
  if (stagingJanitorTimer) return;
  stagingJanitorTimer = setInterval(() => {
    void runStagingJanitorOnce();
  }, intervalMs);
  if (typeof stagingJanitorTimer.unref === 'function') {
    stagingJanitorTimer.unref();
  }
}

/**
 * Stop the staging janitor. Used on graceful shutdown and by tests
 * that need a deterministic teardown.
 */
export function stopStagingJanitor(): void {
  if (stagingJanitorTimer) {
    clearInterval(stagingJanitorTimer);
    stagingJanitorTimer = null;
  }
}

async function runStagingJanitorOnce(): Promise<void> {
  try {
    const r = await sweepStagingOrphans();
    if (r.removedTmp > 0 || r.removedSessionDirs > 0) {
      logInfo('[bulk-import] staging janitor swept orphan files', {
        metadata: {
          removedTmp: r.removedTmp,
          removedSessionDirs: r.removedSessionDirs,
          inspectedDirs: r.inspectedDirs,
        },
      });
    }
  } catch (err) {
    logError('[bulk-import] staging janitor crashed', err as Error);
  }
}

function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Stream-hash a file already on disk and return the same SHA-256 digest
 * the previous `sha256(buffer)` path produced. Used by the bulk-import
 * upload route after switching multer from in-memory storage to disk
 * storage (Task #1061): we no longer hold the full file bytes in the
 * Node heap, so the hash has to be computed off the staged file.
 */
function sha256File(filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => reject(err));
    stream.on('data', (chunk) => hash.update(chunk as Buffer));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
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

/**
 * Multer storage for the bulk-import upload route. Streams every file
 * straight to the per-session staging directory under a temporary name
 * (Task #1061). The previous `multer.memoryStorage()` setup buffered
 * every uploaded file in the Node heap, so a normal-sized batch of
 * 30+ scanned PDFs around 20–50 MB each could exhaust container memory
 * and kill the process — which surfaced to the wizard as 502s on the
 * `/sessions/:id/lite` poll and on the inline `/items/:id/file`
 * preview while the proxy bridged the gap until the server restarted.
 *
 * Disk-streaming caps RAM use at one chunk per in-flight file plus
 * normal request overhead, regardless of batch size. The route handler
 * later stream-hashes the temp file with `sha256File()` and renames it
 * to the final `<hash>_<originalName>` path the rest of the codebase
 * already reads from (preview, page-count, split, merge, accept,
 * retry).
 */
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        // `req.params` is populated by Express before any middleware in
        // the route chain runs, so the session id from
        // `/sessions/:id/items` is already available here.
        const sessionId = (req.params as { id?: string } | undefined)?.id;
        if (!sessionId || typeof sessionId !== 'string') {
          return cb(new Error('Missing session id for upload destination'), '');
        }
        const dir = stagingDirFor(sessionId);
        cb(null, dir);
      } catch (err) {
        cb(err as Error, '');
      }
    },
    filename: (_req, _file, cb) => {
      // Temp name; we rename to `<hash>_<originalName>` in the route
      // handler once the file's SHA-256 is known. The leading dot keeps
      // the temp file out of any naive directory listings, and the
      // random suffix avoids collisions across concurrent uploads.
      const tmpName = `.upload-tmp-${Date.now()}-${process.pid}-${crypto
        .randomBytes(8)
        .toString('hex')}`;
      cb(null, tmpName);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per file
  fileFilter: (_req, file, cb) => {
    if (isZipFile(file)) {
      cb(null, false);
    } else {
      cb(null, true);
    }
  },
});

/**
 * Wraps the bulk-import `upload.array(...)` middleware so that any
 * multer error (file too large, disk write failure, missing session id)
 * cleans up partial files multer wrote to the staging dir before
 * forwarding the error to the default Express error path. The previous
 * in-memory storage left no on-disk artifacts on a failed upload; with
 * disk storage we must not leak half-written files into the staging
 * directory the rest of the bulk-import flow reads from.
 */
function uploadBulkImportFiles(req: Request, res: Response, next: NextFunction): void {
  upload.array('files', 200)(req, res, (err: unknown) => {
    if (err) {
      const partial = (req.files as Express.Multer.File[] | undefined) ?? [];
      for (const f of partial) {
        if (f && typeof f.path === 'string') {
          try {
            if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
          } catch (cleanupErr) {
            logError(
              '[bulk-import] failed to remove partial upload after multer error',
              cleanupErr as Error,
            );
          }
        }
      }
      return next(err);
    }
    next();
  });
}

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
 * Short-lived in-memory cache for `getFiscalYearStartMonthForBuilding`
 * (Task #1040). The bulk-import flow calls the helper from three places —
 * the run-all loop, the per-item retry endpoint, and the commit endpoint —
 * and each per-item HTTP call would otherwise re-query `buildings` even
 * though the column changes very rarely. A small TTL keeps the cache
 * correct against admin edits without requiring explicit invalidation.
 *
 * `undefined` results are cached the same way as numbers so a missing /
 * malformed `financialYearStart` doesn't trigger a query on every retry.
 */
export const FISCAL_YEAR_START_MONTH_CACHE_TTL_MS = 60_000;
const fiscalYearStartMonthCache = new Map<
  string,
  { value: number | undefined; expiresAt: number }
>();

/**
 * Test-only helper: reset the per-process cache between test cases so
 * one test's fixture doesn't leak into the next.
 */
export function __resetFiscalYearStartMonthCacheForTests(): void {
  fiscalYearStartMonthCache.clear();
}

/**
 * Resolve the building's fiscal-year-start month (1-indexed) from a session's
 * `buildingId`, for feeding into `parsePeriodHint` (Task #1030). Returns
 * `undefined` when the building cannot be loaded, has no `financialYearStart`,
 * or the stored value isn't a parseable `YYYY-MM-DD` string — in which case
 * the parser falls back to its January default.
 *
 * `buildings.financialYearStart` is a Drizzle `date` column whose JS
 * representation is a `YYYY-MM-DD` string, so we extract the month with a
 * lightweight regex instead of constructing a Date (avoids local-timezone
 * shifts on dates like `2024-01-01`).
 *
 * Results are memoized in `fiscalYearStartMonthCache` for
 * `FISCAL_YEAR_START_MONTH_CACHE_TTL_MS` so a burst of per-item retries or
 * commits within the same import session hits the DB at most once per
 * building (Task #1040).
 */
export async function getFiscalYearStartMonthForBuilding(
  buildingId: string | null | undefined,
): Promise<number | undefined> {
  if (!buildingId) return undefined;
  const now = Date.now();
  const cached = fiscalYearStartMonthCache.get(buildingId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  const [row] = await db
    .select({ financialYearStart: schema.buildings.financialYearStart })
    .from(schema.buildings)
    .where(eq(schema.buildings.id, buildingId));
  const raw = row?.financialYearStart;
  let value: number | undefined;
  if (raw) {
    const match = /^\d{4}-(\d{2})-\d{2}/.exec(String(raw));
    if (match) {
      const month = parseInt(match[1], 10);
      if (Number.isInteger(month) && month >= 1 && month <= 12) {
        value = month;
      }
    }
  }
  fiscalYearStartMonthCache.set(buildingId, {
    value,
    expiresAt: now + FISCAL_YEAR_START_MONTH_CACHE_TTL_MS,
  });
  return value;
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
 *     finishedAt, inFlight }` — so refreshing the page (or hopping to
 *     another admin tab) shows the same "X of Y processed…" line plus
 *     which files are currently being analyzed (Task #898).
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

/**
 * Task #1068 — Statuses considered "already past" a given AI step. These
 * are the rows the per-step "Retry step from scratch" reset endpoint
 * reverts back to the pre-step status. Excluded (`rejected`),
 * committed (`committed`) and duplicate (`duplicate`) items are
 * intentionally left out so the reset never disturbs admin-curated
 * exclusions or already-promoted documents.
 */
const STEP_RESET_STATUSES: Record<AutoStep, schema.BulkImportItem['status'][]> = {
  screening: ['screened', 'sorted', 'branched', 'identified', 'linked'],
  sorting: ['sorted', 'branched', 'identified', 'linked'],
  branching: ['branched', 'identified', 'linked'],
  identification: ['identified', 'linked'],
  linking: ['linked'],
};

/**
 * Task #1068 — Pre-step status each AI step starts from. Used by the
 * reset-step endpoint to put an item back where the run-all loop will
 * pick it up again on its next iteration.
 */
const STEP_PRE_STATUS: Record<AutoStep, schema.BulkImportItem['status']> = {
  screening: 'pending',
  sorting: 'screened',
  branching: 'sorted',
  identification: 'branched',
  linking: 'identified',
};

/**
 * Maximum number of items processed concurrently per run-all loop
 * (Task #898). Conservative to stay under Anthropic rate limits.
 */
const RUN_ALL_CONCURRENCY = 4;

/**
 * Per-item time budget for the AI analyzer call (Task #898).
 * A single hung request no longer blocks the whole batch — after this
 * deadline the item is recorded as a failure and the loop moves on.
 */
const RUN_ALL_ITEM_TIMEOUT_MS = 90_000; // 90 seconds

/**
 * Minimum interval between heartbeat DB writes when concurrency is
 * high (Task #898). Prevents dozens of writes/second on large batches.
 */
const RUN_ALL_HEARTBEAT_THROTTLE_MS = 800;

export const inFlightRunAll = new Set<string>();

/**
 * Per-item retry coordination (Task #1047).
 *
 * The per-row "Retry" button on the Bulk Document Import wizard used to
 * `await processItemForStep(...)` inside the HTTP request handler. When
 * the underlying Anthropic call was slow or had to retry internally, a
 * single retry could sit longer than the Replit edge proxy's HTTP
 * timeout (~60s) and the proxy would close the connection with `502
 * Bad Gateway` even though the server was still working. The user saw
 * a confusing "Bad Gateway" toast on a page that was otherwise just
 * waiting for AI work.
 *
 * The fix mirrors the run-all background pattern: the retry endpoint
 * schedules `processItemForStep` fire-and-forget, records the item as
 * in-flight in the same `runAll[step].inFlight` shape the wizard
 * already polls, and returns the current item snapshot immediately.
 * The polling loop then picks up the new state once the background
 * task settles.
 *
 * `inFlightPerItemRetry` keys on `${itemId}:${step}` so two retries on
 * the same item+step short-circuit, but a retry on a different step
 * for the same item (rare but possible across step navigations) does
 * not block.
 */
export const inFlightPerItemRetry = new Set<string>();

function perItemRetryKey(itemId: string, step: AutoStep): string {
  return `${itemId}:${step}`;
}

/**
 * Append an item to the session's `runAll[step].inFlight` list so the
 * polling UI shows the same spinner it shows for the run-all loop
 * (Task #1047). Idempotent — calling twice for the same item is a
 * no-op so we never duplicate entries on retry-during-retry races.
 */
async function addPerItemRetryInFlight(
  sessionId: string,
  step: AutoStep,
  item: { id: string; originalName: string },
): Promise<void> {
  const session = await loadSession(sessionId);
  if (!session) return;
  const runAll = getRunAllMap(session.progress);
  const current = runAll[step] ?? {
    total: 0,
    processed: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    inFlight: [],
  };
  const existingInFlight = current.inFlight ?? [];
  if (existingInFlight.some((e) => e.itemId === item.id)) return;
  runAll[step] = {
    ...current,
    inFlight: [...existingInFlight, { itemId: item.id, originalName: item.originalName }],
  };
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
 * Remove an item from the session's `runAll[step].inFlight` list once
 * its background retry settles (Task #1047). Best-effort: if the
 * session was cleared mid-flight the row is gone and we silently no-op.
 */
async function removePerItemRetryInFlight(
  sessionId: string,
  step: AutoStep,
  itemId: string,
): Promise<void> {
  const session = await loadSession(sessionId);
  if (!session) return;
  const runAll = getRunAllMap(session.progress);
  const current = runAll[step];
  if (!current?.inFlight?.length) return;
  const nextInFlight = current.inFlight.filter((e) => e.itemId !== itemId);
  if (nextInFlight.length === current.inFlight.length) return;
  runAll[step] = { ...current, inFlight: nextInFlight };
  const nextProgress = {
    ...((session.progress ?? {}) as Record<string, unknown>),
    runAll,
  };
  await db
    .update(schema.bulkImportSessions)
    .set({ progress: nextProgress, updatedAt: new Date() })
    .where(eq(schema.bulkImportSessions.id, sessionId));
}

interface RunAllProgress {
  total: number;
  processed: number;
  failed: number;
  startedAt: string;
  finishedAt: string | null;
  /** Items currently being analyzed (Task #898). Cleared when done. */
  inFlight?: Array<{ itemId: string; originalName: string }>;
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
 * Wrap a promise with a per-item time budget (Task #898). On timeout
 * rejects with a descriptive error so the caller can increment `failed`
 * and continue the batch without blocking indefinitely.
 * Exported for unit tests.
 */
export function withItemTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let handle: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(
      () => reject(new Error(`[bulk-import] item timed out after ${ms}ms: ${label}`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(handle));
}

/**
 * Check the "trivially keep" pre-conditions for the sorting step
 * (Task #898, updated Task #955). Returns true when the item does not
 * need an AI call:
 *   1. Screening said isMultiDocument === false (explicit false, not null)
 *   2. No sibling in the session is a plausible same-document partner:
 *      - Either no sibling shares the same typeGuess + bucketGuess, OR
 *      - All type+bucket-matching siblings have a non-null periodHint that
 *        clearly differs from this item's periodHint (Task #955 extension).
 *        When either side has a null periodHint the comparison is
 *        inconclusive, so the AI call is NOT skipped for that sibling.
 *
 * Exported for unit tests.
 */
export function isTriviallyKeep(
  myScreening: Record<string, unknown> | null | undefined,
  allItems: Array<{ id: string; screening?: Record<string, unknown> | null | undefined }>,
  itemId: string,
): boolean {
  const myIsMultiDocument = typeof myScreening?.isMultiDocument === 'boolean'
    ? myScreening.isMultiDocument
    : null;
  if (myIsMultiDocument !== false) return false;

  const myQa = myScreening?.quickAnalysis as QuickAnalysis | null | undefined;
  if (!myQa?.typeGuess || !myQa?.bucketGuess) return false;

  const myPeriodHint = typeof myScreening?.periodHint === 'string'
    ? myScreening.periodHint
    : null;

  const hasMergeCandidate = allItems.some((s) => {
    if (s.id === itemId) return false;
    const sc = s.screening as Record<string, unknown> | null | undefined;
    const qa = sc?.quickAnalysis as QuickAnalysis | null | undefined;
    if (
      qa === null ||
      qa === undefined ||
      qa.typeGuess !== myQa!.typeGuess ||
      qa.bucketGuess !== myQa!.bucketGuess
    ) {
      return false;
    }
    // type+bucket match — check period hints. If BOTH sides have a
    // non-null periodHint that differs, the sibling covers a different
    // period and cannot be a merge candidate (Task #955). When either
    // side has null periodHint we fall through to the AI (conservative).
    const sibPeriodHint = typeof sc?.periodHint === 'string' ? sc.periodHint : null;
    if (myPeriodHint !== null && sibPeriodHint !== null && myPeriodHint !== sibPeriodHint) {
      return false;
    }
    return true;
  });
  return !hasMergeCandidate;
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
 * Persist a step-appropriate fallback decision when an item times out in
 * the run-all worker pool (Task #898). This ensures the row advances to
 * the terminal status for that step with `fallbackReason: 'api_error'` so
 * the admin UI shows the error badge and the per-item Retry button.
 *
 * If the background promise later resolves successfully it will overwrite
 * this fallback with the real AI result — that is intentional and
 * preferable to leaving the item stuck in its pre-step status.
 */
async function persistTimeoutFallback(step: AutoStep, item: schema.BulkImportItem): Promise<void> {
  const FR = 'api_error' as const;
  if (step === 'screening') {
    await db
      .update(schema.bulkImportItems)
      .set({
        screening: {
          suggestedFilename: item.originalName,
          confidence: 0,
          fallbackReason: FR,
          isMultiDocument: false,
          rotationDegrees: 0,
          rotationApplied: false,
        },
        status: 'screened',
        updatedAt: new Date(),
      })
      .where(eq(schema.bulkImportItems.id, item.id));
    return;
  }
  if (step === 'sorting') {
    await db
      .update(schema.bulkImportItems)
      .set({
        sortingDecision: {
          decision: 'keep',
          reason: 'AI timeout — defaulting to keep',
          confidence: 0,
          fallbackReason: FR,
          decisionState: 'pending',
        },
        status: 'sorted',
        updatedAt: new Date(),
      })
      .where(eq(schema.bulkImportItems.id, item.id));
    return;
  }
  if (step === 'branching') {
    await db
      .update(schema.bulkImportItems)
      .set({
        branchDecision: {
          branch: 'building_documents',
          subCategory: 'other_documents',
          confidence: 0,
          fallbackReason: FR,
          residenceManualOverride: false,
          residenceAiSuggestedId: null,
          residenceAiConfirmed: false,
        },
        status: 'branched',
        updatedAt: new Date(),
      })
      .where(eq(schema.bulkImportItems.id, item.id));
    return;
  }
  if (step === 'identification') {
    await db
      .update(schema.bulkImportItems)
      .set({
        identification: { typeGuess: null, confidence: 0, fallbackReason: FR },
        status: 'identified',
        updatedAt: new Date(),
      })
      .where(eq(schema.bulkImportItems.id, item.id));
    return;
  }
  // linking
  await db
    .update(schema.bulkImportItems)
    .set({
      linkDecisions: { links: [], confidence: 0, fallbackReason: FR },
      status: 'linked',
      updatedAt: new Date(),
    })
    .where(eq(schema.bulkImportItems.id, item.id));
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
  /**
   * Building's fiscal-year-start month (1-indexed), used by the identification
   * step to interpret fiscal-year periodHint ranges correctly (Task #1030).
   * Caller is responsible for resolving it once per session and passing it
   * here to avoid redundant DB lookups in the run-all loop.
   */
  fiscalYearStartMonth?: number,
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
        const periodHint = typeof sc?.periodHint === 'string' ? sc.periodHint : null;
        return { id: s.id, name: s.name, quickAnalysis: qa ?? null, periodHint };
      });

    const myScreening = item.screening as Record<string, unknown> | null | undefined;
    const myQa = myScreening?.quickAnalysis as QuickAnalysis | null | undefined;
    const myIsMultiDocument = typeof myScreening?.isMultiDocument === 'boolean'
      ? myScreening.isMultiDocument
      : null;
    const myPeriodHint = typeof myScreening?.periodHint === 'string' ? myScreening.periodHint : null;

    // Trivially-keep short-circuit (Task #898): skip the AI call when
    // Screening said isMultiDocument=false AND no sibling shares this
    // file's typeGuess+bucketGuess. Both conditions must be true for the
    // short-circuit to fire; either false falls through to the AI.
    if (isTriviallyKeep(myScreening, sessionItems, item.id)) {
      const trivialResult: Record<string, unknown> = {
        decision: 'keep',
        reason: 'No merge candidates and not multi-document',
        confidence: 1,
        fallbackReason: null,
        decisionState: 'pending',
      };
      const [updated] = await db
        .update(schema.bulkImportItems)
        .set({
          sortingDecision: trivialResult,
          status: 'sorted',
          updatedAt: new Date(),
        })
        .where(eq(schema.bulkImportItems.id, item.id))
        .returning();
      return updated;
    }

    const result = await bulkImportAnalyzer.suggestMergeOrSplit({
      originalName: item.originalName,
      siblings,
      quickAnalysis: myQa ?? null,
      isMultiDocument: myIsMultiDocument,
      periodHint: myPeriodHint,
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
    // Track the AI's original residence pick (Task #803) so the picker
    // UI can surface a small "AI suggestion" chip even after the admin
    // saves it. `residenceAiSuggestedId` survives admin overrides so we
    // can still tell that the AI did make a guess; `residenceAiConfirmed`
    // is flipped to true once the admin explicitly accepts the AI pick
    // (per-row Save with the AI value, or the bulk-confirm endpoint).
    const nextDecision: Record<string, unknown> = {
      ...result,
      residenceManualOverride: existingDecision.residenceManualOverride ?? false,
      residenceAiSuggestedId:
        result.branch === 'residence_documents' && result.residenceId
          ? result.residenceId
          : null,
      residenceAiConfirmed: false,
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
    const rawPeriodHint =
      (item.screening as { periodHint?: string | null } | null)?.periodHint ?? null;
    // Task #1030: pass the building's fiscal-year-start month so a
    // periodHint like "FY 2022-2023" on a building with an April fiscal
    // year resolves to 2022-04-01 instead of 2022-01-01.
    const periodHintDate = parsePeriodHint(rawPeriodHint, fiscalYearStartMonth);
    const result = await bulkImportAnalyzer.identify({
      originalName: item.originalName,
      description,
      branch,
      stagedPath: item.stagedPath,
      mimeType: item.mimeType,
      itemId: item.id,
      sessionId: item.sessionId,
      periodHintDate,
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

    // Task #1030: resolve the building's fiscal-year-start month once for
    // the identification loop, so every periodHint that names a fiscal-year
    // range is parsed against the building's actual fiscal calendar.
    let sessionFiscalYearStartMonth: number | undefined;
    if (step === 'identification') {
      const session = await loadSession(sessionId);
      sessionFiscalYearStartMonth = await getFiscalYearStartMonthForBuilding(
        session?.buildingId ?? null,
      );
    }

    await patchRunAllProgress(sessionId, step, {
      total: eligible.length,
      processed: 0,
      failed: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      inFlight: [],
    });

    if (eligible.length === 0) {
      await patchRunAllProgress(sessionId, step, {
        finishedAt: new Date().toISOString(),
        inFlight: [],
      });
      return;
    }

    // Concurrent worker pool (Task #898). All state mutated below is
    // done synchronously between await-points, so no mutex is needed.
    let processed = 0;
    let failed = 0;
    const currentInFlight = new Map<string, string>(); // itemId → originalName
    const queue = [...eligible];
    let lastFlushTime = 0;

    // rawInFlight counts the number of outstanding processItemForStep() promises,
    // including ones whose logical worker slot has already moved on after a
    // timeout. This is the key safety valve: workers must wait for a slot here
    // before creating a new promise, so total concurrent AI calls never exceeds
    // RUN_ALL_CONCURRENCY regardless of how many items have timed out.
    let rawInFlight = 0;

    // Throttled heartbeat: persist current counters + inFlight list.
    // `force=true` bypasses the throttle for the final flush.
    async function flushHeartbeat(force = false): Promise<void> {
      const now = Date.now();
      if (!force && now - lastFlushTime < RUN_ALL_HEARTBEAT_THROTTLE_MS) return;
      lastFlushTime = now;
      await patchRunAllProgress(sessionId, step, {
        processed,
        failed,
        inFlight: Array.from(currentInFlight.entries()).map(
          ([itemId, originalName]) => ({ itemId, originalName }),
        ),
      });
    }

    // Each worker drains the shared queue until it is empty or the
    // session is cancelled. Cooperative cancellation (Task #593):
    // clearing the session removes the key from `inFlightRunAll`.
    async function worker(): Promise<void> {
      while (true) {
        if (!inFlightRunAll.has(key)) break;

        // Semaphore gate: ensure rawInFlight < RUN_ALL_CONCURRENCY before
        // dequeuing. After a timeout the old promise is still counted, so a
        // replacement item will wait here until that slot is freed. The 50 ms
        // poll is fine because timeouts are already at 90 s granularity.
        while (rawInFlight >= RUN_ALL_CONCURRENCY) {
          await new Promise<void>((r) => setTimeout(r, 50));
          if (!inFlightRunAll.has(key)) return; // cancelled while waiting
        }

        // queue.shift(), rawInFlight++ and currentInFlight.set() are all
        // synchronous (no await between them) so they are mutually exclusive
        // with other workers under JS's cooperative scheduler.
        const item = queue.shift();
        if (!item) break;
        rawInFlight++;
        currentInFlight.set(item.id, item.originalName);
        await flushHeartbeat();

        // workPromise runs the real AI call. Its .finally() decrements
        // rawInFlight so the semaphore gate above will unblock when the
        // underlying network call completes (even if we timed out).
        const workPromise = processItemForStep(
          step,
          item,
          sessionItems,
          sessionResidences,
          sessionFiscalYearStartMonth,
        );
        void workPromise
          .finally(() => { rawInFlight--; })
          .catch((e) =>
            logError('[bulk-import] background work error after timeout', e as Error),
          );

        try {
          await withItemTimeout(workPromise, RUN_ALL_ITEM_TIMEOUT_MS, item.originalName);
        } catch (err) {
          failed += 1;
          const isTimeout = (err as Error).message?.includes('timed out');
          logError(
            `[bulk-import] run-all ${step} ${isTimeout ? 'timeout' : 'error'} for item ${item.id}`,
            err as Error,
          );
          if (isTimeout) {
            // Persist a step-appropriate fallback so the UI shows the
            // error badge immediately; if the background promise later
            // resolves it will overwrite with the real AI result.
            void persistTimeoutFallback(step, item).catch((e) =>
              logError('[bulk-import] persistTimeoutFallback failed', e as Error),
            );
          }
        }
        processed += 1;
        currentInFlight.delete(item.id);
        await flushHeartbeat();
      }
    }

    // Launch up to RUN_ALL_CONCURRENCY workers in parallel.
    const concurrency = Math.min(RUN_ALL_CONCURRENCY, eligible.length);
    await Promise.all(Array.from({ length: concurrency }, worker));

    // Force-flush final authoritative counters before marking done.
    // Throttled heartbeats may have left processed/failed stale for fast
    // batches (especially when trivially-keep short-circuits dominate).
    await patchRunAllProgress(sessionId, step, {
      processed,
      failed,
      finishedAt: new Date().toISOString(),
      inFlight: [],
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
          finalFileName: schema.bulkImportItems.finalFileName,
          contentHash: schema.bulkImportItems.contentHash,
          screening: schema.bulkImportItems.screening,
          sortingDecision: schema.bulkImportItems.sortingDecision,
          branchDecision: schema.bulkImportItems.branchDecision,
          identification: schema.bulkImportItems.identification,
          linkDecisions: schema.bulkImportItems.linkDecisions,
        })
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.sessionId, session.id));

      // Task #1002: Resolve the linked document for duplicate items so the
      // wizard can show "Already in Koveo" with the document's name and
      // location. Only queried for rows whose status is `duplicate`, which
      // are a small subset of the full list.
      const duplicateHashes = rows
        .filter((r) => r.status === 'duplicate')
        .map((r) => r.contentHash);

      // Map contentHash → enriched duplicate info.
      type DuplicateInfo = {
        documentId: string | null;
        documentName: string | null;
        buildingId: string | null;
        buildingName: string | null;
        residenceLabel: string | null;
        documentType: string | null;
        removed: boolean;
      };
      const duplicateInfoByHash = new Map<string, DuplicateInfo>();

      if (duplicateHashes.length > 0) {
        const fpRows = await db
          .select({
            contentHash: schema.clientDocumentFingerprints.contentHash,
            finalDocumentId: schema.clientDocumentFingerprints.finalDocumentId,
            docName: schema.documents.name,
            docType: schema.documents.documentType,
            buildingId: schema.buildings.id,
            buildingName: schema.buildings.name,
            residenceUnitNumber: schema.residences.unitNumber,
            residenceId: schema.documents.residenceId,
          })
          .from(schema.clientDocumentFingerprints)
          .leftJoin(
            schema.documents,
            eq(schema.clientDocumentFingerprints.finalDocumentId, schema.documents.id),
          )
          .leftJoin(
            schema.buildings,
            eq(schema.documents.buildingId, schema.buildings.id),
          )
          .leftJoin(
            schema.residences,
            eq(schema.documents.residenceId, schema.residences.id),
          )
          .where(
            and(
              eq(schema.clientDocumentFingerprints.organizationId, session.organizationId),
              inArray(schema.clientDocumentFingerprints.contentHash, duplicateHashes),
            ),
          );

        for (const fp of fpRows) {
          // The `finalDocumentId` FK is ON DELETE SET NULL, so a deleted
          // document leaves `finalDocumentId = null` on the fingerprint row.
          // When finalDocumentId is null the linked document has been removed.
          const removed = fp.finalDocumentId === null;
          duplicateInfoByHash.set(fp.contentHash, {
            documentId: fp.finalDocumentId ?? null,
            documentName: fp.docName ?? null,
            buildingId: fp.buildingId ?? null,
            buildingName: fp.buildingName ?? null,
            residenceLabel: fp.residenceUnitNumber ?? null,
            documentType: fp.docType ?? null,
            removed,
          });
        }
      }

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
          splitIntoItemIds: null,
          draft: false,
          splitFinalNames: null,
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
        const splitIntoItemIds = Array.isArray(json.splitIntoItemIds)
          ? (json.splitIntoItemIds as string[])
          : null;
        const draft = (json.draft as boolean | null | undefined) ?? false;
        const splitFinalNames = Array.isArray(json.splitFinalNames) && json.splitFinalNames.length === 2
          ? (json.splitFinalNames as [string, string])
          : null;
        return { ...base, decision, reason, mergeWithItemId, mergeWithItemIds, splitAtPage, decisionState, manualOverride, splitIntoItemIds, draft, splitFinalNames };
      }

      function extractIdentificationStep(json: Record<string, unknown> | null | undefined) {
        const base = extractStep(json);
        if (!json) return {
          ...base,
          name: null,
          description: null,
          tags: null,
          effectiveDate: null,
          effectiveDateManualOverride: false,
        };
        return {
          ...base,
          name: (json.name as string | null | undefined) ?? null,
          description: (json.description as string | null | undefined) ?? null,
          tags: Array.isArray(json.tags) ? (json.tags as string[]) : null,
          effectiveDate: (json.effectiveDate as string | null | undefined) ?? null,
          // Task #1031: surface the manual-override marker so the UI can
          // hide the "from screening" annotation once the admin has
          // typed a date of their own.
          effectiveDateManualOverride: json.effectiveDateManualOverride === true,
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
          residenceAiSuggestedId: null,
          residenceAiSuggested: false,
          residenceAiConfirmed: false,
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
        // Task #803: surface the AI's original residence pick so the
        // picker UI can render a "AI suggestion" chip while the admin
        // hasn't yet confirmed it. `residenceAiSuggested` is true when
        // the current pick still matches the AI's guess and the admin
        // hasn't explicitly confirmed it (per-row Save with the AI
        // value, or bulk-confirm) and hasn't manually overridden it.
        const residenceAiSuggestedId =
          (json.residenceAiSuggestedId as string | null | undefined) ?? null;
        const residenceAiConfirmed =
          (json.residenceAiConfirmed as boolean | null | undefined) ?? false;
        const residenceAiSuggested =
          residenceAiSuggestedId !== null
          && residenceAiSuggestedId === residenceId
          && !residenceAiConfirmed
          && !residenceManualOverride;
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
          residenceAiSuggestedId,
          residenceAiSuggested,
          residenceAiConfirmed,
        };
      }

      // Task #1063: resolve the building's fiscal-year-start month once per
      // request so the Sorting Period picker prefill (`screeningParsedPeriodHintDate`)
      // matches the commit-time path. Without this a fiscal-year hint like
      // "2025-2026" on an April-start building would resolve to Jan 1 in the
      // picker but Apr 1 at commit, contradicting Task #1060's "Done looks like".
      const liteFiscalYearStartMonth = await getFiscalYearStartMonthForBuilding(
        session.buildingId,
      );

      const items = rows.map((r) => {
        const dupeInfo = r.status === 'duplicate'
          ? (duplicateInfoByHash.get(r.contentHash) ?? null)
          : null;
        return {
          id: r.id,
          originalName: r.originalName,
          mimeType: r.mimeType,
          status: r.status,
          preExcludeStatus: r.preExcludeStatus,
          excludeSource: r.excludeSource,
          finalFileName: r.finalFileName ?? null,
          // Task #1002: enriched duplicate info (null for non-duplicate items).
          duplicateOfDocumentId: dupeInfo?.documentId ?? null,
          duplicateOfDocumentName: dupeInfo?.documentName ?? null,
          duplicateOfBuildingId: dupeInfo?.buildingId ?? null,
          duplicateOfBuildingName: dupeInfo?.buildingName ?? null,
          duplicateOfResidenceLabel: dupeInfo?.residenceLabel ?? null,
          duplicateOfDocumentType: dupeInfo?.documentType ?? null,
          duplicateOfDocumentRemoved: dupeInfo?.removed ?? false,
          ...(() => {
            const sc = extractStep(r.screening);
            const sqaFields = extractScreeningQuickAnalysisFields(r.screening);
            const srot = extractScreeningRotation(r.screening);
            const so = extractSortingStep(r.sortingDecision);
            const br = extractBranchStep(r.branchDecision);
            const id = extractIdentificationStep(r.identification);
            const lk = extractLinkingStep(r.linkDecisions);
            // Task #1003: expose the parsed form of periodHint so the UI can show
            // a "from screening" annotation when identification has no effectiveDate.
            const rawPh = sqaFields.screeningPeriodHint;
            // Task #1063: pass the building's fiscal-year-start month so a
            // fiscal-year hint like "2025-2026" on an April-start building
            // resolves to 2025-04-01 instead of 2025-01-01.
            const parsedPhDate = parsePeriodHint(rawPh, liteFiscalYearStartMonth);
            const screeningParsedPeriodHintDate = parsedPhDate
              ? parsedPhDate.toISOString().slice(0, 10)
              : null;
            return {
              screeningConfidence: sc.confidence,
              screeningFallback: sc.fallbackReason,
              ...sqaFields,
              screeningParsedPeriodHintDate,
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
              sortingDecisionSplitIntoItemIds: so.splitIntoItemIds,
              sortingDecisionDraft: so.draft,
              sortingDecisionSplitFinalNames: so.splitFinalNames,
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
              residenceAiSuggestedId: br.residenceAiSuggestedId,
              residenceAiSuggested: br.residenceAiSuggested,
              residenceAiConfirmed: br.residenceAiConfirmed,
              identificationConfidence: id.confidence,
              identificationFallback: id.fallbackReason,
              identificationName: id.name,
              identificationDescription: id.description,
              identificationTags: id.tags,
              identificationEffectiveDate: id.effectiveDate,
              identificationEffectiveDateManualOverride: id.effectiveDateManualOverride,
              linkingConfidence: lk.confidence,
              linkingFallback: lk.fallbackReason,
              linkingReason: lk.linkingReason,
              linkingBeforeItemId: lk.beforeItemId,
              linkingAfterItemId: lk.afterItemId,
            };
          })(),
        };
      });

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
      // Task #1047: also drop any per-item retry markers that belong
      // to items in this session. The keys are `${itemId}:${step}` so
      // we look up this session's item ids first and clear matching
      // markers. The background tasks themselves can't be aborted
      // mid-AI-call, but their final UPDATE will be a no-op once the
      // item rows are deleted below — so dropping the marker here just
      // keeps the in-process Set tidy.
      const sessionItemIds = await db
        .select({ id: schema.bulkImportItems.id })
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.sessionId, session.id));
      for (const { id } of sessionItemIds) {
        for (const key of inFlightPerItemRetry) {
          if (key.startsWith(`${id}:`)) inFlightPerItemRetry.delete(key);
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
      // Task #1047: also drop per-item retry markers for this session's
      // items (see the matching comment in the soft-clear handler).
      const sessionItemIdsHard = await db
        .select({ id: schema.bulkImportItems.id })
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.sessionId, session.id));
      for (const { id } of sessionItemIdsHard) {
        for (const key of inFlightPerItemRetry) {
          if (key.startsWith(`${id}:`)) inFlightPerItemRetry.delete(key);
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
    uploadBulkImportFiles,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const session = await loadSession(req.params.id);
        if (!session) {
          // Multer already streamed every accepted file to the staging
          // directory. If the session itself does not exist, drop those
          // temp files so they don't linger on disk indefinitely.
          const orphan = (req.files as Express.Multer.File[] | undefined) ?? [];
          for (const f of orphan) {
            if (f && typeof f.path === 'string') {
              try {
                if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
              } catch (rmErr) {
                logError(
                  '[bulk-import] failed to remove temp upload for missing session',
                  rmErr as Error,
                );
              }
            }
          }
          return res.status(404).json({ error: 'Session not found' });
        }
        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

        const dir = stagingDirFor(session.id);
        const created: schema.BulkImportItem[] = [];
        const failures: string[] = [];

        for (const file of files) {
          // Track what we still own on disk for this iteration so a
          // failure at any step can clean up exactly the artifact this
          // file produced (temp file before rename, staged file after)
          // without touching files that belong to other items.
          let pathToCleanup: string | null = file.path;
          try {
            // Stream-hash the staged temp file straight off disk so we
            // never hold the full buffer in memory (Task #1061). The
            // resulting hex digest matches what the previous
            // `sha256(file.buffer)` path produced for the same bytes.
            const hash = await sha256File(file.path);
            const stagedPath = path.join(dir, `${hash}_${file.originalname}`);

            if (fs.existsSync(stagedPath)) {
              // Same content was already staged inside this session
              // (re-upload of an identical file). Drop the freshly
              // streamed temp copy and let the existing staged file
              // stand — the dedup query below will still flag the row
              // as a duplicate against the org-wide fingerprint cache
              // when appropriate.
              try {
                fs.unlinkSync(file.path);
              } catch (rmErr) {
                logError(
                  '[bulk-import] failed to remove redundant temp upload',
                  rmErr as Error,
                );
              }
              pathToCleanup = null;
            } else {
              fs.renameSync(file.path, stagedPath);
              pathToCleanup = stagedPath;
            }

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
            // The staged file is now owned by a real DB row; don't
            // delete it on the per-iteration error path below.
            pathToCleanup = null;
          } catch (perFileErr) {
            // Survive single-file failures so already-inserted rows for
            // earlier files in this batch keep their staged copies and
            // their DB rows. Cleanup is scoped to this iteration's own
            // artifact only.
            logError(
              '[bulk-import] failed to stage uploaded file',
              perFileErr as Error,
              {
                metadata: {
                  sessionId: session.id,
                  originalName: file.originalname,
                },
              },
            );
            if (pathToCleanup) {
              try {
                if (fs.existsSync(pathToCleanup)) fs.unlinkSync(pathToCleanup);
              } catch (rmErr) {
                logError(
                  '[bulk-import] failed to clean up after per-file upload error',
                  rmErr as Error,
                );
              }
            }
            failures.push(file.originalname);
          }
        }

        // Per-file failures must surface as a non-2xx response so the
        // wizard learns about them up front instead of having to diff
        // its `/lite` poll against what it just attempted to upload
        // (Task #1061 "Done looks like": a single staging/hash/DB
        // failure must return a clear 4xx/5xx). The rows that did
        // stage stay in the database — the loop above already
        // committed them and will not roll them back — so the wizard
        // can still see them on its next `/lite` poll. The successful
        // rows are also echoed back in `created` for client visibility,
        // alongside `failedFiles` for the names that did not stage.
        if (failures.length > 0) {
          return res.status(500).json({
            error: 'Failed to stage uploaded files',
            failedFiles: failures,
            created,
          });
        }

        // Task #1002: enrich duplicate rows with existing document details so
        // the upload response already carries the "Already in Koveo" context.
        const uploadDupeHashes = created
          .filter((r) => r.status === 'duplicate')
          .map((r) => r.contentHash);

        type UploadDupeInfo = {
          documentId: string | null;
          documentName: string | null;
          buildingId: string | null;
          buildingName: string | null;
          residenceLabel: string | null;
          documentType: string | null;
          removed: boolean;
        };
        const uploadDupeInfoByHash = new Map<string, UploadDupeInfo>();

        if (uploadDupeHashes.length > 0) {
          const fpRows = await db
            .select({
              contentHash: schema.clientDocumentFingerprints.contentHash,
              finalDocumentId: schema.clientDocumentFingerprints.finalDocumentId,
              docName: schema.documents.name,
              docType: schema.documents.documentType,
              buildingId: schema.buildings.id,
              buildingName: schema.buildings.name,
              residenceUnitNumber: schema.residences.unitNumber,
            })
            .from(schema.clientDocumentFingerprints)
            .leftJoin(
              schema.documents,
              eq(schema.clientDocumentFingerprints.finalDocumentId, schema.documents.id),
            )
            .leftJoin(
              schema.buildings,
              eq(schema.documents.buildingId, schema.buildings.id),
            )
            .leftJoin(
              schema.residences,
              eq(schema.documents.residenceId, schema.residences.id),
            )
            .where(
              and(
                eq(schema.clientDocumentFingerprints.organizationId, session.organizationId),
                inArray(schema.clientDocumentFingerprints.contentHash, uploadDupeHashes),
              ),
            );
          for (const fp of fpRows) {
            const removed = fp.finalDocumentId === null;
            uploadDupeInfoByHash.set(fp.contentHash, {
              documentId: fp.finalDocumentId ?? null,
              documentName: fp.docName ?? null,
              buildingId: fp.buildingId ?? null,
              buildingName: fp.buildingName ?? null,
              residenceLabel: fp.residenceUnitNumber ?? null,
              documentType: fp.docType ?? null,
              removed,
            });
          }
        }

        const enriched = created.map((r) => {
          if (r.status !== 'duplicate') return r;
          const di = uploadDupeInfoByHash.get(r.contentHash) ?? null;
          return {
            ...r,
            duplicateOfDocumentId: di?.documentId ?? null,
            duplicateOfDocumentName: di?.documentName ?? null,
            duplicateOfBuildingId: di?.buildingId ?? null,
            duplicateOfBuildingName: di?.buildingName ?? null,
            duplicateOfResidenceLabel: di?.residenceLabel ?? null,
            duplicateOfDocumentType: di?.documentType ?? null,
            duplicateOfDocumentRemoved: di?.removed ?? false,
          };
        });

        return res.status(201).json(enriched);
      } catch (err) {
        logError('[bulk-import] upload failed', err as Error);
        return res.status(500).json({ error: 'Failed to upload files' });
      }
    },
  );

  /**
   * Replace a staged item's bytes with a freshly re-saved version of
   * the same source file (Task #1051). Powers the "Replace file" /
   * "Téléverser à nouveau" button on the inline PDF-corruption banner
   * surfaced by Task #1036, so an admin who hits a corrupt-PDF merge
   * failure can swap in a re-exported copy (e.g. re-saved through
   * Preview / Adobe Acrobat) without leaving the sorting step.
   *
   * Accepts exactly one file via `files` (multer field, same name as
   * the upload endpoint above). The new bytes are written to the same
   * staging directory under a fresh `<hash>_<filename>` path; the prior
   * staged file is best-effort removed once the row is updated so the
   * staging dir does not balloon. Item state (status, screening
   * decisions, sorting decision, etc.) is intentionally preserved so
   * the admin can immediately retry the failed sorting decision —
   * replacing a corrupt PDF with a re-encoded copy of the same scan
   * should not reset any of the AI work already performed on it.
   *
   * Terminal states (`committed`, `duplicate`) are refused since their
   * bytes are no longer relevant to the wizard. Same admin-org access
   * guard as the exclude endpoint above.
   */
  app.post(
    '/api/admin/bulk-import/items/:id/replace-file',
    requireAuth,
    requireRole(['admin']),
    upload.array('files', 1),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const [item] = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.id, req.params.id));
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

        // Refuse states whose downstream side-effects can't be undone
        // by a file swap alone:
        //   - `committed`: the bytes have already been persisted to a
        //     real `documents` row + storage. Replacing them here would
        //     desync the wizard from the published document.
        //   - `linked`: the merge step has bound this item to an
        //     existing document; swapping the staged file would leave
        //     the link pointing at unverified bytes.
        //   - `duplicate`: the item is a known dup of bytes already in
        //     the system, so a swap has no meaningful target.
        // Every other state (pending/screening/screened/sorted/
        // branched/identified/rejected) is the intended replace-file
        // surface for the corruption-recovery flow (Task #1051).
        if (
          item.status === 'committed' ||
          item.status === 'linked' ||
          item.status === 'duplicate'
        ) {
          return res.status(400).json({
            error: `Cannot replace a ${item.status} item`,
          });
        }

        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        if (files.length === 0) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        if (files.length > 1) {
          return res.status(400).json({ error: 'Replace accepts a single file' });
        }
        const file = files[0];

        const dir = stagingDirFor(session.id);
        const correctedName = fixLatin1MisdecodeFilename(file.originalname);
        const hash = sha256(file.buffer);
        const newStagedPath = path.join(dir, `${hash}_${correctedName}`);

        // Sanity check: the resolved path must stay inside the session's
        // staging directory. `correctedName` came from a multer-parsed
        // header so a malicious filename like `../../etc/passwd` should
        // be neutralised by the path.join above, but we re-verify before
        // writing to disk.
        const resolvedNew = path.resolve(newStagedPath);
        const resolvedDir = path.resolve(dir);
        if (!resolvedNew.startsWith(resolvedDir + path.sep)) {
          return res.status(400).json({ error: 'Invalid filename' });
        }

        fs.writeFileSync(resolvedNew, file.buffer);

        const [updated] = await db
          .update(schema.bulkImportItems)
          .set({
            originalPath: correctedName,
            originalName: correctedName,
            stagedPath: resolvedNew,
            contentHash: hash,
            mimeType: file.mimetype,
            fileSize: file.size,
            updatedAt: new Date(),
          })
          .where(eq(schema.bulkImportItems.id, item.id))
          .returning();

        // Best-effort cleanup of the old staged bytes. We only delete
        // when the prior path is different from the new one (uploading
        // the exact same file would collide on hash+name) AND lived
        // under THIS session's staging directory. Constraining to the
        // session dir (not just the bulk-import staging root) means a poisoned
        // `stagedPath` row from a different session — or one that
        // somehow points elsewhere on disk — can never coax us into
        // removing files outside the affected session's sandbox.
        if (item.stagedPath && item.stagedPath !== resolvedNew) {
          const resolvedOld = path.resolve(item.stagedPath);
          if (resolvedOld.startsWith(resolvedDir + path.sep)) {
            try {
              fs.rmSync(resolvedOld, { force: true });
            } catch (cleanupErr) {
              logWarn('[bulk-import] failed to remove replaced staged file', {
                metadata: {
                  itemId: item.id,
                  oldPath: resolvedOld,
                  error: (cleanupErr as Error).message,
                },
              });
            }
          }
        }

        return res.json(updated);
      } catch (err) {
        logError('[bulk-import] replace-file failed', err as Error, {
          metadata: { itemId: req.params.id },
        });
        return res.status(500).json({ error: 'Failed to replace file' });
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
      const stagingRoot = path.resolve(getBulkImportStagingRoot());
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
   * validated against the configured staging root exactly like the
   * `/file` endpoint above so a poisoned `stagedPath` row can never
   * coax us into reading arbitrary files off disk.
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
      const stagingRoot = path.resolve(getBulkImportStagingRoot());
      if (!resolved.startsWith(stagingRoot + path.sep)) {
        return res.status(400).json({ error: 'Invalid staged path' });
      }
      if (!fs.existsSync(resolved)) {
        return res.status(404).json({ error: 'Staged file missing' });
      }

      try {
        const doc = await loadPdfForBulkImport(resolved);
        return res.json({ totalPages: doc.getPageCount() });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logError('[bulk-import] page-count failed', err as Error, { metadata: { itemId: req.params.id } });
        return res.status(400).json({
          error: 'Failed to read PDF page count: the file may have a corrupted page structure',
          code: 'PAGE_COUNT_PDF_INVALID',
          underlyingError: errMsg,
        });
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
    residenceId: z.string().min(1).optional().nullable(),
  });
  app.post(
    '/api/admin/bulk-import/items/:id/reassign',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { branch, subCategory, residenceId } = reassignSchema.parse(req.body);
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
          delete updated_decision.residenceAiSuggestedId;
          delete updated_decision.residenceAiConfirmed;
        }

        // When reassigning into residence_documents with an optional
        // residenceId, validate it belongs to this session's building/org
        // then persist it (mirroring the set-residence endpoint logic).
        let newStatus: string | undefined;
        if (branch === 'residence_documents' && residenceId) {
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
              error: "Residence does not belong to this session's building",
            });
          }
          const aiResidenceId =
            (existing.residenceAiSuggestedId as string | null | undefined)
            ?? null;
          const isManualOverride = residenceId !== aiResidenceId;
          const residenceAiConfirmed =
            aiResidenceId !== null && residenceId === aiResidenceId;
          updated_decision.residenceId = residenceId;
          updated_decision.residenceManualOverride = isManualOverride;
          updated_decision.residenceAiConfirmed = residenceAiConfirmed;
          newStatus = 'branched';
        }

        const [updated] = await db
          .update(schema.bulkImportItems)
          .set({
            branchDecision: updated_decision,
            ...(newStatus ? { status: newStatus as 'branched' } : {}),
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
    // Task #1084: optional residence applied to every eligible item
    // when the destination is `residence_documents`. Mirrors the
    // per-item /reassign endpoint's residenceId field. Ignored when
    // branch !== 'residence_documents' so a stale value can't leak.
    residenceId: z.string().min(1).optional().nullable(),
  });
  app.post(
    '/api/admin/bulk-import/sessions/:id/items/reassign-bulk',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { branch, subCategory, itemIds, residenceId } = bulkReassignSchema.parse(req.body);
        const allowedSubCats = BRANCH_SUB_CATEGORIES[branch as BranchDestination] as readonly string[];
        if (!allowedSubCats.includes(subCategory)) {
          return res.status(400).json({
            error: `subCategory "${subCategory}" is not valid for branch "${branch}". Allowed: ${allowedSubCats.join(', ')}`,
          });
        }
        const session = await loadSession(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        // Task #1084: when an explicit residenceId is supplied AND the
        // destination is residence_documents, validate it once up-front
        // (org access + same building) so we never half-apply the bulk
        // move. The per-file /reassign endpoint runs the same checks.
        const applyResidence = branch === 'residence_documents' && !!residenceId;
        if (applyResidence) {
          const canAccess = await canUserAccessOrganization(req.user!.id, session.organizationId);
          if (!canAccess) return res.status(403).json({ error: 'Forbidden' });
          const [residence] = await db
            .select({ id: schema.residences.id, buildingId: schema.residences.buildingId })
            .from(schema.residences)
            .where(eq(schema.residences.id, residenceId!));
          if (!residence) return res.status(404).json({ error: 'Residence not found' });
          if (residence.buildingId !== session.buildingId) {
            return res.status(400).json({
              error: "Residence does not belong to this session's building",
            });
          }
        }

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
          const oldBranch = existing.branch as string | null | undefined;
          const updated_decision: Record<string, unknown> = {
            ...existing,
            branch,
            subCategory,
            manualOverride: true,
          };
          // Mirror the per-file reassign cleanup (Task #803): when an
          // item leaves residence_documents, drop every residence
          // field — including the AI-suggestion bookkeeping — so we
          // never render a stale chip on its new destination.
          if (oldBranch === 'residence_documents' && branch !== 'residence_documents') {
            delete updated_decision.residenceId;
            delete updated_decision.residenceConfidence;
            delete updated_decision.residenceReason;
            delete updated_decision.residenceFallbackReason;
            delete updated_decision.residenceManualOverride;
            delete updated_decision.residenceAiSuggestedId;
            delete updated_decision.residenceAiConfirmed;
          }
          // Task #1084: stamp the chosen residence on every eligible
          // row in a single move. Mirrors the per-file /reassign
          // logic: an explicit pick that matches the AI suggestion
          // is treated as a confirmation, anything else flips the
          // manual-override flag, and the row is promoted to
          // `branched` so it satisfies the residence-required gate.
          let nextStatus: string | undefined;
          if (applyResidence) {
            const aiResidenceId =
              (existing.residenceAiSuggestedId as string | null | undefined)
              ?? null;
            const isManualOverride = residenceId !== aiResidenceId;
            const residenceAiConfirmed =
              aiResidenceId !== null && residenceId === aiResidenceId;
            updated_decision.residenceId = residenceId;
            updated_decision.residenceManualOverride = isManualOverride;
            updated_decision.residenceAiConfirmed = residenceAiConfirmed;
            nextStatus = 'branched';
          }
          const [u] = await db
            .update(schema.bulkImportItems)
            .set({
              branchDecision: updated_decision,
              ...(nextStatus ? { status: nextStatus as 'branched' } : {}),
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

        // The AI's original residence pick is stored separately in
        // `residenceAiSuggestedId` (Task #803) so we can correctly
        // detect manual overrides even after the admin has saved a
        // value once. Falling back to the current residenceId keeps
        // legacy items (created before the field existed) working.
        const aiResidenceId =
          (existing.residenceAiSuggestedId as string | null | undefined)
          ?? (existing.residenceId as string | null | undefined)
          ?? null;
        const isManualOverride = residenceId !== aiResidenceId;
        // When the admin saves the AI's suggestion as-is, treat it as
        // an explicit confirmation so the "AI suggestion" chip is
        // dismissed in the UI (Task #803). Clearing the residence
        // resets confirmation since there's no AI pick to confirm.
        const residenceAiConfirmed =
          residenceId !== null
          && aiResidenceId !== null
          && residenceId === aiResidenceId;
        const updated_decision: Record<string, unknown> = {
          ...existing,
          residenceId,
          residenceManualOverride: residenceId !== null ? isManualOverride : false,
          residenceAiConfirmed,
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
   * Validate and sanitise a user-supplied filename stem (no extension).
   * Returns the cleaned stem, or `null` when the input cannot be made safe.
   * Rules (per task spec): strip path separators, forbid leading dots, cap at
   * 200 chars after trimming.  An empty string after trimming is allowed — it
   * means "clear the override".
   */
  function sanitizeFileNameStem(raw: string): string | null {
    let s = raw.trim();
    // Strip any path separator characters.
    s = s.replace(/[/\\]/g, '');
    // Forbid leading dots (hidden-file trap on Unix).
    if (s.startsWith('.')) return null;
    // Cap to 200 chars.
    s = s.slice(0, 200);
    return s;
  }

  /**
   * Helper: load a staged PDF with fully-lenient pdf-lib options and validate
   * the page tree by calling getPageCount() once.  On the
   * "Expected instance of PDFDict, but got instance of undefined" family of
   * errors (triggered by broken xref / object references in PDFs exported by
   * some Quebec condo management systems — "NoCentris-style" PDFs), a
   * re-encode pass (save → reload) is attempted, and if that fails, a
   * per-page rebuild pass is attempted before giving up.
   *
   * Recovery strategy (lightest → heaviest):
   *   1. Lenient load  (throwOnInvalidObject:false, ignoreEncryption:true)
   *   2. save → reload re-encode pass
   *   3. Per-page rebuild — copy each page index individually into a fresh
   *      PDFDocument, skipping any index whose copyPages() throws.  Returns
   *      the rebuilt doc if at least one page was rescued.
   *
   * Callers receive the working PDFDocument, or a typed Error with code
   * PDF_PAGE_TREE_UNRECOVERABLE so they can surface a classified 400 instead
   * of leaking a 500.  The try block at every call site wraps both this helper
   * and the subsequent copyPages() call, so any page-tree walk failure
   * (whether during getPageCount or copyPages) is always caught and classified.
   */
  async function loadPdfForBulkImport(filePath: string): Promise<import('pdf-lib').PDFDocument> {
    const { PDFDocument, ParseSpeeds } = await import('pdf-lib');
    const LENIENT: Parameters<typeof PDFDocument.load>[1] = {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
      ...(ParseSpeeds != null && { parseSpeed: ParseSpeeds.Fastest }),
    };

    const bytes = fs.readFileSync(filePath);
    const doc = await PDFDocument.load(new Uint8Array(bytes), LENIENT);

    try {
      doc.getPageCount();
      return doc;
    } catch (firstErr) {
      logWarn('[bulk-import] pdf page-tree walk failed, attempting re-encode pass', {
        metadata: { filePath, error: firstErr instanceof Error ? firstErr.message : String(firstErr) },
      });
      try {
        const reencoded = await doc.save();
        const doc2 = await PDFDocument.load(reencoded, LENIENT);
        doc2.getPageCount();
        logInfo('[bulk-import] pdf page-tree recovered via re-encode', { metadata: { filePath } });
        return doc2;
      } catch (secondErr) {
        // Stage 3: per-page rebuild — probe individual page indices and copy
        // each into a fresh document, skipping any that throw.  This rescues
        // PDFs where the full page-tree walk fails but individual pages are
        // still reachable (e.g. partially corrupt NoCentris-style xref tables).
        logWarn('[bulk-import] re-encode pass failed, attempting per-page rebuild', {
          metadata: {
            filePath,
            error: secondErr instanceof Error ? secondErr.message : String(secondErr),
          },
        });
        try {
          const freshDoc = await PDFDocument.create();
          let pageIndex = 0;
          let skippedCount = 0;
          let consecutiveFailures = 0;
          // Probe up to MAX_PAGES indices; stop early after MAX_CONSECUTIVE_FAILURES
          // consecutive misses so we don't spin forever on fully corrupt files.
          const MAX_PAGES = 5000;
          const MAX_CONSECUTIVE_FAILURES = 5;
          while (pageIndex < MAX_PAGES && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
            try {
              const copied = await freshDoc.copyPages(doc, [pageIndex]);
              if (copied.length > 0 && copied[0] !== undefined) {
                freshDoc.addPage(copied[0]);
                consecutiveFailures = 0;
              } else {
                skippedCount++;
                consecutiveFailures++;
              }
            } catch {
              skippedCount++;
              consecutiveFailures++;
            }
            pageIndex++;
          }
          const rescuedCount = freshDoc.getPageCount();
          if (rescuedCount === 0) {
            throw new Error('No pages could be rescued via per-page rebuild');
          }
          logInfo('[bulk-import] pdf rescued via per-page rebuild', {
            metadata: { filePath, rescuedPages: rescuedCount, skippedPages: skippedCount },
          });
          return freshDoc;
        } catch {
          const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
          const typed = Object.assign(new Error(`PDF page tree unrecoverable: ${msg}`), {
            code: 'PDF_PAGE_TREE_UNRECOVERABLE',
          });
          throw typed;
        }
      }
    }
  }

  /**
   * Load a sibling PDF from disk and copy all of its pages into `leadPdf`,
   * with two-stage recovery that covers the NoCentris failure class:
   *
   * Stage 1 (inside loadPdfForBulkImport):
   *   Handles getPageCount() failures — re-encodes via save→reload.
   *
   * Stage 2 (here):
   *   Handles copyPages() failures that occur even after getPageCount() passes.
   *   This happens when the page-tree object graph is corrupt in a way that only
   *   surfaces during cross-document reference resolution, not during the simpler
   *   getPageCount() walk.  Recovery: re-read the sibling from disk, save→reload
   *   to rebuild its object graph, then retry copyPages().
   *
   * Throws a typed Error with code COPY_PAGES_UNRECOVERABLE on total failure so
   * callers can surface a classified 400 instead of leaking a 500.
   */
  async function copyPagesFromFileWithRecovery(
    leadPdf: import('pdf-lib').PDFDocument,
    sibPath: string,
  ): Promise<import('pdf-lib').PDFPage[]> {
    const { PDFDocument, ParseSpeeds } = await import('pdf-lib');
    const LENIENT: Parameters<typeof PDFDocument.load>[1] = {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
      ...(ParseSpeeds != null && { parseSpeed: ParseSpeeds.Fastest }),
    };

    const sibPdf = await loadPdfForBulkImport(sibPath);
    const indices = Array.from({ length: sibPdf.getPageCount() }, (_, i) => i);

    try {
      return await leadPdf.copyPages(sibPdf, indices);
    } catch (firstCopyErr) {
      logWarn('[bulk-import] copyPages failed on initial load, re-encoding sibling for retry', {
        metadata: {
          sibPath,
          error: firstCopyErr instanceof Error ? firstCopyErr.message : String(firstCopyErr),
        },
      });
      try {
        const rawBytes = fs.readFileSync(sibPath);
        const tempDoc = await PDFDocument.load(new Uint8Array(rawBytes), LENIENT);
        const reencoded = await tempDoc.save();
        const sibPdf2 = await PDFDocument.load(reencoded, LENIENT);
        sibPdf2.getPageCount();
        const indices2 = Array.from({ length: sibPdf2.getPageCount() }, (_, i) => i);
        const pages = await leadPdf.copyPages(sibPdf2, indices2);
        logInfo('[bulk-import] sibling re-encode recovery succeeded for copyPages', {
          metadata: { sibPath },
        });
        return pages;
      } catch (recoveryErr) {
        const msg = firstCopyErr instanceof Error ? firstCopyErr.message : String(firstCopyErr);
        throw Object.assign(new Error(`PDF copyPages unrecoverable: ${msg}`), {
          code: 'COPY_PAGES_UNRECOVERABLE',
        });
      }
    }
  }

  /**
   * Helper: physically slice a PDF staged file into two parts and write them
   * to the session staging directory.  Returns both byte Buffers, their SHA-256
   * hashes, and the effective split page (server-clamped to 1…totalPages-1).
   */
  async function slicePdf(
    srcPath: string,
    splitAtPage: number,
  ): Promise<{
    firstBytes: Buffer; firstHash: string; firstPath: string;
    secondBytes: Buffer; secondHash: string; secondPath: string;
    splitPage: number; totalPages: number;
    dir: string;
    originalName: string;
  }> {
    const { PDFDocument } = await import('pdf-lib');
    const srcDoc = await loadPdfForBulkImport(srcPath);
    const totalPages = srcDoc.getPageCount();
    const splitPage = Math.max(1, Math.min(splitAtPage, totalPages - 1));

    const docFirst = await PDFDocument.create();
    const firstIndices = Array.from({ length: splitPage }, (_, i) => i);
    const firstPages = await docFirst.copyPages(srcDoc, firstIndices);
    for (const p of firstPages) docFirst.addPage(p);
    const firstBytes = Buffer.from(await docFirst.save());
    const firstHash = crypto.createHash('sha256').update(firstBytes).digest('hex');

    const docSecond = await PDFDocument.create();
    const secondIndices = Array.from({ length: totalPages - splitPage }, (_, i) => i + splitPage);
    const secondPages = await docSecond.copyPages(srcDoc, secondIndices);
    for (const p of secondPages) docSecond.addPage(p);
    const secondBytes = Buffer.from(await docSecond.save());
    const secondHash = crypto.createHash('sha256').update(secondBytes).digest('hex');

    // Derive original name from the source path (strip any split prefix).
    const basename = path.basename(srcPath);
    const originalName = basename.replace(/^split\d+_[0-9a-f]+_/, '');
    const dir = path.dirname(srcPath);

    const firstPath = path.join(dir, `split1_${firstHash}_${originalName}`);
    const secondPath = path.join(dir, `split2_${secondHash}_${originalName}`);
    fs.writeFileSync(firstPath, firstBytes);
    fs.writeFileSync(secondPath, secondBytes);

    return { firstBytes, firstHash, firstPath, secondBytes, secondHash, secondPath, splitPage, totalPages, dir, originalName };
  }

  /**
   * Bulk-confirm every AI-suggested residence in a session (Task #803).
   *
   * The Sorting/branching step shows an "AI suggestion" chip on
   * residence_documents items where the picker's current value is
   * still the AI's original guess. Admins reviewing many files can
   * click "Review all AI suggestions" at the top of the step to flip
   * `residenceAiConfirmed: true` on every qualifying item in one
   * round-trip — the chip then disappears from each row and the
   * value itself is left unchanged.
   *
   * An item qualifies when:
   *   - it belongs to the URL session;
   *   - branchDecision.branch === 'residence_documents';
   *   - residenceAiSuggestedId is non-null;
   *   - residenceId === residenceAiSuggestedId (still the AI pick);
   *   - residenceAiConfirmed is not already true;
   *   - residenceManualOverride is not true (admin hasn't overridden).
   *
   * Items not yet promoted to `branched` (no residenceId resolved)
   * are skipped because there is nothing to confirm. The response
   * reports `{ updated, items }` so the client can report exactly
   * how many rows it just confirmed.
   */
  app.post(
    '/api/admin/bulk-import/sessions/:id/items/confirm-ai-residences',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const session = await loadSession(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        const canAccess = await canUserAccessOrganization(req.user!.id, session.organizationId);
        if (!canAccess) return res.status(403).json({ error: 'Forbidden' });

        const rows = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.sessionId, session.id));

        const now = new Date();
        const updated: schema.BulkImportItem[] = [];
        for (const row of rows) {
          if (row.status === 'rejected' || row.status === 'committed' || row.status === 'duplicate') {
            continue;
          }
          const existing = (row.branchDecision ?? {}) as Record<string, unknown>;
          if (existing.branch !== 'residence_documents') continue;
          const aiId = (existing.residenceAiSuggestedId as string | null | undefined) ?? null;
          const currentId = (existing.residenceId as string | null | undefined) ?? null;
          const manualOverride = (existing.residenceManualOverride as boolean | null | undefined) ?? false;
          const alreadyConfirmed = (existing.residenceAiConfirmed as boolean | null | undefined) ?? false;
          if (!aiId || aiId !== currentId || manualOverride || alreadyConfirmed) continue;

          const updated_decision: Record<string, unknown> = {
            ...existing,
            residenceAiConfirmed: true,
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
        logError('[bulk-import] confirm-ai-residences failed', err as Error);
        return res.status(500).json({ error: 'Failed to confirm AI residences' });
      }
    },
  );

  /**
   * Bulk-accept every pending sorting decision in a session (Task #900).
   *
   * Iterates all items in the session and, for each one where
   * `sortingDecision.decisionState === 'pending'` and that is not
   * excluded (status !== 'rejected' / 'committed' / 'duplicate'), applies
   * exactly the same accept logic as the single-item `set-sorting-decision`
   * route for `action: 'accept'` — i.e. it commits the AI's suggested
   * Keep / Merge / Split decision, running the corresponding PDF file
   * operation when needed.
   *
   * Returns `{ accepted: number }`.
   */
  const acceptAllPendingSortingSchema = z.object({
    /** Item IDs the client wants the server to skip (inline edits in progress). */
    skipItemIds: z.string().array().optional(),
  });

  app.post(
    '/api/admin/bulk-import/sessions/:id/items/accept-all-pending-sorting',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { skipItemIds } = acceptAllPendingSortingSchema.parse(req.body);
        const skipSet = new Set(skipItemIds ?? []);

        const session = await loadSession(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        const canAccess = await canUserAccessOrganization(req.user!.id, session.organizationId);
        if (!canAccess) return res.status(403).json({ error: 'Forbidden' });

        const rows = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.sessionId, session.id));

        const now = new Date();
        let accepted = 0;
        // Track IDs that have been modified mid-loop (e.g. siblings marked
        // rejected during a merge) so stale prefetched snapshots are not
        // re-processed in subsequent iterations.
        const modifiedIds = new Set<string>();

        for (const item of rows) {
          // Skip items the client flagged as having in-progress inline edits.
          if (skipSet.has(item.id)) continue;
          // Skip items whose DB row was mutated by an earlier iteration of this loop.
          if (modifiedIds.has(item.id)) continue;
          if (
            item.status === 'rejected' ||
            item.status === 'committed' ||
            item.status === 'duplicate'
          ) {
            continue;
          }
          const existing = (item.sortingDecision ?? {}) as Record<string, unknown>;
          if ((existing.decisionState as string | undefined) !== 'pending') continue;

          const effectiveDecision =
            (existing.decision as string | null | undefined) ?? 'keep';
          const effectiveMergeIds: string[] | undefined = Array.isArray(existing.mergeWithItemIds)
            ? (existing.mergeWithItemIds as string[])
            : (existing.mergeWithItemId as string | null | undefined)
              ? [(existing.mergeWithItemId as string)]
              : undefined;
          const effectiveSplitAt = existing.splitAtPage as number | null | undefined;
          const isPdf = (item.mimeType ?? '').toLowerCase() === 'application/pdf';

          const updated_decision: Record<string, unknown> = {
            ...existing,
            decisionState: 'accepted',
            draft: false,
          };

          // --- MERGE ---
          if (effectiveDecision === 'merge' && effectiveMergeIds && effectiveMergeIds.length > 0 && isPdf) {
            if (!item.stagedPath || !fs.existsSync(item.stagedPath)) {
              logWarn(`[bulk-import] accept-all-pending-sorting: staged file missing for item ${item.id}, skipping`);
              continue;
            }

            try {
              let leadPdf: import('pdf-lib').PDFDocument;
              try {
                leadPdf = await loadPdfForBulkImport(item.stagedPath);
              } catch {
                logWarn(`[bulk-import] accept-all-pending-sorting: lead PDF unrecoverable for item ${item.id}, skipping`);
                continue;
              }

              const siblingItems: (typeof item)[] = [];
              let mergeError = false;
              for (const siblingId of effectiveMergeIds) {
                const [siblingItem] = await db
                  .select()
                  .from(schema.bulkImportItems)
                  .where(eq(schema.bulkImportItems.id, siblingId));
                if (!siblingItem || (siblingItem.sessionId as string) !== item.sessionId) {
                  mergeError = true;
                  break;
                }
                if (!siblingItem.stagedPath || !fs.existsSync(siblingItem.stagedPath)) {
                  mergeError = true;
                  break;
                }
                try {
                  const copiedPages = await copyPagesFromFileWithRecovery(leadPdf, siblingItem.stagedPath);
                  for (const page of copiedPages) leadPdf.addPage(page);
                } catch (sibErr) {
                  logWarn(`[bulk-import] accept-all-pending-sorting: sibling PDF unrecoverable for item ${siblingId}, skipping merge`);
                  mergeError = true;
                  break;
                }
                siblingItems.push(siblingItem);
              }
              if (mergeError) {
                logWarn(`[bulk-import] accept-all-pending-sorting: merge prerequisite missing for item ${item.id}, skipping`);
                continue;
              }

              const mergedBytes = Buffer.from(await leadPdf.save());
              const mergedHash = crypto.createHash('sha256').update(mergedBytes).digest('hex');
              const dir = stagingDirFor(item.sessionId);
              const newPath = path.join(dir, `merged_${mergedHash}_${item.originalName}`);
              fs.writeFileSync(newPath, mergedBytes);

              updated_decision.mergeWithItemIds = effectiveMergeIds;
              updated_decision.mergedFromItemIds = effectiveMergeIds;
              if (siblingItems.length === 1) {
                updated_decision.mergedFromItemId = siblingItems[0].id;
              }

              await db
                .update(schema.bulkImportItems)
                .set({ stagedPath: newPath, contentHash: mergedHash, sortingDecision: updated_decision, updatedAt: now })
                .where(eq(schema.bulkImportItems.id, item.id));

              for (const siblingItem of siblingItems) {
                const siblingDecision: Record<string, unknown> = {
                  ...((siblingItem.sortingDecision ?? {}) as Record<string, unknown>),
                  decisionState: 'accepted',
                  decision: 'merge',
                  mergedIntoItemId: item.id,
                };
                await db
                  .update(schema.bulkImportItems)
                  .set({ status: 'rejected', preExcludeStatus: siblingItem.status, sortingDecision: siblingDecision, updatedAt: now })
                  .where(eq(schema.bulkImportItems.id, siblingItem.id));
                // Mark sibling as modified so the loop doesn't re-process
                // the stale prefetched snapshot.
                modifiedIds.add(siblingItem.id);
              }
              modifiedIds.add(item.id);
              accepted++;
            } catch (mergeErr) {
              logError(`[bulk-import] accept-all-pending-sorting: merge failed for item ${item.id}`, mergeErr as Error);
            }
            continue;
          }

          // --- SPLIT ---
          if (effectiveDecision === 'split' && effectiveSplitAt != null && isPdf) {
            if (!item.stagedPath || !fs.existsSync(item.stagedPath)) {
              logWarn(`[bulk-import] accept-all-pending-sorting: staged file missing for split item ${item.id}, skipping`);
              continue;
            }
            try {
              const {
                firstBytes, firstHash, firstPath,
                secondBytes, secondHash, secondPath,
                splitPage, totalPages, originalName: splitOriginalName,
              } = await slicePdf(item.stagedPath, effectiveSplitAt);

              const part2OriginalName = `split2_${splitOriginalName}`;
              updated_decision.splitTotalPages = totalPages;
              updated_decision.splitAtPage = splitPage;

              // Preserve split part final names stored from a prior draft,
              // mirroring the per-row accept handler's behavior (no new
              // overrides in bulk mode).
              const existingSplitFinalNames = existing.splitFinalNames as [string, string] | undefined;
              const part1FinalFileName = existingSplitFinalNames?.[0] ?? null;
              const part2FinalFileName = existingSplitFinalNames?.[1] ?? null;
              if (existingSplitFinalNames) {
                updated_decision.splitFinalNames = existingSplitFinalNames;
              }

              const prevSplitIds = Array.isArray(existing.splitIntoItemIds)
                ? (existing.splitIntoItemIds as string[])
                : null;

              const partDecisionBase: Record<string, unknown> = {
                decision: 'keep',
                reason: 'Created from split',
                confidence: 1,
                decisionState: 'accepted',
                splitFromItemId: item.id,
                splitAtPage: splitPage,
                manualOverride: false,
                splitFromOriginalName: item.originalName,
              };

              if (prevSplitIds && prevSplitIds.length >= 2) {
                const [part1Id, part2Id] = prevSplitIds;
                await db
                  .update(schema.bulkImportItems)
                  .set({ stagedPath: firstPath, contentHash: firstHash, fileSize: firstBytes.length, finalFileName: part1FinalFileName || null, sortingDecision: { ...partDecisionBase }, updatedAt: now })
                  .where(eq(schema.bulkImportItems.id, part1Id));
                await db
                  .update(schema.bulkImportItems)
                  .set({ stagedPath: secondPath, contentHash: secondHash, fileSize: secondBytes.length, finalFileName: part2FinalFileName || null, sortingDecision: { ...partDecisionBase }, updatedAt: now })
                  .where(eq(schema.bulkImportItems.id, part2Id));
                await db
                  .update(schema.bulkImportItems)
                  .set({ sortingDecision: updated_decision, updatedAt: now })
                  .where(eq(schema.bulkImportItems.id, item.id));
              } else {
                await db
                  .update(schema.bulkImportItems)
                  .set({ stagedPath: firstPath, contentHash: firstHash, finalFileName: part1FinalFileName || null, sortingDecision: updated_decision, updatedAt: now })
                  .where(eq(schema.bulkImportItems.id, item.id));
                await db
                  .insert(schema.bulkImportItems)
                  .values({
                    sessionId: item.sessionId,
                    originalPath: part2OriginalName,
                    originalName: part2OriginalName,
                    stagedPath: secondPath,
                    contentHash: secondHash,
                    mimeType: item.mimeType,
                    fileSize: secondBytes.length,
                    status: 'sorted',
                    finalFileName: part2FinalFileName || null,
                    sortingDecision: { ...partDecisionBase },
                  });
              }
              accepted++;
            } catch (splitErr) {
              logError(`[bulk-import] accept-all-pending-sorting: split failed for item ${item.id}`, splitErr as Error);
            }
            continue;
          }

          // --- KEEP (or no file operation needed) ---
          await db
            .update(schema.bulkImportItems)
            .set({ sortingDecision: updated_decision, updatedAt: now })
            .where(eq(schema.bulkImportItems.id, item.id));
          accepted++;
        }

        return res.json({ accepted });
      } catch (err) {
        logError('[bulk-import] accept-all-pending-sorting failed', err as Error);
        return res.status(500).json({ error: 'Failed to accept all pending sorting decisions' });
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
   * When `draft: true` the decision, slice page, merge order, and
   * rename values are persisted WITHOUT running the merge/keep file
   * operation and WITHOUT flipping decisionState to 'accepted'.  For
   * split decisions the two part items are still physically sliced and
   * materialised so they appear as Merge candidates in sibling cards.
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
    /** When true, persist the decision as a draft without running file ops. */
    draft: z.boolean().optional(),
    /**
     * Optional rename stem for keep / merge decisions (no extension —
     * extension comes from the file's mimeType).  An empty string clears
     * the override and falls back to the original filename at commit.
     */
    finalFileName: z.string().max(210).optional(),
    /**
     * Two rename stems for split decisions, one per part, in slice order.
     * Index 0 = pages 1..splitAtPage, index 1 = pages splitAtPage+1..end.
     */
    splitFinalNames: z.tuple([z.string().max(210), z.string().max(210)]).optional(),
  });
  app.post(
    '/api/admin/bulk-import/items/:id/set-sorting-decision',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      // Capture for structured error logging in the catch block (item is in scope only inside try).
      let _capturedSessionId: string | undefined;
      try {
        const {
          action,
          decision: manualDecision,
          mergeWithItemId: manualMergeId,
          mergeWithItemIds: manualMergeIds,
          splitAtPage: manualSplitAt,
          draft: isDraft,
          finalFileName: rawFinalFileName,
          splitFinalNames: rawSplitFinalNames,
        } = setSortingDecisionSchema.parse(req.body);

        const [item] = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.id, req.params.id));
        if (!item) return res.status(404).json({ error: 'Item not found' });
        _capturedSessionId = item.sessionId ?? undefined;

        const existing = (item.sortingDecision ?? {}) as Record<string, unknown>;

        // -----------------------------------------------------------------
        // Filename validation — applies to both draft and non-draft saves.
        // -----------------------------------------------------------------
        let sanitizedFinalFileName: string | null | undefined = undefined;
        if (rawFinalFileName !== undefined) {
          const cleaned = sanitizeFileNameStem(rawFinalFileName);
          if (cleaned === null) {
            return res.status(400).json({ error: 'Invalid filename: remove leading dots or path separators' });
          }
          sanitizedFinalFileName = cleaned || null; // empty string → null (clear override)
        }
        let sanitizedSplitFinalNames: [string, string] | undefined = undefined;
        if (rawSplitFinalNames !== undefined) {
          const c0 = sanitizeFileNameStem(rawSplitFinalNames[0]);
          const c1 = sanitizeFileNameStem(rawSplitFinalNames[1]);
          if (c0 === null || c1 === null) {
            return res.status(400).json({ error: 'Invalid split filename: remove leading dots or path separators' });
          }
          sanitizedSplitFinalNames = [c0 || '', c1 || ''];
        }

        // -----------------------------------------------------------------
        // DRAFT MODE — persist edits without running file ops.
        // Split decisions still materialise the two part items so they appear
        // as Merge candidates in sibling cards.
        // -----------------------------------------------------------------
        if (isDraft) {
          const draftDecision = manualDecision ?? (existing.decision as string | undefined) ?? 'keep';
          const draftSplitAt = manualSplitAt ?? (existing.splitAtPage as number | null | undefined) ?? null;
          const draftMergeIds: string[] | undefined = manualMergeIds
            ?? (manualMergeId ? [manualMergeId] : undefined)
            ?? (Array.isArray(existing.mergeWithItemIds) ? (existing.mergeWithItemIds as string[]) : undefined)
            ?? (existing.mergeWithItemId ? [(existing.mergeWithItemId as string)] : undefined);

          const isPdfDraft = (item.mimeType ?? '').toLowerCase() === 'application/pdf';

          // Build the draft sortingDecision blob.
          const draftBlob: Record<string, unknown> = {
            ...existing,
            decision: draftDecision,
            draft: true,
            ...(draftSplitAt != null && { splitAtPage: draftSplitAt }),
            ...(draftMergeIds && {
              mergeWithItemIds: draftMergeIds,
              mergeWithItemId: draftMergeIds[0] ?? null,
            }),
            ...(sanitizedSplitFinalNames && { splitFinalNames: sanitizedSplitFinalNames }),
          };

          // --- If the previous decision was split, check whether the new
          //     decision reverts away from split.  If so, delete the draft parts.
          const previousSplitIds = Array.isArray(existing.splitIntoItemIds)
            ? (existing.splitIntoItemIds as string[])
            : null;

          let revertedDraftSplit = false;
          if (previousSplitIds && draftDecision !== 'split') {
            // Revert: restore lead status (was marked rejected during draft split),
            // delete the two part items, and scrub them from sibling merge groups.
            revertedDraftSplit = true;
            for (const partId of previousSplitIds) {
              // Remove this part ID from any sibling's mergeWithItemIds.
              const sessionItems = await db
                .select({ id: schema.bulkImportItems.id, sortingDecision: schema.bulkImportItems.sortingDecision })
                .from(schema.bulkImportItems)
                .where(eq(schema.bulkImportItems.sessionId, item.sessionId));
              for (const sib of sessionItems) {
                if (sib.id === item.id || sib.id === partId) continue;
                const sibDec = (sib.sortingDecision ?? {}) as Record<string, unknown>;
                const sibMergeIds = Array.isArray(sibDec.mergeWithItemIds)
                  ? (sibDec.mergeWithItemIds as string[])
                  : null;
                if (sibMergeIds && sibMergeIds.includes(partId)) {
                  const newIds = sibMergeIds.filter((id) => id !== partId);
                  const updatedSibDec: Record<string, unknown> = {
                    ...sibDec,
                    mergeWithItemIds: newIds,
                    mergeWithItemId: newIds[0] ?? null,
                  };
                  await db
                    .update(schema.bulkImportItems)
                    .set({ sortingDecision: updatedSibDec, updatedAt: new Date() })
                    .where(eq(schema.bulkImportItems.id, sib.id));
                }
              }
              // Delete the part row.
              await db
                .delete(schema.bulkImportItems)
                .where(eq(schema.bulkImportItems.id, partId));
            }
            // Clear split back-pointer from the lead's blob.
            delete draftBlob.splitIntoItemIds;
          }

          // --- Materialise split parts when the decision is 'split'.
          let splitPartIds: string[] = [];
          if (draftDecision === 'split' && isPdfDraft) {
            const srcPath = item.stagedPath;
            if (!srcPath || !fs.existsSync(srcPath)) {
              logWarn('[bulk-import] accept failed', { action, metadata: { code: 'DRAFT_SPLIT_FILE_MISSING', itemId: req.params.id, sessionId: _capturedSessionId, decision: manualDecision } });
              return res.status(400).json({ error: 'Staged file missing for this item', code: 'DRAFT_SPLIT_FILE_MISSING' });
            }
            if (!draftSplitAt) {
              logWarn('[bulk-import] accept failed', { action, metadata: { code: 'DRAFT_SPLIT_PAGE_REQUIRED', itemId: req.params.id, sessionId: _capturedSessionId, decision: manualDecision } });
              return res.status(400).json({ error: 'splitAtPage is required for split decisions', code: 'DRAFT_SPLIT_PAGE_REQUIRED' });
            }

            let draftSliceResult: Awaited<ReturnType<typeof slicePdf>>;
            try {
              draftSliceResult = await slicePdf(srcPath, draftSplitAt);
            } catch (splitErr) {
              const errMsg = splitErr instanceof Error ? splitErr.message : String(splitErr);
              logWarn('[bulk-import] accept failed', { action, metadata: { code: 'DRAFT_SPLIT_OPERATION_FAILED', itemId: req.params.id, sessionId: _capturedSessionId, decision: manualDecision, underlyingError: errMsg } });
              return res.status(400).json({ error: 'Failed to split PDF — the file is corrupt and cannot be repaired automatically. Re-export the document from its source application and re-upload.', code: 'DRAFT_SPLIT_OPERATION_FAILED' });
            }
            const {
              firstBytes, firstHash, firstPath,
              secondBytes, secondHash, secondPath,
              splitPage, totalPages,
              originalName,
            } = draftSliceResult;

            draftBlob.splitAtPage = splitPage;
            draftBlob.splitTotalPages = totalPages;

            // Names for the two parts.
            const stem = originalName.replace(/\.[^.]+$/, '');
            const ext = originalName.replace(/^[^.]*(\..+)?$/, '$1') || '';
            const defaultName0 = sanitizedSplitFinalNames?.[0] ?? `${stem} (1)${ext}`;
            const defaultName1 = sanitizedSplitFinalNames?.[1] ?? `${stem} (2)${ext}`;

            if (previousSplitIds && previousSplitIds.length === 2) {
              // Re-slice in place — update existing part items, keep their IDs.
              const [part1Id, part2Id] = previousSplitIds;
              const part1Dec: Record<string, unknown> = {
                decision: 'keep', reason: 'Created from split', confidence: 1,
                splitFromItemId: item.id, splitAtPage: splitPage, manualOverride: true,
                splitFromOriginalName: item.originalName,
                ...(sanitizedSplitFinalNames && { splitFinalNames: sanitizedSplitFinalNames }),
              };
              const part2Dec: Record<string, unknown> = { ...part1Dec };

              await db
                .update(schema.bulkImportItems)
                .set({
                  stagedPath: firstPath, contentHash: firstHash,
                  fileSize: firstBytes.length,
                  finalFileName: defaultName0 || null,
                  sortingDecision: part1Dec,
                  updatedAt: new Date(),
                })
                .where(eq(schema.bulkImportItems.id, part1Id));
              await db
                .update(schema.bulkImportItems)
                .set({
                  stagedPath: secondPath, contentHash: secondHash,
                  fileSize: secondBytes.length,
                  finalFileName: defaultName1 || null,
                  sortingDecision: part2Dec,
                  updatedAt: new Date(),
                })
                .where(eq(schema.bulkImportItems.id, part2Id));
              splitPartIds = [part1Id, part2Id];
            } else {
              // First-time split materialisation — create two new items.
              // Derive names from item.originalName (the uploaded document's original name),
              // not from the staged file path. Use "stem (N).ext" so extension stays at the end.
              const itemStem = item.originalName.replace(/\.[^.]+$/, '');
              const itemExt = item.originalName.replace(/^[^.]*(\..+)?$/, '$1') || ext;
              const part1OriginalName = `${itemStem} (1)${itemExt}`;
              const part2OriginalName = `${itemStem} (2)${itemExt}`;
              const part1Dec: Record<string, unknown> = {
                decision: 'keep', reason: 'Created from split', confidence: 1,
                splitFromItemId: item.id, splitAtPage: splitPage, manualOverride: true,
                splitFromOriginalName: item.originalName,
                ...(sanitizedSplitFinalNames && { splitFinalNames: sanitizedSplitFinalNames }),
              };
              const part2Dec: Record<string, unknown> = { ...part1Dec };

              const [part1Row] = await db
                .insert(schema.bulkImportItems)
                .values({
                  sessionId: item.sessionId,
                  originalPath: firstPath,
                  originalName: part1OriginalName,
                  stagedPath: firstPath,
                  contentHash: firstHash,
                  mimeType: item.mimeType,
                  fileSize: firstBytes.length,
                  status: 'sorted',
                  finalFileName: defaultName0 || null,
                  sortingDecision: part1Dec,
                })
                .returning();
              const [part2Row] = await db
                .insert(schema.bulkImportItems)
                .values({
                  sessionId: item.sessionId,
                  originalPath: secondPath,
                  originalName: part2OriginalName,
                  stagedPath: secondPath,
                  contentHash: secondHash,
                  mimeType: item.mimeType,
                  fileSize: secondBytes.length,
                  status: 'sorted',
                  finalFileName: defaultName1 || null,
                  sortingDecision: part2Dec,
                })
                .returning();
              splitPartIds = [part1Row.id, part2Row.id];
            }
            draftBlob.splitIntoItemIds = splitPartIds;
          }

          // Persist the draft state on the lead item.
          // - Draft split: mark lead as rejected (split parts take its place).
          // - Revert draft split: restore lead to sorted.
          // - All other drafts: leave status unchanged.
          const draftStatusUpdate =
            draftDecision === 'split' && splitPartIds.length > 0
              ? { status: 'rejected' as const }
              : revertedDraftSplit
                ? { status: 'sorted' as const }
                : {};
          const [draftUpdated] = await db
            .update(schema.bulkImportItems)
            .set({
              sortingDecision: draftBlob,
              updatedAt: new Date(),
              ...draftStatusUpdate,
              ...(sanitizedFinalFileName !== undefined && { finalFileName: sanitizedFinalFileName }),
            })
            .where(eq(schema.bulkImportItems.id, item.id))
            .returning();
          return res.json({ item: draftUpdated, splitPartIds });
        }

        // -----------------------------------------------------------------
        // NON-DRAFT MODE — existing accept / reject / manual flow.
        // -----------------------------------------------------------------

        if (action === 'reject') {
          // When rejecting a previously-drafted split, clean up the parts.
          const prevSplitIds = Array.isArray(existing.splitIntoItemIds)
            ? (existing.splitIntoItemIds as string[])
            : null;
          if (prevSplitIds && prevSplitIds.length > 0) {
            for (const partId of prevSplitIds) {
              await db.delete(schema.bulkImportItems).where(eq(schema.bulkImportItems.id, partId));
            }
            // Scrub deleted part IDs from any sibling's mergeWithItemIds to avoid stale refs.
            const sessionItems = await db
              .select()
              .from(schema.bulkImportItems)
              .where(eq(schema.bulkImportItems.sessionId, item.sessionId as string));
            for (const sibling of sessionItems) {
              if (sibling.id === item.id) continue;
              const sibDec = (sibling.sortingDecision ?? {}) as Record<string, unknown>;
              const mergeIds = Array.isArray(sibDec.mergeWithItemIds)
                ? (sibDec.mergeWithItemIds as string[])
                : null;
              const legacySingleId = sibDec.mergeWithItemId as string | null | undefined;
              const legacyMatch = legacySingleId && prevSplitIds.includes(legacySingleId);
              if (!mergeIds && !legacyMatch) continue;
              const filtered = mergeIds ? mergeIds.filter((id) => !prevSplitIds.includes(id)) : null;
              const changed = (filtered && filtered.length !== mergeIds!.length) || legacyMatch;
              if (changed) {
                await db
                  .update(schema.bulkImportItems)
                  .set({
                    sortingDecision: {
                      ...sibDec,
                      ...(filtered !== null && { mergeWithItemIds: filtered.length ? filtered : null }),
                      ...(legacyMatch && { mergeWithItemId: null }),
                    },
                    updatedAt: new Date(),
                  })
                  .where(eq(schema.bulkImportItems.id, sibling.id));
              }
            }
          }
          const updated_decision: Record<string, unknown> = {
            ...existing,
            decisionState: 'rejected',
            splitIntoItemIds: null,
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
          draft: false,
          ...(isManual && {
            decision: effectiveDecision,
            mergeWithItemId: effectiveMergeId ?? null,
            mergeWithItemIds: effectiveMergeIds ?? null,
            splitAtPage: effectiveSplitAt ?? null,
            manualOverride: true,
          }),
        };

        // Apply rename if provided on the non-draft accept/manual path.
        if (sanitizedFinalFileName !== undefined) {
          updated_decision.finalFileNameOverride = sanitizedFinalFileName;
        }

        const isPdf = (item.mimeType ?? '').toLowerCase() === 'application/pdf';

        // Helper: emit one structured warning log and return a classified 400.
        // Must be defined after effectiveDecision/Ids/SplitAt are assigned (above).
        const logAndReturn400 = (code: string, error: string, extra?: Record<string, unknown>) => {
          logWarn('[bulk-import] accept failed', {
            action,
            metadata: {
              code,
              itemId: req.params.id,
              sessionId: _capturedSessionId,
              decision: effectiveDecision,
              mergeWithItemIds: effectiveMergeIds,
              splitAtPage: effectiveSplitAt,
              error,
              ...extra,
            },
          });
          return res.status(400).json({ error, code });
        };

        // --- MERGE ---
        if (effectiveDecision === 'merge' && effectiveMergeIds && effectiveMergeIds.length > 0 && isPdf) {
          if (!item.stagedPath || !fs.existsSync(item.stagedPath)) {
            return logAndReturn400('MERGE_LEAD_FILE_MISSING', 'Staged file missing for this item');
          }

          const { PDFDocument } = await import('pdf-lib');

          // Load the lead PDF with recovery for broken page-tree references.
          let leadPdf: import('pdf-lib').PDFDocument;
          try {
            leadPdf = await loadPdfForBulkImport(item.stagedPath);
          } catch (leadLoadErr) {
            return logAndReturn400('MERGE_LEAD_PDF_CORRUPT', 'PDF is corrupt and cannot be repaired automatically — re-export the document from its source application and re-upload.', {
              underlyingError: leadLoadErr instanceof Error ? leadLoadErr.message : String(leadLoadErr),
            });
          }

          // Load and validate each sibling in order, then append.
          const siblingItems: (typeof item)[] = [];
          for (const siblingId of effectiveMergeIds) {
            const [siblingItem] = await db
              .select()
              .from(schema.bulkImportItems)
              .where(eq(schema.bulkImportItems.id, siblingId));
            if (!siblingItem) {
              return logAndReturn400('MERGE_TARGET_NOT_FOUND', `Merge target item not found: ${siblingId}`);
            }
            if ((siblingItem.sessionId as string) !== item.sessionId) {
              return logAndReturn400('MERGE_TARGET_WRONG_SESSION', `Merge target belongs to a different session: ${siblingId}`);
            }
            if ((siblingItem.mimeType ?? '').toLowerCase() !== 'application/pdf') {
              return logAndReturn400('MERGE_TARGET_NOT_PDF', 'Can only merge PDF files together');
            }
            // Reject siblings that have already been merged into another lead.
            const sibDec = (siblingItem.sortingDecision ?? {}) as Record<string, unknown>;
            if (sibDec.mergedIntoItemId && sibDec.mergedIntoItemId !== item.id) {
              return logAndReturn400('MERGE_TARGET_ALREADY_MERGED', `Merge target has already been merged into another document: ${siblingId}`);
            }
            if (!siblingItem.stagedPath || !fs.existsSync(siblingItem.stagedPath)) {
              return logAndReturn400('MERGE_TARGET_FILE_MISSING', `Staged file missing for merge target: ${siblingId}`);
            }
            // copyPagesFromFileWithRecovery handles both getPageCount failures
            // (stage-1, inside loadPdfForBulkImport) and copyPages failures (stage-2,
            // re-encode sibling and retry).  Any un-recoverable error becomes a
            // classified 400 here, never a 500.
            try {
              const copiedPages = await copyPagesFromFileWithRecovery(leadPdf, siblingItem.stagedPath);
              for (const page of copiedPages) leadPdf.addPage(page);
            } catch (copyErr) {
              return logAndReturn400('MERGE_PDF_COPY_FAILED', `Failed to copy pages from merge target: ${siblingItem.originalName} — PDF is corrupt and cannot be repaired automatically. Re-export the document from its source application and re-upload.`, {
                underlyingError: copyErr instanceof Error ? copyErr.message : String(copyErr),
              });
            }
            siblingItems.push(siblingItem);
          }

          let mergedBytes: Buffer;
          try {
            mergedBytes = Buffer.from(await leadPdf.save());
          } catch (saveErr) {
            return logAndReturn400('MERGE_PDF_SAVE_FAILED', 'Failed to serialise merged PDF', {
              underlyingError: saveErr instanceof Error ? saveErr.message : String(saveErr),
            });
          }
          const mergedHash = crypto.createHash('sha256').update(mergedBytes).digest('hex');
          const dir = stagingDirFor(item.sessionId);
          const newPath = path.join(dir, `merged_${mergedHash}_${item.originalName}`);
          try {
            fs.writeFileSync(newPath, mergedBytes);
          } catch (writeErr) {
            return logAndReturn400('MERGE_WRITE_FAILED', 'Failed to write merged PDF to disk', {
              underlyingError: writeErr instanceof Error ? writeErr.message : String(writeErr),
            });
          }

          updated_decision.mergeWithItemIds = effectiveMergeIds;
          updated_decision.mergedFromItemIds = effectiveMergeIds;
          // Keep single-id field for backward compat
          if (siblingItems.length === 1) {
            updated_decision.mergedFromItemId = siblingItems[0].id;
          }

          let updatedItem: typeof item;
          try {
            const [row] = await db
              .update(schema.bulkImportItems)
              .set({
                stagedPath: newPath,
                contentHash: mergedHash,
                sortingDecision: updated_decision,
                updatedAt: new Date(),
                ...(sanitizedFinalFileName !== undefined && { finalFileName: sanitizedFinalFileName }),
              })
              .where(eq(schema.bulkImportItems.id, item.id))
              .returning();
            updatedItem = row;
          } catch (dbErr) {
            return logAndReturn400('MERGE_DB_UPDATE_FAILED', 'Failed to update lead item record after merge', {
              underlyingError: dbErr instanceof Error ? dbErr.message : String(dbErr),
            });
          }

          // Exclude every merged-away sibling with a back-pointer to the lead.
          for (const siblingItem of siblingItems) {
            const siblingDecision: Record<string, unknown> = {
              ...((siblingItem.sortingDecision ?? {}) as Record<string, unknown>),
              decisionState: 'accepted',
              decision: 'merge',
              mergedIntoItemId: item.id,
            };
            try {
              await db
                .update(schema.bulkImportItems)
                .set({
                  status: 'rejected',
                  preExcludeStatus: siblingItem.status,
                  sortingDecision: siblingDecision,
                  updatedAt: new Date(),
                })
                .where(eq(schema.bulkImportItems.id, siblingItem.id));
            } catch (sibDbErr) {
              return logAndReturn400('MERGE_SIBLING_UPDATE_FAILED', `Failed to update sibling item record after merge: ${siblingItem.id}`, {
                underlyingError: sibDbErr instanceof Error ? sibDbErr.message : String(sibDbErr),
              });
            }
          }

          return res.json(updatedItem);
        }

        // --- SPLIT ---
        if (effectiveDecision === 'split' && effectiveSplitAt != null && isPdf) {
          if (!item.stagedPath || !fs.existsSync(item.stagedPath)) {
            return logAndReturn400('SPLIT_FILE_MISSING', 'Staged file missing for this item');
          }

          let sliceResult: Awaited<ReturnType<typeof slicePdf>>;
          try {
            sliceResult = await slicePdf(item.stagedPath, effectiveSplitAt);
          } catch (splitErr) {
            const splitErrMsg = splitErr instanceof Error ? splitErr.message : String(splitErr);
            return logAndReturn400(
              'SPLIT_OPERATION_FAILED',
              `Failed to split PDF — the file is corrupt and cannot be repaired automatically. Re-export the document from its source application and re-upload.`,
              { underlyingError: splitErrMsg },
            );
          }
          const {
            firstBytes, firstHash, firstPath,
            secondBytes, secondHash, secondPath,
            splitPage, totalPages, originalName: splitOriginalName,
          } = sliceResult;

          const splitStem = splitOriginalName.replace(/\.[^.]+$/, '');
          const splitExt = splitOriginalName.replace(/^[^.]*(\..+)?$/, '$1') || '';
          const part1FinalFileName = sanitizedSplitFinalNames?.[0]
            ?? (existing.splitFinalNames as [string, string] | undefined)?.[0]
            ?? null;
          const part2FinalFileName = sanitizedSplitFinalNames?.[1]
            ?? (existing.splitFinalNames as [string, string] | undefined)?.[1]
            ?? null;
          const part2OriginalName = `split2_${splitOriginalName}`;

          updated_decision.splitTotalPages = totalPages;
          updated_decision.splitAtPage = splitPage;
          if (sanitizedSplitFinalNames) {
            updated_decision.splitFinalNames = sanitizedSplitFinalNames;
          }

          // If parts were already materialised by a prior draft, re-use their IDs.
          // Lead remains a container/back-pointer — only its sortingDecision is updated.
          const prevSplitIds = Array.isArray(existing.splitIntoItemIds)
            ? (existing.splitIntoItemIds as string[])
            : null;

          const partDecisionBase: Record<string, unknown> = {
            decision: 'keep',
            reason: 'Created from split',
            confidence: 1,
            decisionState: 'accepted',
            splitFromItemId: item.id,
            splitAtPage: splitPage,
            manualOverride: isManual,
            splitFromOriginalName: item.originalName,
          };

          if (prevSplitIds && prevSplitIds.length >= 2) {
            const [part1Id, part2Id] = prevSplitIds;
            // Update both draft part rows with new slice bytes.
            await db
              .update(schema.bulkImportItems)
              .set({
                stagedPath: firstPath,
                contentHash: firstHash,
                fileSize: firstBytes.length,
                finalFileName: part1FinalFileName || null,
                sortingDecision: { ...partDecisionBase },
                updatedAt: new Date(),
              })
              .where(eq(schema.bulkImportItems.id, part1Id));
            await db
              .update(schema.bulkImportItems)
              .set({
                stagedPath: secondPath,
                contentHash: secondHash,
                fileSize: secondBytes.length,
                finalFileName: part2FinalFileName || null,
                sortingDecision: { ...partDecisionBase },
                updatedAt: new Date(),
              })
              .where(eq(schema.bulkImportItems.id, part2Id));
            // Lead: update decision only, no file changes.
            const [updatedItem] = await db
              .update(schema.bulkImportItems)
              .set({
                sortingDecision: updated_decision,
                updatedAt: new Date(),
                ...(sanitizedFinalFileName !== undefined && { finalFileName: sanitizedFinalFileName }),
              })
              .where(eq(schema.bulkImportItems.id, item.id))
              .returning();
            return res.json(updatedItem);
          } else {
            // No prior draft parts: lead becomes part1, create new sibling for part2.
            const [updatedItem] = await db
              .update(schema.bulkImportItems)
              .set({
                stagedPath: firstPath,
                contentHash: firstHash,
                finalFileName: part1FinalFileName || sanitizedFinalFileName || null,
                sortingDecision: updated_decision,
                updatedAt: new Date(),
              })
              .where(eq(schema.bulkImportItems.id, item.id))
              .returning();
            await db
              .insert(schema.bulkImportItems)
              .values({
                sessionId: item.sessionId,
                originalPath: part2OriginalName,
                originalName: part2OriginalName,
                stagedPath: secondPath,
                contentHash: secondHash,
                mimeType: item.mimeType,
                fileSize: secondBytes.length,
                status: 'sorted',
                finalFileName: part2FinalFileName || null,
                sortingDecision: { ...partDecisionBase },
              });
            return res.json(updatedItem);
          }
        }

        // --- KEEP (or no file operation needed) ---
        const [updated] = await db
          .update(schema.bulkImportItems)
          .set({
            sortingDecision: updated_decision,
            updatedAt: new Date(),
            ...(sanitizedFinalFileName !== undefined && { finalFileName: sanitizedFinalFileName }),
          })
          .where(eq(schema.bulkImportItems.id, item.id))
          .returning();
        return res.json(updated);

      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
        const errMsg = err instanceof Error ? err.message : String(err);
        const errCtx: Record<string, unknown> = {
          itemId: req.params.id,
          sessionId: _capturedSessionId,
          action: req.body?.action,
          decision: req.body?.decision,
          mergeWithItemIds: req.body?.mergeWithItemIds ?? (req.body?.mergeWithItemId ? [req.body.mergeWithItemId] : undefined),
          splitAtPage: req.body?.splitAtPage,
          originalError: errMsg,
          code: 'SORTING_DECISION_INTERNAL_ERROR',
        };
        logError('[bulk-import] accept failed', err as Error, errCtx);
        const userMessage = 'Internal error while processing sorting decision';
        return res.status(500).json({
          error: userMessage,
          message: userMessage,
          code: 'SORTING_DECISION_INTERNAL_ERROR',
        });
      }
    },
  );

  /**
   * Override the AI-detected `screening.periodHint` for a single item
   * during the Sorting step (Task #997). Lets admins fix a wrong period
   * directly on the row instead of re-uploading the file when the
   * Screening AI mis-detected the document's fiscal year, invoice number,
   * or meeting date — values the Sorting analyzer relies on for both the
   * trivially-keep short-circuit (`isTriviallyKeep`) and the merge prompt
   * sibling comparison (see `bulk-import-analyzer.ts`).
   *
   * Body: `{ periodHint: string | null }`
   *   - Non-empty string → set `screening.periodHint` to the trimmed
   *     value and stamp `screening.periodHintManualOverride = true` so
   *     the Sorting chip can render a "Manual" tag.
   *   - `null` (or empty after trim) → clear the period hint and the
   *     manual-override marker so the row falls back to "AI couldn't
   *     determine".
   *
   * After persisting the override, sorting is re-run for:
   *   - The target item itself (its prior sorting decision is overwritten
   *     with the new computation; admin must re-accept).
   *   - Every same-session sibling that shares the target's typeGuess +
   *     bucketGuess (those are the only items whose decision could
   *     plausibly have hinged on the periodHint comparison) AND whose
   *     `sortingDecision.decisionState` is null or 'pending'. Siblings
   *     whose decision the admin has already accepted/rejected are left
   *     alone so we never silently undo a confirmed merge/split file op.
   *
   * Refused (400) when the target item is past the sorting step
   * (status not 'screened' or 'sorted') or its current sorting decision
   * has already been accepted — re-running sorting at that point would
   * either undo a committed file op or contradict downstream steps.
   */
  const setPeriodHintSchema = z.object({
    periodHint: z.string().max(120).nullable(),
  });
  app.post(
    '/api/admin/bulk-import/items/:id/set-period-hint',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { periodHint: rawPeriodHint } = setPeriodHintSchema.parse(req.body);
        const trimmed = typeof rawPeriodHint === 'string' ? rawPeriodHint.trim() : null;
        const nextPeriodHint: string | null = trimmed && trimmed.length > 0 ? trimmed : null;

        const [item] = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.id, req.params.id));
        if (!item) return res.status(404).json({ error: 'Item not found' });

        if (item.status !== 'screened' && item.status !== 'sorted') {
          return res.status(400).json({
            error: 'Period hint can only be edited while the item is on the Sorting step',
          });
        }

        const myScreening = (item.screening ?? {}) as Record<string, unknown>;
        const existingDecision = (item.sortingDecision ?? {}) as Record<string, unknown>;
        const existingDecisionState = existingDecision.decisionState as
          | 'pending'
          | 'accepted'
          | 'rejected'
          | null
          | undefined;
        if (existingDecisionState === 'accepted') {
          return res.status(400).json({
            error:
              'Sorting decision has already been accepted; reset the decision before changing the period',
          });
        }

        // Persist the override on the screening blob. Setting null also
        // clears the manual-override marker so the chip stops showing
        // "Manual" — there's nothing to override anymore.
        const nextScreening: Record<string, unknown> = {
          ...myScreening,
          periodHint: nextPeriodHint,
          periodHintManualOverride: nextPeriodHint !== null,
        };

        await db
          .update(schema.bulkImportItems)
          .set({ screening: nextScreening, updatedAt: new Date() })
          .where(eq(schema.bulkImportItems.id, item.id));

        // Re-fetch the item with the updated screening blob so the
        // re-run sees the new periodHint.
        const [refreshedItem] = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.id, item.id));
        if (!refreshedItem) {
          return res.status(404).json({ error: 'Item disappeared during update' });
        }

        // Build the fresh session-wide sibling context the sorting
        // analyzer expects (id + name + screening blob).
        const sessionRows = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.sessionId, refreshedItem.sessionId));
        const sessionItems = sessionRows.map((s) => ({
          id: s.id,
          name: s.originalName,
          screening: s.screening as Record<string, unknown> | null,
        }));

        // Re-run sorting on the target item (the AI now sees the new period).
        const updatedTarget = await processItemForStep(
          'sorting',
          refreshedItem,
          sessionItems,
        );

        // Determine which siblings depended on the old periodHint and
        // therefore need re-sorting. Same typeGuess + bucketGuess is the
        // necessary condition for the merge-candidate comparison; we
        // skip siblings the admin has already touched (accepted/rejected).
        const myQa = (refreshedItem.screening as Record<string, unknown> | null)
          ?.quickAnalysis as
          | { typeGuess?: string | null; bucketGuess?: string | null }
          | null
          | undefined;
        const myType = myQa?.typeGuess ?? null;
        const myBucket = myQa?.bucketGuess ?? null;

        const sessionItemsByIdAfterTarget = sessionItems.map((s) =>
          s.id === updatedTarget.id
            ? { ...s, screening: updatedTarget.screening as Record<string, unknown> | null }
            : s,
        );

        const resortedSiblingIds: string[] = [];
        if (myType && myBucket) {
          for (const row of sessionRows) {
            if (row.id === refreshedItem.id) continue;
            if (row.status !== 'screened' && row.status !== 'sorted') continue;
            const rowScreening = row.screening as Record<string, unknown> | null;
            const rowQa = rowScreening?.quickAnalysis as
              | { typeGuess?: string | null; bucketGuess?: string | null }
              | null
              | undefined;
            if (rowQa?.typeGuess !== myType || rowQa?.bucketGuess !== myBucket) continue;
            const rowDecision = (row.sortingDecision ?? {}) as Record<string, unknown>;
            const rowState = rowDecision.decisionState as string | null | undefined;
            if (rowState === 'accepted' || rowState === 'rejected') continue;
            await processItemForStep('sorting', row, sessionItemsByIdAfterTarget);
            resortedSiblingIds.push(row.id);
          }
        }

        return res.json({
          item: updatedTarget,
          resortedSiblingIds,
        });
      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
        logError(`[bulk-import] set-period-hint failed for item ${req.params.id}`, err as Error);
        return res.status(500).json({ error: 'Failed to update period hint' });
      }
    },
  );

  /**
   * Override the AI-detected `identification.effectiveDate` for a single
   * staged item (Task #1031). Lets admins type a real date into the
   * identification wizard step instead of leaving the field empty when
   * the screening AI's `periodHint` is the only source we have. The
   * date is JSON-merged into the existing `identification` blob so we
   * never clobber sibling fields the AI also writes (`name`,
   * `description`, `tags`, `confidence`, etc.).
   *
   * Body: `{ effectiveDate: string | null }`
   *   - Non-empty `YYYY-MM-DD` string → set
   *     `identification.effectiveDate` to the trimmed value and stamp
   *     `identification.effectiveDateManualOverride = true`. The
   *     override flag is what the wizard uses to hide the
   *     "from screening" annotation once the admin has typed a value
   *     of their own.
   *   - `null` (or empty string) → drop the override so the commit
   *     loop falls back to the parsed `periodHint` again. Both
   *     `effectiveDate` and `effectiveDateManualOverride` are removed
   *     from the blob so a later AI re-identify is free to repopulate
   *     them.
   *
   * The endpoint is intentionally permissive about `item.status`: the
   * wizard surfaces this control any time the admin is viewing the
   * identification step (which can be the case for items in
   * `branched`, `identified`, or `linked` states), and the merge is
   * harmless for any state because it only writes to the
   * identification JSONB column. The commit-loop guard (the only
   * caller that actually consumes `effectiveDate`) re-resolves the
   * value at commit time, so a stale override on a later-rejected
   * item never reaches a real Document row.
   */
  const setEffectiveDateSchema = z.object({
    effectiveDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveDate must be a YYYY-MM-DD string')
      .nullable(),
  });
  app.post(
    '/api/admin/bulk-import/items/:id/set-effective-date',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { effectiveDate: rawEffectiveDate } = setEffectiveDateSchema.parse(req.body);
        const trimmed = typeof rawEffectiveDate === 'string' ? rawEffectiveDate.trim() : null;
        const nextEffectiveDate: string | null = trimmed && trimmed.length > 0 ? trimmed : null;

        // Sanity-check the date — z.regex above already enforces the
        // YYYY-MM-DD shape, but we also require it to be a real
        // calendar date so "2024-02-31" doesn't sneak through.
        if (nextEffectiveDate !== null) {
          const [yStr, mStr, dStr] = nextEffectiveDate.split('-');
          const y = parseInt(yStr, 10);
          const m = parseInt(mStr, 10);
          const d = parseInt(dStr, 10);
          const probe = new Date(Date.UTC(y, m - 1, d));
          if (
            probe.getUTCFullYear() !== y
            || probe.getUTCMonth() !== m - 1
            || probe.getUTCDate() !== d
          ) {
            return res.status(400).json({ error: 'effectiveDate is not a valid calendar date' });
          }
        }

        const [item] = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.id, req.params.id));
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

        // JSON-merge into the existing identification blob (or seed a
        // fresh one). When the override is cleared we strip both the
        // value and the override marker so a later AI re-identify can
        // repopulate the field cleanly.
        const existingIdentification = (item.identification ?? {}) as Record<string, unknown>;
        const nextIdentification: Record<string, unknown> = { ...existingIdentification };
        if (nextEffectiveDate === null) {
          delete nextIdentification.effectiveDate;
          delete nextIdentification.effectiveDateManualOverride;
        } else {
          nextIdentification.effectiveDate = nextEffectiveDate;
          nextIdentification.effectiveDateManualOverride = true;
        }

        const [updated] = await db
          .update(schema.bulkImportItems)
          .set({ identification: nextIdentification, updatedAt: new Date() })
          .where(eq(schema.bulkImportItems.id, item.id))
          .returning();
        if (!updated) return res.status(404).json({ error: 'Item not found' });
        return res.json(updated);
      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
        logError(`[bulk-import] set-effective-date failed for item ${req.params.id}`, err as Error);
        return res.status(500).json({ error: 'Failed to update effective date' });
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

          // Task #1047: short-circuit when *this specific item* is
          // already being processed. Two cases:
          //   1. A previous per-item retry on the same item+step is
          //      still running in the background (in-process Set,
          //      catches double-clicks before the heartbeat lands).
          //   2. The run-all loop has THIS item in its `inFlight`
          //      list right now. The run-all heartbeat persists that
          //      list every RUN_ALL_HEARTBEAT_THROTTLE_MS so a
          //      concurrent worker on this item is visible here.
          //      Queuing a duplicate AI call would race the worker's
          //      writes. Items the run-all loop *hasn't* picked up
          //      yet (still queued, or already done) are not in
          //      this list, so the admin can still retry them.
          // Both cases return the current snapshot so the UI keeps the
          // existing in-flight indicator and the user sees no error.
          const itemKey = perItemRetryKey(item.id, step);
          const session = await loadSession(item.sessionId);
          const runAllInFlight = session
            ? (getRunAllMap(session.progress)[step]?.inFlight ?? [])
            : [];
          const itemAlreadyInFlight = runAllInFlight.some(
            (e) => e.itemId === item.id,
          );
          if (inFlightPerItemRetry.has(itemKey) || itemAlreadyInFlight) {
            return res.json(item);
          }

          // Mark in-flight BEFORE returning so a near-simultaneous
          // second click can't slip past the gate above.
          inFlightPerItemRetry.add(itemKey);

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
          // Reuses the `session` loaded above for the in-flight gate.
          let residences: Array<{ id: string; unitNumber: string }> | undefined;
          if (step === 'branching' && session?.buildingId) {
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

          // Task #1030: identification retries also need the building's
          // fiscal-year-start month so periodHint fiscal ranges line up
          // with the bulk run-all path.
          let fiscalYearStartMonth: number | undefined;
          if (step === 'identification') {
            fiscalYearStartMonth = await getFiscalYearStartMonthForBuilding(
              session?.buildingId ?? null,
            );
          }

          // Surface the in-flight state via the same `runAll[step].inFlight`
          // shape the wizard already polls (Task #1047). Awaited so the
          // immediate response below reflects the marker; the UI's polling
          // loop will see it on its next tick.
          await addPerItemRetryInFlight(item.sessionId, step, {
            id: item.id,
            originalName: item.originalName,
          });

          // Fire-and-forget: do the AI call in the background so the HTTP
          // response goes out within milliseconds, regardless of how long
          // Anthropic takes. The Replit edge proxy used to kill the
          // connection with 502 when this ran inline (Task #1047).
          const work = (async () => {
            try {
              await withItemTimeout(
                processItemForStep(
                  step,
                  item,
                  sessionItems.map((s) => ({
                    id: s.id,
                    name: s.name,
                    screening: s.screening as Record<string, unknown> | null,
                  })),
                  residences,
                  fiscalYearStartMonth,
                ),
                RUN_ALL_ITEM_TIMEOUT_MS,
                item.originalName,
              );
            } catch (err) {
              const isTimeout = (err as Error).message?.includes('timed out');
              logError(
                `[bulk-import] per-item ${step} ${isTimeout ? 'timeout' : 'error'} for item ${item.id}`,
                err as Error,
              );
              if (isTimeout) {
                // Mirror the run-all path: persist a step-appropriate
                // fallback so the row shows the error badge instead of
                // hanging in its pre-step status forever.
                try {
                  await persistTimeoutFallback(step, item);
                } catch (e) {
                  logError(
                    '[bulk-import] persistTimeoutFallback failed (per-item retry)',
                    e as Error,
                  );
                }
              }
            } finally {
              inFlightPerItemRetry.delete(itemKey);
              try {
                await removePerItemRetryInFlight(item.sessionId, step, item.id);
              } catch (e) {
                logError(
                  '[bulk-import] removePerItemRetryInFlight failed',
                  e as Error,
                );
              }
            }
          })();
          // Surface unexpected errors from the IIFE itself so they don't
          // become unhandled rejections (defensive — the inner try/catch
          // already covers the AI path).
          void work.catch((e) =>
            logError('[bulk-import] per-item background task crashed', e as Error),
          );

          return res.json(item);
        } catch (err) {
          // Defensive: ensure we don't leak the in-flight marker if the
          // pre-flight DB lookups above throw before the background task
          // is scheduled.
          try {
            const id = req.params.id;
            inFlightPerItemRetry.delete(perItemRetryKey(id, step));
          } catch {
            /* noop */
          }
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
   * Task #1068 — Per-step "Retry step from scratch" reset.
   *
   * Wipes the AI decision and any decision-state markers for the given
   * step on every non-excluded, non-committed item in the session,
   * reverts those items back to the pre-step status so the run-all
   * loop will pick them up again, cancels any in-flight loop / per-item
   * retry for the same (session, step) the same cooperative way the
   * session-clear endpoint does, drops the `progress.runAll[step]`
   * payload so the wizard sees a clean "Starting…" state, and
   * fire-and-forgets a fresh run-all loop.
   *
   * Items in `committed`, `rejected`, or `duplicate` status are left
   * alone — admin-curated exclusions and already-promoted documents
   * survive the reset. Other steps' JSON columns and the session's
   * own metadata (currentStep, status, …) are also untouched: this is
   * surgical to one step.
   */
  const resetStepSchema = z.object({
    step: z.enum(['screening', 'sorting', 'branching', 'identification', 'linking']),
  });
  app.post(
    '/api/admin/bulk-import/sessions/:id/reset-step',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { step } = resetStepSchema.parse(req.body);
        const session = await loadSession(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        // Cooperative cancellation, same pattern as session-clear:
        // dropping the key signals the worker loop to break on its
        // next iteration. Workers mid-AI-call may still write a
        // single stale row before noticing — that is harmless because
        // the new loop kicked off below will reprocess the item.
        const key = runAllKey(session.id, step);
        inFlightRunAll.delete(key);

        // Drop any per-item retry markers for THIS session and step
        // so a stale "in-flight" gate can't block the new loop.
        const sessionItemIdRows = await db
          .select({ id: schema.bulkImportItems.id })
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.sessionId, session.id));
        for (const { id } of sessionItemIdRows) {
          inFlightPerItemRetry.delete(perItemRetryKey(id, step));
        }

        // Revert eligible rows: clear the matching per-step JSON
        // column (which carries decisionState / manualOverride /
        // residence-confirm flags inside it) and set the status back
        // to the pre-step value so the run-all loop's
        // STEP_ELIGIBLE_STATUSES filter will pick them up.
        const eligibleStatuses = STEP_RESET_STATUSES[step];
        const preStatus = STEP_PRE_STATUS[step];
        const where = and(
          eq(schema.bulkImportItems.sessionId, session.id),
          inArray(schema.bulkImportItems.status, eligibleStatuses),
        );
        const baseSet = { status: preStatus, updatedAt: new Date() } as const;
        if (step === 'screening') {
          await db
            .update(schema.bulkImportItems)
            .set({ ...baseSet, screening: null })
            .where(where);
        } else if (step === 'sorting') {
          await db
            .update(schema.bulkImportItems)
            .set({ ...baseSet, sortingDecision: null })
            .where(where);
        } else if (step === 'branching') {
          await db
            .update(schema.bulkImportItems)
            .set({ ...baseSet, branchDecision: null })
            .where(where);
        } else if (step === 'identification') {
          await db
            .update(schema.bulkImportItems)
            .set({ ...baseSet, identification: null })
            .where(where);
        } else {
          // linking
          await db
            .update(schema.bulkImportItems)
            .set({ ...baseSet, linkDecisions: null })
            .where(where);
        }

        // Drop progress.runAll[step] entirely so the wizard's progress
        // banner shows "Starting…" again instead of a stale
        // "X of Y processed — Done" snapshot.
        const fresh = await loadSession(session.id);
        const runAll = getRunAllMap(fresh?.progress);
        delete runAll[step];
        const nextProgress = {
          ...((fresh?.progress ?? {}) as Record<string, unknown>),
          runAll,
        };
        await db
          .update(schema.bulkImportSessions)
          .set({ progress: nextProgress, updatedAt: new Date() })
          .where(eq(schema.bulkImportSessions.id, session.id));

        // Fire-and-forget the new loop, same as the run-all endpoint.
        // Returns immediately so the wizard can re-poll for the fresh
        // progress payload.
        void runAllForStep(session.id, step);

        const updated = await loadSession(session.id);
        return res.json({
          step,
          session: updated,
        });
      } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
        logError('[bulk-import] reset-step failed', err as Error);
        return res.status(500).json({ error: 'Failed to reset step' });
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

        // Resolve effectiveDate in priority order (Task #1003):
        //   1. identification.effectiveDate (AI-extracted, or admin-edited through the UI)
        //   2. Parsed periodHint from screening (new fallback)
        //   3. null — when neither source produced a usable date
        // We parse the periodHint with parsePeriodHint() so non-date hints
        // like invoice numbers are never coerced into garbage dates.
        // Task #1030: pass the building's fiscal-year-start month so a
        // fiscal-year hint like "FY 2022-2023" on a building with an April
        // fiscal year writes 2022-04-01 to documents.effective_date instead
        // of the old Jan 1 default.
        const rawPeriodHintForCommit =
          (item.screening as { periodHint?: string | null } | null)?.periodHint ?? null;
        const fiscalYearStartMonthForCommit = await getFiscalYearStartMonthForBuilding(
          session.buildingId,
        );
        const periodHintDateForCommit = parsePeriodHint(
          rawPeriodHintForCommit,
          fiscalYearStartMonthForCommit,
        );
        const branchDecision = (item.branchDecision as {
          branch?: string;
          residenceId?: string | null;
        } | null) ?? {};
        const branch = branchDecision.branch ?? 'building_documents';
        const residenceId = branch === 'residence_documents'
          ? (branchDecision.residenceId ?? null)
          : null;

        // finalFileName takes precedence over the AI identification name
        // for the display name and the on-disk filename.  If neither is set,
        // fall back to the original upload name.
        // finalFileName may be stored as a stem (no extension); append the
        // original file extension when the stem has none, so committed
        // documents always retain their file extension.
        const itemSortingDecision = (item.sortingDecision ?? {}) as Record<string, unknown>;
        // For split-part items the `originalName` follows "stem (N).ext" and is fine,
        // but if an older row has "stem.ext (N)" format we derive ext from the source
        // original stored in the decision blob to guarantee a clean file extension.
        const extSourceName = (itemSortingDecision.splitFromOriginalName as string | null)
          ?? item.originalName;
        const origExt = extSourceName.replace(/^[^.]*(\..+)?$/, '$1') || '';
        const effectiveFinalFileName = item.finalFileName
          ? (item.finalFileName.includes('.') ? item.finalFileName : `${item.finalFileName}${origExt}`)
          : null;
        const displayName = effectiveFinalFileName ?? ident.name ?? item.originalName;
        const diskName = effectiveFinalFileName ?? item.originalName;

        const filePath = documentService.normalizePath(
          documentService.buildHierarchicalPath(
            { type: 'documents', buildingId: session.buildingId },
            diskName,
          ),
        );

        const [doc] = await db
          .insert(schema.documents)
          .values({
            name: displayName,
            description: ident.description ?? null,
            documentType: branch,
            filePath,
            fileName: diskName,
            originalFileName: (itemSortingDecision.splitFromOriginalName as string | null) ?? item.originalName,
            fileSize: item.fileSize ?? null,
            mimeType: item.mimeType ?? null,
            buildingId: session.buildingId,
            uploadedById: req.user!.id,
            effectiveDate:
              ident.effectiveDate
                ? new Date(ident.effectiveDate)
                : (periodHintDateForCommit ?? null),
            ...(residenceId ? { residenceId } : {}),
          })
          .returning();

        // Idempotent fingerprint upsert. On conflict (same org + content hash)
        // we do nothing so the first-committed document's finalDocumentId is
        // preserved. The new Task #1002 source fields are also only written on
        // first insert; subsequent commits of the same file are no-ops.
        await db
          .insert(schema.clientDocumentFingerprints)
          .values({
            organizationId: session.organizationId,
            buildingId: session.buildingId,
            contentHash: item.contentHash,
            finalDocumentId: doc.id,
            sourceFileName: item.originalName,
            sourceSessionId: session.id,
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
