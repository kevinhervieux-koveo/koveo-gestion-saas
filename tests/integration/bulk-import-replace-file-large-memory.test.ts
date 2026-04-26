// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * @jest-environment node
 *
 * Task #1097 — prove the bulk-import inline "Replace file" /
 * "Téléverser à nouveau" route does NOT balloon Node's resident
 * memory under a single large upload.
 *
 * Task #1061 swapped the bulk-import multer config from
 * `memoryStorage()` to `diskStorage()`, and Task #1067 (see
 * `tests/integration/bulk-import-upload-large-batch-memory.test.ts`)
 * locks down the heap-delta property for the BATCH upload route.
 * The single-file replace endpoint shares that same multer config,
 * but nothing pinned the property down for IT — a future change that
 * gives the replace route its own multer instance, or that buffers
 * the replacement bytes for a re-hash, would slip through unnoticed.
 *
 * This test:
 *   1. Spins up the real bulk-import replace-file route on an
 *      ephemeral port, backed by the same thin in-memory DB fake the
 *      disk-streaming and large-batch tests use (no Postgres
 *      dependency).
 *   2. Streams ONE large (~50MB) synthetic file in a single multipart
 *      request via `form-data` + `http.request` — without buffering
 *      the full payload in the test client first, so the "before"
 *      baseline reflects a clean process.
 *   3. Polls `process.memoryUsage()` while the upload is in flight to
 *      capture peak `rss`, `heapUsed`, and `external`.
 *   4. Asserts each peak delta is well under the file size. If the
 *      replace path ever re-introduces `memoryStorage()` or buffers
 *      the body for a re-hash, the peak would be roughly equal to
 *      the file size and this test would fail loudly.
 *
 * Opt-in: gated on `RUN_PERF_TESTS=1` (same flag as Task #1067)
 * because moving 50MB of bytes through the full HTTP/multipart/disk
 * pipeline is too heavy for a default `npm test` run on a constrained
 * CI box. The intent is for this to live alongside Task #1067 in the
 * same "perf" CI job (or nightly) and fail loudly if anyone
 * re-introduces in-memory buffering on the replace path.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import express from 'express';
import * as nodeFs from 'fs';
import * as nodeOs from 'os';
import * as nodePath from 'path';
import * as nodeHttp from 'http';
import { Readable } from 'stream';
import FormData from 'form-data';

const PERF_ENABLED = process.env.RUN_PERF_TESTS === '1';
const describeIfPerf = PERF_ENABLED ? describe : describe.skip;

jest.mock('drizzle-orm', () => require('../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../manual-mocks/drizzle-orm/pg-core'));

const SESSION_ID = 'sess-replace-mem-1097';
const ORG_ID = 'org-replace-mem-1097';
const ADMIN_ID = 'admin-replace-mem-1097';
const ITEM_ID = 'item-replace-mem-1097';
// Per-test staging dir under `os.tmpdir()` (mirrors the disk-streaming
// unit test's Task #1086 setup): we explicitly point the route's
// `getBulkImportStagingRoot()` here BEFORE requiring the route module
// so an operator-set `BULK_IMPORT_STAGING_ROOT` in CI cannot misroute
// the upload destination.
//
// Both the `mkdtempSync` and the `process.env` mutation are gated on
// `PERF_ENABLED`. When `RUN_PERF_TESTS!=1` the surrounding
// `describeIfPerf` is `describe.skip`, so its `beforeAll`/`afterAll`
// hooks never run — meaning a top-level env mutation here would leak
// `BULK_IMPORT_STAGING_ROOT` into any later tests in the same Jest
// worker that import this file. Guarding both keeps non-perf imports
// completely side-effect-free. Mirrors Task #1067/#1086/#1089's
// pattern in `bulk-import-upload-large-batch-memory.test.ts`.
const STAGING_ROOT = PERF_ENABLED
  ? nodeFs.mkdtempSync(
      nodePath.join(nodeOs.tmpdir(), 'bulk-import-replace-mem-test-'),
    )
  : '';
const PREV_STAGING_ROOT_ENV = process.env.BULK_IMPORT_STAGING_ROOT;
if (PERF_ENABLED) {
  process.env.BULK_IMPORT_STAGING_ROOT = STAGING_ROOT;
}
const SESSION_DIR = PERF_ENABLED ? nodePath.join(STAGING_ROOT, SESSION_ID) : '';
const SEEDED_OLD_NAME = 'corrupt-original.pdf';
const SEEDED_OLD_HASH =
  '0000000000000000000000000000000000000000000000000000000000000001';
const SEEDED_OLD_PATH = nodePath.join(
  SESSION_DIR,
  `${SEEDED_OLD_HASH}_${SEEDED_OLD_NAME}`,
);

// Default knobs sized to make the in-memory regression unmistakable
// without requiring an enormous CI box. A single 80MB file is enough
// to push every memory signal well past the limits below if the
// replace path ever buffers the full body, while staying safely under
// multer's 100MB-per-file `limits.fileSize` cap (Task #1061) so the
// upload itself isn't rejected. Knobs can be overridden from the env
// so the perf job can dial them up further (within the 100MB ceiling).
const FILE_SIZE = Number(process.env.PERF_REPLACE_FILE_SIZE_BYTES ?? 80 * 1024 * 1024);

// Same calibration rationale as Task #1067's batch-memory test:
//   - RSS is the PRIMARY signal because multer's `memoryStorage()`
//     (the regression we are guarding against) accumulates Node
//     `Buffer`s in the off-heap allocator, which barely move V8's
//     `heapUsed` at all.
//   - `external` is the SECONDARY (and arguably most precise) signal
//     because it isolates Buffer-backed allocations from generic
//     kernel/libc RSS noise.
//   - `heapUsed` stays as a tertiary check so a regression that DOES
//     buffer into V8 (e.g. a `req.body` JSON-decoded upload, an
//     accidental `Buffer.concat()` over the whole body interpreted
//     as a string) still trips this test.
// Local runs on an 80MB single-file payload show peak RSS deltas of
// ~30–40MB and peak external deltas of ~30–40MB; the defaults below
// leave ~1.5x headroom over those measurements, while a
// `memoryStorage()` regression (which would push BOTH `rss` and
// `external` deltas to ≥ payload size) would still blow past them
// by another ~2x.
const PEAK_RSS_LIMIT_RATIO = Number(process.env.PERF_REPLACE_PEAK_RSS_RATIO ?? 0.6);
const PEAK_RSS_LIMIT = Math.floor(FILE_SIZE * PEAK_RSS_LIMIT_RATIO);

const PEAK_EXTERNAL_LIMIT_RATIO = Number(
  process.env.PERF_REPLACE_PEAK_EXTERNAL_RATIO ?? 0.7,
);
const PEAK_EXTERNAL_LIMIT = Math.floor(FILE_SIZE * PEAK_EXTERNAL_LIMIT_RATIO);

const PEAK_HEAP_LIMIT_RATIO = Number(process.env.PERF_REPLACE_PEAK_HEAP_RATIO ?? 0.25);
const PEAK_HEAP_LIMIT = Math.floor(FILE_SIZE * PEAK_HEAP_LIMIT_RATIO);

const FAKE_SESSION = {
  id: SESSION_ID,
  organizationId: ORG_ID,
  buildingId: 'bld-replace-mem-1097',
  adminUserId: ADMIN_ID,
  currentStep: 'sorting',
  status: 'active',
  progress: {},
};

// One pre-seeded item the replace route looks up by `req.params.id`.
// `stagedPath` points at a file we create on disk in `beforeEach` so
// the route's best-effort old-bytes cleanup actually has something to
// remove (matching the production flow where the prior staged file
// always exists).
const seededItem: Record<string, any> = {
  id: ITEM_ID,
  sessionId: SESSION_ID,
  originalPath: SEEDED_OLD_NAME,
  originalName: SEEDED_OLD_NAME,
  stagedPath: SEEDED_OLD_PATH,
  contentHash: SEEDED_OLD_HASH,
  mimeType: 'application/pdf',
  fileSize: 1024,
  status: 'sorted',
  preExcludeStatus: null,
  excludeSource: null,
  finalFileName: null,
  screening: { docType: 'minutes', confidence: 0.9 },
  sortingDecision: 'accepted',
  branchDecision: { branch: 'building_documents' },
  identification: { name: 'AGM 2024' },
  linkDecisions: null,
  finalDocumentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Same in-memory DB fake shape as the disk-streaming unit test
// (`tests/unit/api/bulk-import-upload-disk-streaming.test.ts`),
// extended with a minimal `update().set().where().returning()` chain
// because the replace route mutates the row in place. Each
// `db.<verb>(...)` call returns its own builder so concurrent
// queries do not leak state into each other.
jest.mock('../../server/db', () => {
  function builder() {
    let pendingValues: Record<string, any> | null = null;
    let pendingIdFilter: string | null = null;
    let mode:
      | 'select-session'
      | 'select-item'
      | 'select-empty'
      | 'update-item'
      | 'unknown' = 'unknown';

    const api: any = {
      select() {
        return api;
      },
      from(table: any) {
        const sym =
          (table &&
            (table[Symbol.for('drizzle:Name')] ||
              table[Symbol.for('drizzle:BaseName')])) ||
          (table && table.name);
        if (sym === 'bulk_import_sessions') mode = 'select-session';
        else if (sym === 'bulk_import_items') mode = 'select-item';
        else mode = 'select-empty';
        return api;
      },
      where(predicate: any) {
        if (predicate && typeof predicate === 'object' && 'value' in predicate) {
          pendingIdFilter = String(predicate.value);
        }
        return api;
      },
      limit() {
        return api;
      },
      leftJoin() {
        return api;
      },
      update(table: any) {
        const sym =
          (table &&
            (table[Symbol.for('drizzle:Name')] ||
              table[Symbol.for('drizzle:BaseName')])) ||
          (table && table.name);
        if (sym === 'bulk_import_items') mode = 'update-item';
        else mode = 'unknown';
        return api;
      },
      set(v: Record<string, any>) {
        pendingValues = v;
        return api;
      },
      returning() {
        if (mode === 'update-item' && pendingValues && pendingIdFilter === seededItem.id) {
          Object.assign(seededItem, pendingValues);
          return Promise.resolve([{ ...seededItem }]);
        }
        return Promise.resolve([]);
      },
      then(resolve: any, reject: any) {
        let result: any[] = [];
        if (mode === 'select-session') result = [FAKE_SESSION];
        else if (mode === 'select-item' && pendingIdFilter === seededItem.id) {
          result = [{ ...seededItem }];
        } else {
          result = [];
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return api;
  }

  return {
    db: {
      select: (...args: any[]) => builder().select(...args),
      update: (...args: any[]) => builder().update(...args),
    },
  };
});

jest.mock('../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: ADMIN_ID, role: 'admin', organizationId: ORG_ID };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../server/rbac', () => ({
  canUserAccessOrganization: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}));

/**
 * Synthetic file: pushes `size` bytes of cheap fill in 64KB chunks.
 * Unlike the batch-memory test, only one file is uploaded so we don't
 * need per-file uniqueness — a constant fill byte keeps the test
 * client cheap while still exercising the disk-streaming path
 * end-to-end.
 */
function makeFileStream(size: number): Readable {
  const CHUNK = 64 * 1024;
  let remaining = size;
  return new Readable({
    read() {
      if (remaining <= 0) {
        this.push(null);
        return;
      }
      const len = Math.min(CHUNK, remaining);
      this.push(Buffer.alloc(len, 0x42));
      remaining -= len;
    },
  });
}

describeIfPerf('Task #1097 — bulk-import replace-file keeps memory bounded', () => {
  let app: express.Application;
  let server: nodeHttp.Server;
  let port: number;

  beforeAll((done) => {
    nodeFs.mkdirSync(SESSION_DIR, { recursive: true });
    app = express();
    app.use(express.json());
    const { registerBulkImportRoutes } = require('../../server/api/bulk-import');
    registerBulkImportRoutes(app);
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      done();
    });
  });

  afterAll((done) => {
    try {
      nodeFs.rmSync(STAGING_ROOT, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
    if (PREV_STAGING_ROOT_ENV === undefined) {
      delete process.env.BULK_IMPORT_STAGING_ROOT;
    } else {
      process.env.BULK_IMPORT_STAGING_ROOT = PREV_STAGING_ROOT_ENV;
    }
    server.close(() => done());
  });

  beforeEach(() => {
    // Reset the seeded item back to its pre-replace state and recreate
    // its on-disk staged file so the route's old-bytes cleanup has
    // something to delete (production parity).
    seededItem.originalPath = SEEDED_OLD_NAME;
    seededItem.originalName = SEEDED_OLD_NAME;
    seededItem.stagedPath = SEEDED_OLD_PATH;
    seededItem.contentHash = SEEDED_OLD_HASH;
    seededItem.mimeType = 'application/pdf';
    seededItem.fileSize = 1024;
    seededItem.status = 'sorted';
    for (const entry of nodeFs.readdirSync(SESSION_DIR)) {
      try {
        nodeFs.unlinkSync(nodePath.join(SESSION_DIR, entry));
      } catch {
        /* best-effort */
      }
    }
    nodeFs.writeFileSync(SEEDED_OLD_PATH, Buffer.alloc(1024, 0x00));
  });

  it(
    `peak memory deltas stay bounded while replacing a single ~${(FILE_SIZE / 1024 / 1024).toFixed(0)}MB file`,
    async () => {
      // Build a streaming multipart body so the test client itself does
      // not have to buffer the full payload up-front. If we used
      // supertest's `.attach(field, Buffer)` here, the entire payload
      // would sit in `superagent`'s internal form-data buffer at the
      // moment we sample the baseline, and we'd be measuring the test
      // harness instead of the route.
      const form = new FormData();
      form.append('files', makeFileStream(FILE_SIZE), {
        filename: 'replacement.pdf',
        contentType: 'application/pdf',
        knownLength: FILE_SIZE,
      });

      // Force a clean baseline when `--expose-gc` is enabled. Without
      // GC the heap baseline is just conservative (older garbage may
      // still be on the heap), which only makes the assertion easier
      // to satisfy — never harder — so this is safe either way.
      if (typeof (global as any).gc === 'function') (global as any).gc();
      const baseline = process.memoryUsage();

      let peakRss = baseline.rss;
      let peakHeap = baseline.heapUsed;
      let peakExternal = baseline.external;
      const sampler = setInterval(() => {
        const m = process.memoryUsage();
        if (m.rss > peakRss) peakRss = m.rss;
        if (m.heapUsed > peakHeap) peakHeap = m.heapUsed;
        if (m.external > peakExternal) peakExternal = m.external;
      }, 25);
      sampler.unref?.();

      let responseBody: string;
      try {
        responseBody = await new Promise<string>((resolve, reject) => {
          const headers = form.getHeaders({
            'content-length': String(form.getLengthSync()),
          });
          const req = nodeHttp.request(
            {
              method: 'POST',
              host: '127.0.0.1',
              port,
              path: `/api/admin/bulk-import/items/${ITEM_ID}/replace-file`,
              headers,
            },
            (res) => {
              const chunks: Buffer[] = [];
              res.on('data', (c: Buffer) => chunks.push(c));
              res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                if (res.statusCode !== 200) {
                  reject(
                    new Error(
                      `Replace failed with status ${res.statusCode}: ${body.slice(0, 500)}`,
                    ),
                  );
                  return;
                }
                resolve(body);
              });
            },
          );
          req.on('error', reject);
          form.pipe(req);
        });
      } finally {
        clearInterval(sampler);
      }

      if (typeof (global as any).gc === 'function') (global as any).gc();
      const after = process.memoryUsage();

      const peakRssDelta = peakRss - baseline.rss;
      const peakHeapDelta = peakHeap - baseline.heapUsed;
      const peakExternalDelta = peakExternal - baseline.external;
      const afterRssDelta = after.rss - baseline.rss;
      const afterHeapDelta = after.heapUsed - baseline.heapUsed;
      const afterExternalDelta = after.external - baseline.external;

      // Sanity: the route did stage the new file, returned the updated
      // row, and replaced the on-disk bytes (so we know we truly moved
      // bytes through the disk-streaming path).
      const updated = JSON.parse(responseBody) as Record<string, any>;
      expect(updated.id).toBe(ITEM_ID);
      expect(updated.fileSize).toBe(FILE_SIZE);
      expect(updated.originalName).toBe('replacement.pdf');
      expect(typeof updated.stagedPath).toBe('string');
      expect(updated.stagedPath).not.toBe(SEEDED_OLD_PATH);
      expect(nodeFs.existsSync(updated.stagedPath)).toBe(true);
      expect(nodeFs.statSync(updated.stagedPath).size).toBe(FILE_SIZE);
      // Old bytes were swept up by the best-effort cleanup.
      expect(nodeFs.existsSync(SEEDED_OLD_PATH)).toBe(false);

      // Surface the numbers so a regression PR's CI output makes the
      // breach obvious instead of just "expected X to be less than Y".
      // eslint-disable-next-line no-console
      console.log(
        `[task-1097] payload=${(FILE_SIZE / 1024 / 1024).toFixed(1)}MB ` +
          `baselineRss=${(baseline.rss / 1024 / 1024).toFixed(1)}MB ` +
          `baselineHeap=${(baseline.heapUsed / 1024 / 1024).toFixed(1)}MB ` +
          `baselineExternal=${(baseline.external / 1024 / 1024).toFixed(1)}MB ` +
          `peakRssDelta=${(peakRssDelta / 1024 / 1024).toFixed(1)}MB ` +
          `peakHeapDelta=${(peakHeapDelta / 1024 / 1024).toFixed(1)}MB ` +
          `peakExternalDelta=${(peakExternalDelta / 1024 / 1024).toFixed(1)}MB ` +
          `afterRssDelta=${(afterRssDelta / 1024 / 1024).toFixed(1)}MB ` +
          `afterHeapDelta=${(afterHeapDelta / 1024 / 1024).toFixed(1)}MB ` +
          `afterExternalDelta=${(afterExternalDelta / 1024 / 1024).toFixed(1)}MB ` +
          `limits: rss=${(PEAK_RSS_LIMIT / 1024 / 1024).toFixed(1)}MB ` +
          `external=${(PEAK_EXTERNAL_LIMIT / 1024 / 1024).toFixed(1)}MB ` +
          `heap=${(PEAK_HEAP_LIMIT / 1024 / 1024).toFixed(1)}MB`,
      );

      // The property under test: disk-streaming caps in-memory cost at
      // one chunk per in-flight file plus normal request overhead, so
      // ALL THREE memory signals must stay well below the file size.
      // If any of these fails, someone almost certainly re-introduced
      // a `multer.memoryStorage()` instance for this route (which
      // inflates `rss` and `external` via off-heap Node `Buffer`s) or
      // a `Buffer.concat()` over the whole body somewhere downstream
      // (which inflates `heapUsed` if the buffer is interpreted as a
      // string/JSON in the V8 heap).
      expect(peakRssDelta).toBeLessThan(PEAK_RSS_LIMIT);
      expect(peakExternalDelta).toBeLessThan(PEAK_EXTERNAL_LIMIT);
      expect(peakHeapDelta).toBeLessThan(PEAK_HEAP_LIMIT);
    },
    180_000,
  );
});
