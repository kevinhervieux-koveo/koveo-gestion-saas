// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * @jest-environment node
 *
 * Task #1061 — the bulk-import upload endpoint streams uploaded files
 * straight to the per-session staging directory (via `multer.diskStorage()`)
 * and hashes them off disk afterwards, instead of buffering every file
 * in the Node heap. This test pins down the new streaming path:
 *
 *  1. A multi-file upload completes with a 201 and one row per file.
 *  2. Each row's `contentHash` matches what `crypto.sha256(<bytes>)`
 *     would have produced for that file's bytes — so the digest the
 *     dedup / fingerprint cache relies on did NOT change when we
 *     swapped storage backends.
 *  3. Each row's `stagedPath` follows the existing
 *     `<STAGING_ROOT>/<sessionId>/<hash>_<originalName>` shape that
 *     the rest of the bulk-import flow (preview, page-count, split,
 *     merge, accept, retry) reads from.
 *  4. The bytes on disk at that staged path actually match the
 *     uploaded bytes (so the streamed write was complete and was not
 *     truncated mid-stream).
 *  5. A follow-up `GET /items/:id/file` streams those same bytes back,
 *     proving the new staged-file naming is wired up end-to-end.
 *
 * The test mocks the DB layer with a thin in-memory fake so it can run
 * in any Jest environment without a Postgres dependency, but uses the
 * real filesystem for staging — that is the whole point of the new
 * code path.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import * as nodeFs from 'fs';
import * as nodeOs from 'os';
import * as nodePath from 'path';
import * as nodeCrypto from 'crypto';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

const SESSION_ID = 'sess-disk-streaming-test';
const ORG_ID = 'org-disk-streaming';
const ADMIN_ID = 'admin-disk-streaming';
// Task #1086 — point this suite at a per-test `mkdtempSync` directory
// instead of writing fixtures into the project tree's
// `.staging/bulk-import`. The route reads its staging root from
// `getBulkImportStagingRoot()` (Task #1080), so setting
// `BULK_IMPORT_STAGING_ROOT` before the route module is required keeps
// fixtures and the production path in lockstep regardless of any
// operator-set value in CI.
const STAGING_ROOT = nodeFs.mkdtempSync(
  nodePath.join(nodeOs.tmpdir(), 'bulk-import-disk-streaming-test-'),
);
const PREV_STAGING_ROOT_ENV = process.env.BULK_IMPORT_STAGING_ROOT;
process.env.BULK_IMPORT_STAGING_ROOT = STAGING_ROOT;
const SESSION_DIR = nodePath.join(STAGING_ROOT, SESSION_ID);

const FAKE_SESSION = {
  id: SESSION_ID,
  organizationId: ORG_ID,
  buildingId: 'bld-disk-streaming',
  adminUserId: ADMIN_ID,
  currentStep: 'upload',
  status: 'active',
  progress: {},
};

// Each insertion bumps a counter so the fake gives every staged item a
// unique id, mirroring what Postgres would do via its `gen_random_uuid()`
// default. We also remember every inserted row so the GET /file route's
// `db.select().from(bulkImportItems).where(eq(id, ...))` lookup can find
// it.
const insertedItems: Array<Record<string, any>> = [];
let nextItemId = 1;
// Names whose `bulk_import_items` insert should throw, so a test can
// simulate a per-file DB failure without having to rip out the real
// schema and routes.
const insertFailureNames = new Set<string>();

