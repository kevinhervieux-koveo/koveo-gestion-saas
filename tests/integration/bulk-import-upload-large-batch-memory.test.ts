// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * @jest-environment node
 *
 * Task #1067 — prove the bulk-import upload route does NOT balloon
 * Node's resident memory under a large batch.
 *
 * Task #1061 swapped multer from `memoryStorage()` to `diskStorage()`
 * so that uploading ~30 multi-MB scanned PDFs in one request no longer
 * OOM-kills the Node process and surfaces as a 502 to the wizard. The
 * existing functional coverage in
 * `tests/unit/api/bulk-import-upload-disk-streaming.test.ts` pins down
 * the new code paths (hash, staged path, end-to-end stream-back), but
 * none of them assert the property the fix exists for: that the
 * server's heap stays roughly flat regardless of batch size.
 *
 * This test:
 *   1. Spins up the real bulk-import upload route on an ephemeral port,
 *      backed by the same thin in-memory DB fake the disk-streaming
 *      unit test uses (no Postgres dependency).
 *   2. Streams ~30 multi-MB synthetic files in a single multipart
 *      request via `form-data` + `http.request` — crucially WITHOUT
 *      buffering the full payload in the test client first, so the
 *      "before" baseline reflects a clean process.
 *   3. Polls `process.memoryUsage()` while the upload is in flight to
 *      capture peak `rss` and `heapUsed`.
 *   4. Asserts the peak heap delta is well under the total bytes
 *      uploaded (currently 25%). If a future change re-introduces
 *      `memoryStorage()` or otherwise buffers a whole file body into
 *      the heap, the peak would be roughly equal to the payload size
 *      and this test would fail loudly.
 *
 * Opt-in: gated on `RUN_PERF_TESTS=1` because moving 150MB of bytes
 * through the full HTTP/multipart/disk-write pipeline is too heavy for
 * a default `npm test` run on a constrained CI box. The intent is for
 * this to live in CI as a separate "perf" job (or a nightly run) and
 * fail loudly if anyone re-introduces in-memory buffering.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import express from 'express';
import * as nodeFs from 'fs';
import * as nodePath from 'path';
import * as nodeCrypto from 'crypto';
import * as nodeHttp from 'http';
import { Readable } from 'stream';
import FormData from 'form-data';

const PERF_ENABLED = process.env.RUN_PERF_TESTS === '1';
const describeIfPerf = PERF_ENABLED ? describe : describe.skip;

jest.mock('drizzle-orm', () => require('../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../manual-mocks/drizzle-orm/pg-core'));

const SESSION_ID = 'sess-large-batch-mem-1067';
const ORG_ID = 'org-large-batch-mem-1067';
const ADMIN_ID = 'admin-large-batch-mem-1067';
const STAGING_ROOT = nodePath.join(process.cwd(), '.staging', 'bulk-import');
const SESSION_DIR = nodePath.join(STAGING_ROOT, SESSION_ID);

// Default knobs sized to make the in-memory regression unmistakable
// without requiring an enormous CI box. 30 x 5MB = 150MB of payload
// — if a future change buffers even a few of those into the process,
// the limits below are easily breached. All knobs can be overridden
// from the env so the perf job can dial them up further.
const FILE_COUNT = Number(process.env.PERF_FILE_COUNT ?? 30);
const FILE_SIZE = Number(process.env.PERF_FILE_SIZE_BYTES ?? 5 * 1024 * 1024);
const TOTAL_BYTES = FILE_COUNT * FILE_SIZE;

// RSS is the PRIMARY signal because multer's `memoryStorage()` (the
// regression we are guarding against) accumulates Node `Buffer`s that
// live in the off-heap allocator. Those bytes show up in `rss` and
// `external` — they barely move V8's `heapUsed` at all. A
// heapUsed-only assertion would happily green-light a fully restored
// `memoryStorage()` regression.
//
// The ratios below are calibrated against two competing pressures:
//   - LOW enough that a `memoryStorage()` regression (which would
//     push BOTH `rss` and `external` deltas to ≥ payload size) trips
//     the assertion with comfortable headroom.
//   - HIGH enough that normal disk-streaming overhead (per-chunk
//     transient buffers in busboy / multer / form-data, multipart
//     parser arenas, response serialization, GC noise) does not
//     flake across CI machines with different scheduler / malloc
//     behavior.
// Local runs show peak RSS deltas of ~25–40MB and peak external
// deltas of ~34–47MB on a 150MB payload; the defaults below keep ~2×
// headroom over those measurements, while a regression would still
// blow past them by another ~2×.
const PEAK_RSS_LIMIT_RATIO = Number(process.env.PERF_PEAK_RSS_RATIO ?? 0.5);
const PEAK_RSS_LIMIT = Math.floor(TOTAL_BYTES * PEAK_RSS_LIMIT_RATIO);