jest.mock('../../../server/db', () => {
  // Each `db.<verb>(...)` call gets its own builder instance with its
  // own state, so concurrent queries do not leak modes or pending
  // values into each other. The shared `insertedItems` array (defined
  // in the surrounding test file) is the cross-call store.
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
      select(_cols?: any) {
        return api;
      },
      from(table: any) {
        // Drizzle stores the table name on a Symbol. Fall back to
        // common shapes if the symbol changes between drizzle
        // versions.
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
        // The manual-mock `eq()` produces `{ type: 'eq', column, value }`.
        // We just want the id string for the `select-item` lookup.
        if (predicate && typeof predicate === 'object' && 'value' in predicate) {
          pendingIdFilter = String(predicate.value);
        }
        return api;
      },
      limit(_n: number) {
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
          // Allow tests to simulate a per-file DB insert error for a
          // specific filename without poking the real schema.
          const name =
            (pendingValues.originalName as string | undefined) ??
            (pendingValues.originalPath as string | undefined) ??
            '';
          if (insertFailureNames.has(name)) {
            return Promise.reject(new Error(`forced insert failure for ${name}`));
          }
          const row = {
            id: `item-disk-${nextItemId++}`,
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
        if (mode === 'select-session') {
          result = [FAKE_SESSION];
        } else if (mode === 'select-item' && pendingIdFilter) {
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

  // The route does `db.select()...` and `db.insert()...`, so the
  // exported `db` needs both verbs to be top-level methods that each
  // return a fresh builder.
  return {
    db: {
      select: (...args: any[]) => builder().select(...args),
      insert: (...args: any[]) => builder().insert(...args),
    },
  };
});

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: ADMIN_ID, role: 'admin', organizationId: ORG_ID };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}));

const PDF_BODY_A = Buffer.from('%PDF-1.4\nlease-A\n%%EOF', 'utf8');
const PDF_BODY_B = Buffer.from('%PDF-1.4\nlease-B-larger-content\n%%EOF', 'utf8');
const PNG_BODY = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489',
  'hex',
);

function expectedHash(bytes: Buffer): string {
  return nodeCrypto.createHash('sha256').update(bytes).digest('hex');
}