// `external` is the SECONDARY (and arguably most precise) signal —
// it isolates Buffer-backed allocations from generic kernel/libc RSS
// noise, so it makes a `memoryStorage()` regression even more
// obvious. Limit is looser than the per-spec "25%" because the
// multipart parser and form-data piping legitimately allocate
// per-chunk Node Buffers; the property we care about is "no full
// file body lingers off-heap", not "zero off-heap bytes".
const PEAK_EXTERNAL_LIMIT_RATIO = Number(process.env.PERF_PEAK_EXTERNAL_RATIO ?? 0.6);
const PEAK_EXTERNAL_LIMIT = Math.floor(TOTAL_BYTES * PEAK_EXTERNAL_LIMIT_RATIO);

// Heap stays as a tertiary check: with disk streaming we expect
// essentially zero heap growth, so even a tight 25% limit is loose.
// Kept primarily so a future regression that DOES buffer into V8
// (e.g. a `req.body` JSON-decoded upload, an accidental
// `Buffer.concat()` over the whole body interpreted as a string)
// still trips this test.
const PEAK_HEAP_LIMIT_RATIO = Number(process.env.PERF_PEAK_HEAP_RATIO ?? 0.25);
const PEAK_HEAP_LIMIT = Math.floor(TOTAL_BYTES * PEAK_HEAP_LIMIT_RATIO);

const FAKE_SESSION = {
  id: SESSION_ID,
  organizationId: ORG_ID,
  buildingId: 'bld-large-batch-mem-1067',
  adminUserId: ADMIN_ID,
  currentStep: 'upload',
  status: 'active',
  progress: {},
};

const insertedItems: Array<Record<string, any>> = [];
let nextItemId = 1;