describe('Task #1061 — bulk-import upload streams files off disk', () => {
  let app: express.Application;

  beforeAll(() => {
    nodeFs.mkdirSync(SESSION_DIR, { recursive: true });
  });

  afterAll(() => {
    try {
      // Drop the entire per-test staging root, not just the session
      // dir, so the `mkdtempSync` directory does not linger across runs.
      nodeFs.rmSync(STAGING_ROOT, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
    if (PREV_STAGING_ROOT_ENV === undefined) {
      delete process.env.BULK_IMPORT_STAGING_ROOT;
    } else {
      process.env.BULK_IMPORT_STAGING_ROOT = PREV_STAGING_ROOT_ENV;
    }
  });

  beforeEach(() => {
    jest.resetModules();
    insertedItems.length = 0;
    nextItemId = 1;
    insertFailureNames.clear();
    // Clean any leftover staged files between tests so existsSync()
    // checks inside the route start from a known empty directory.
    for (const entry of nodeFs.readdirSync(SESSION_DIR)) {
      try {
        nodeFs.unlinkSync(nodePath.join(SESSION_DIR, entry));
      } catch {
        /* best-effort */
      }
    }
    app = express();
    app.use(express.json());
    const { registerBulkImportRoutes } = require('../../../server/api/bulk-import');
    registerBulkImportRoutes(app);
  });

  it('multi-file upload returns 201 with one enriched row per file', async () => {
    const res = await request(app)
      .post(`/api/admin/bulk-import/sessions/${SESSION_ID}/items`)
      .attach('files', PDF_BODY_A, { filename: 'lease-a.pdf', contentType: 'application/pdf' })
      .attach('files', PDF_BODY_B, { filename: 'lease-b.pdf', contentType: 'application/pdf' })
      .attach('files', PNG_BODY, { filename: 'meter.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    const items = res.body as Array<Record<string, any>>;
    expect(items).toHaveLength(3);
    items.forEach((row) => {
      expect(row.sessionId).toBe(SESSION_ID);
      expect(typeof row.contentHash).toBe('string');
      expect(typeof row.stagedPath).toBe('string');
      expect(row.status).toBe('pending');
    });
  });

  it('row contentHash matches the SHA-256 of the uploaded bytes', async () => {
    const res = await request(app)
      .post(`/api/admin/bulk-import/sessions/${SESSION_ID}/items`)
      .attach('files', PDF_BODY_A, { filename: 'lease-a.pdf', contentType: 'application/pdf' })
      .attach('files', PDF_BODY_B, { filename: 'lease-b.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    const items = res.body as Array<Record<string, any>>;
    const a = items.find((r) => r.originalName === 'lease-a.pdf');
    const b = items.find((r) => r.originalName === 'lease-b.pdf');
    expect(a.contentHash).toBe(expectedHash(PDF_BODY_A));
    expect(b.contentHash).toBe(expectedHash(PDF_BODY_B));
    expect(a.fileSize).toBe(PDF_BODY_A.length);
    expect(b.fileSize).toBe(PDF_BODY_B.length);
  });

  it('staged path follows <STAGING_ROOT>/<sessionId>/<hash>_<originalName> and the bytes on disk match', async () => {
    const res = await request(app)
      .post(`/api/admin/bulk-import/sessions/${SESSION_ID}/items`)
      .attach('files', PDF_BODY_A, { filename: 'lease-a.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    const item = (res.body as Array<Record<string, any>>)[0];

    const expected = nodePath.join(SESSION_DIR, `${expectedHash(PDF_BODY_A)}_lease-a.pdf`);
    expect(item.stagedPath).toBe(expected);
    expect(nodeFs.existsSync(expected)).toBe(true);
    expect(nodeFs.readFileSync(expected)).toEqual(PDF_BODY_A);
  });

  it('GET /items/:id/file streams the staged bytes back end-to-end', async () => {
    const upload = await request(app)
      .post(`/api/admin/bulk-import/sessions/${SESSION_ID}/items`)
      .attach('files', PDF_BODY_B, { filename: 'lease-b.pdf', contentType: 'application/pdf' });
    expect(upload.status).toBe(201);
    const item = (upload.body as Array<Record<string, any>>)[0];

    const stream = await request(app)
      .get(`/api/admin/bulk-import/items/${item.id}/file`)
      .buffer(true)
      .parse((res: any, cb: (err: Error | null, body: Buffer) => void) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(stream.status).toBe(200);
    expect(stream.headers['content-type']).toMatch(/application\/pdf/);
    expect(stream.body as Buffer).toEqual(PDF_BODY_B);
  });

  it('per-file failure returns a non-2xx, lists the failure, and preserves successes', async () => {
    // Simulate the DB insert blowing up on `lease-a.pdf` only — the
    // rest of the batch must continue to stage and the response must
    // surface the failure as a clear 5xx instead of a misleading 201.
    insertFailureNames.add('lease-a.pdf');

    const res = await request(app)
      .post(`/api/admin/bulk-import/sessions/${SESSION_ID}/items`)
      .attach('files', PDF_BODY_A, { filename: 'lease-a.pdf', contentType: 'application/pdf' })
      .attach('files', PDF_BODY_B, { filename: 'lease-b.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to stage uploaded files');
    expect(res.body.failedFiles).toEqual(['lease-a.pdf']);
    // The healthy file's row is still echoed back so the wizard can
    // surface partial progress while the failure is reported.
    expect(Array.isArray(res.body.created)).toBe(true);
    expect(res.body.created).toHaveLength(1);
    expect(res.body.created[0].originalName).toBe('lease-b.pdf');

    // Successful file's staged copy is still on disk for downstream
    // steps (preview, screening, etc.) to read.
    const okStaged = nodePath.join(
      SESSION_DIR,
      `${expectedHash(PDF_BODY_B)}_lease-b.pdf`,
    );
    expect(nodeFs.existsSync(okStaged)).toBe(true);

    // Failed file's staged copy was cleaned up — no orphaned bytes
    // left behind in the staging directory for the rejected item.
    const badStaged = nodePath.join(
      SESSION_DIR,
      `${expectedHash(PDF_BODY_A)}_lease-a.pdf`,
    );
    expect(nodeFs.existsSync(badStaged)).toBe(false);
  });
});