// Same in-memory DB fake shape as the disk-streaming unit test
// (`tests/unit/api/bulk-import-upload-disk-streaming.test.ts`). Each
// `db.<verb>(...)` call returns its own builder so concurrent queries
// do not leak state into each other.
jest.mock('../../server/db', () => {
  function builder() {
    let pendingValues: Record<string, any> | null = null;
    let pendingIdFilter: string | null = null;
    let mode:
      | 'select-session'
      | 'select-item'
      | 'select-empty'
      | 'insert-item'
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
      insert(table: any) {
        const sym =
          (table &&
            (table[Symbol.for('drizzle:Name')] ||
              table[Symbol.for('drizzle:BaseName')])) ||
          (table && table.name);
        if (sym === 'bulk_import_items') mode = 'insert-item';
        else mode = 'unknown';
        return api;
      },
      values(v: Record<string, any>) {
        pendingValues = v;
        return api;
      },
      returning() {
        if (mode === 'insert-item' && pendingValues) {
          const row = {
            id: `item-mem-${nextItemId++}`,
            ...pendingValues,
            preExcludeStatus: pendingValues.preExcludeStatus ?? null,
            excludeSource: pendingValues.excludeSource ?? null,
            finalFileName: null,
            screening: null,
            sortingDecision: null,
            branchDecision: null,
            identification: null,
            linkDecisions: null,
            finalDocumentId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          insertedItems.push(row);
          return Promise.resolve([row]);
        }
        return Promise.resolve([]);
      },
      then(resolve: any, reject: any) {
        let result: any[] = [];
        if (mode === 'select-session') result = [FAKE_SESSION];
        else if (mode === 'select-item' && pendingIdFilter) {
          const found = insertedItems.find((r) => r.id === pendingIdFilter);
          result = found ? [found] : [];
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
      insert: (...args: any[]) => builder().insert(...args),
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
 * Pseudo-unique synthetic file: pushes `size` bytes of cheap fill in
 * 64KB chunks, but stamps the first 16 bytes with a per-file unique
 * tag so each upload's SHA-256 is unique. Without that, the route's
 * `existsSync(stagedPath)` short-circuit would drop 29 of 30 files
 * (since they share `<hash>_<originalName>` once the hash collapses)
 * and the disk-streaming path would never be exercised end-to-end.
 */
function makeFileStream(size: number, seed: number): Readable {
  const CHUNK = 64 * 1024;
  let remaining = size;
  let firstChunk = true;
  return new Readable({
    read() {
      if (remaining <= 0) {
        this.push(null);
        return;
      }
      const len = Math.min(CHUNK, remaining);
      // `Buffer.alloc(len, seed)` fills with a single byte value; cheap
      // and avoids the cost of `randomBytes(len)` for every chunk.
      const buf = Buffer.alloc(len, seed & 0xff);
      if (firstChunk) {
        const tag = Buffer.alloc(16);
        tag.writeUInt32BE(seed >>> 0, 0);
        nodeCrypto.randomFillSync(tag, 4);
        tag.copy(buf, 0, 0, Math.min(16, len));
        firstChunk = false;
      }
      remaining -= len;
      this.push(buf);
    },
  });
}

describeIfPerf('Task #1067 — bulk-import large batch keeps memory bounded', () => {
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
      nodeFs.rmSync(SESSION_DIR, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
    server.close(() => done());
  });

  beforeEach(() => {
    insertedItems.length = 0;
    nextItemId = 1;
    for (const entry of nodeFs.readdirSync(SESSION_DIR)) {
      try {
        nodeFs.unlinkSync(nodePath.join(SESSION_DIR, entry));
      } catch {
        /* best-effort */
      }
    }
  });

  it(
    `peak heap delta stays under ${(PEAK_HEAP_LIMIT / 1024 / 1024).toFixed(0)}MB ` +
      `while uploading ${FILE_COUNT} files of ~${(FILE_SIZE / 1024 / 1024).toFixed(0)}MB each`,
    async () => {
      // Build a streaming multipart body so the test client itself does
      // not have to buffer the full payload up-front. If we used
      // supertest's `.attach(field, Buffer)` here, the entire payload
      // would sit in `superagent`'s internal form-data buffer at the
      // moment we sample the baseline, and we'd be measuring the test
      // harness instead of the route.
      const form = new FormData();
      for (let i = 0; i < FILE_COUNT; i++) {
        form.append('files', makeFileStream(FILE_SIZE, i + 1), {
          filename: `large-${i + 1}.pdf`,
          contentType: 'application/pdf',
          knownLength: FILE_SIZE,
        });
      }

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
      // Don't keep the event loop alive on the sampler.
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
              path: `/api/admin/bulk-import/sessions/${SESSION_ID}/items`,
              headers,
            },
            (res) => {
              const chunks: Buffer[] = [];
              res.on('data', (c: Buffer) => chunks.push(c));
              res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                if (res.statusCode !== 201) {
                  reject(
                    new Error(
                      `Upload failed with status ${res.statusCode}: ${body.slice(0, 500)}`,
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
        // Always tear down the sampler — otherwise an unexpected
        // request failure would leave a 25ms-tick interval running
        // for the rest of the worker's life and confuse leak
        // diagnostics.
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

      // Sanity: route did stage every file.
      const items = JSON.parse(responseBody) as Array<Record<string, any>>;
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(FILE_COUNT);
      // And the files actually exist on disk (so we know we truly
      // moved bytes through the disk-streaming path).
      const onDisk = nodeFs.readdirSync(SESSION_DIR);
      expect(onDisk).toHaveLength(FILE_COUNT);

      // Surface the numbers in the test log so a regression PR's CI
      // output makes the breach obvious instead of just "expected X
      // to be less than Y".
      // eslint-disable-next-line no-console
      console.log(
        `[task-1067] payload=${(TOTAL_BYTES / 1024 / 1024).toFixed(1)}MB ` +
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
      // ALL THREE memory signals must stay well below the total
      // payload. If any of these fails, someone almost certainly
      // re-introduced `multer.memoryStorage()` (which inflates `rss`
      // and `external` via off-heap Node `Buffer`s) or a
      // `Buffer.concat()` over the whole body somewhere downstream
      // (which inflates `heapUsed` if the buffer is interpreted as
      // a string/JSON in the V8 heap).
      //
      // RSS is the primary regression signal because Buffer-backed
      // payload accumulation barely moves V8's heap at all.
      expect(peakRssDelta).toBeLessThan(PEAK_RSS_LIMIT);
      expect(peakExternalDelta).toBeLessThan(PEAK_EXTERNAL_LIMIT);
      expect(peakHeapDelta).toBeLessThan(PEAK_HEAP_LIMIT);
    },
    180_000,
  );
});
