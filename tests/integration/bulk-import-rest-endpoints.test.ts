/**
 * @jest-environment node
 *
 * Task #456: Cover the bulk-import REST endpoints with integration
 * tests.
 *
 * The unit/route tests already cover the AI screen path (Task #463
 * → tests/integration/bulk-import-screen-file-attachment.test.ts).
 * This suite locks down the non-AI REST surface that the wizard,
 * MCP tools, and resume-on-reload flow depend on:
 *
 *   - POST   /api/admin/bulk-import/sessions
 *   - GET    /api/admin/bulk-import/sessions
 *   - GET    /api/admin/bulk-import/sessions/:id
 *   - PATCH  /api/admin/bulk-import/sessions/:id
 *   - DELETE /api/admin/bulk-import/sessions/:id
 *   - POST   /api/admin/bulk-import/sessions/:id/items
 *   - PATCH  /api/admin/bulk-import/items/:id
 *   - GET    /api/admin/bulk-import/items/:id/file   (Task #457)
 *
 * Same real-Postgres pattern used by
 * `bulk-import-screen-file-attachment.test.ts`: gated on
 * `_INTEGRATION_DB_URL`, skips cleanly when no DB is available.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

jest.mock('../../__mocks__/server/storage', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/storage.ts'));
});
jest.mock('../../__mocks__/server/auth', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/auth.ts'));
});
jest.mock('../../__mocks__/server/routes', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/routes.ts'));
});
jest.mock('../../server/config/index', () => {
  const path = require('path');
  return require(path.resolve(__dirname, '../../server/config/index.ts'));
});

import express from 'express';
import session from 'express-session';
import request from 'supertest';
import crypto from 'crypto';
import fs from 'fs';
import nodePath from 'path';
import { and, eq, inArray } from 'drizzle-orm';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task456-bulk-import-rest';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

const PDF_BODY = Buffer.from('%PDF-1.4\n%%EOF', 'utf8');
// Distinct PDF body for tests that need two non-duplicate uploads in
// the same session (Task #1273 bulk exclude tests). Same valid header,
// different trailer bytes so the dedup contentHash differs.
const PDF_BODY_B = Buffer.from('%PDF-1.4\n% task-1273\n%%EOF', 'utf8');
const PNG_BODY = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489',
  'hex',
);

describeIfDb('bulk-import REST endpoints — Task #456', () => {
  let app: express.Application;
  let db: any;
  let schema: any;
  let bulkImportAnalyzer: typeof import('../../server/services/bulk-import-analyzer').bulkImportAnalyzer;
  // Task #1098 — the screen-all loop is now the screening leg of the
  // generalized run-all loop (Task #592). The cancellation/dedupe set
  // exported by the bulk-import module is `inFlightRunAll`, keyed by
  // `${sessionId}:${step}`; the legacy `screenAllInProgress` Set is
  // dead code. We reach into `inFlightRunAll` so the cancel/dedupe
  // assertions actually observe the real loop.
  let inFlightRunAll: Set<string>;
  const screeningRunAllKey = (sid: string) => `${sid}:screening`;

  const ids = {
    org: crypto.randomUUID(),
    building: crypto.randomUUID(),
    admin: crypto.randomUUID(),
    nonAdmin: crypto.randomUUID(),
    // Second admin user with NO `userOrganizations` link to `ids.org`
    // — used by the exclude-endpoint 403 test (Task #720) to prove the
    // org-scope guard rejects cross-org admins.
    foreignAdmin: crypto.randomUUID(),
  };

  // Sessions/items created during tests are tracked here for cleanup.
  const trackedSessions = new Set<string>();
  const trackedItems = new Set<string>();
  // Task #1086 — pin this suite to the project's `.staging/bulk-import`
  // so it matches the default `getBulkImportStagingRoot()` (Task #1080).
  // We explicitly clear `BULK_IMPORT_STAGING_ROOT` in beforeAll so an
  // operator-set value in CI cannot misroute the staged-file lookups
  // and per-session cleanup paths below.
  const stagingRoot = nodePath.join(process.cwd(), '.staging', 'bulk-import');
  const PREV_STAGING_ROOT_ENV = process.env.BULK_IMPORT_STAGING_ROOT;

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || 'test-session-secret-task456';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    // Task #1086 — match the default staging root we point fixtures at.
    delete process.env.BULK_IMPORT_STAGING_ROOT;
    // Ensure the analyzer takes the real-client path so our test fake
    // (`__setClientForTests`) is actually exercised by the screen-all
    // loop instead of falling back to the no-API-key stub.
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-fake-key';

    db = require('../../server/db').db;
    schema = require('@shared/schema');
    const bulkImportModule = require('../../server/api/bulk-import');
    const { registerBulkImportRoutes } = bulkImportModule;
    inFlightRunAll = bulkImportModule.inFlightRunAll;
    bulkImportAnalyzer =
      require('../../server/services/bulk-import-analyzer').bulkImportAnalyzer;

    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(
      session({
        secret: process.env.SESSION_SECRET!,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: { secure: false, httpOnly: true, sameSite: 'lax', path: '/' },
        name: 'koveo.sid',
      }),
    );
    registerBulkImportRoutes(app);

    await db.insert(schema.organizations).values({
      id: ids.org,
      name: `${TEST_TAG} Org ${ids.org.slice(0, 8)}`,
      type: 'syndicate',
      address: '1 Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
    });
    await db.insert(schema.buildings).values({
      id: ids.building,
      organizationId: ids.org,
      name: `${TEST_TAG} bldg`,
      address: '1 Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 1,
      isActive: true,
    });
    await db.insert(schema.users).values([
      {
        id: ids.admin,
        username: `${TEST_TAG}-admin-${ids.admin.slice(0, 8)}`,
        email: `${ids.admin}@${TEST_TAG}.test`,
        password: 'unused-bcrypt-hash',
        firstName: 'Bulk',
        lastName: 'Admin',
        role: 'admin',
        isActive: true,
      },
      {
        id: ids.nonAdmin,
        username: `${TEST_TAG}-mgr-${ids.nonAdmin.slice(0, 8)}`,
        email: `${ids.nonAdmin}@${TEST_TAG}.test`,
        password: 'unused-bcrypt-hash',
        firstName: 'Bulk',
        lastName: 'Manager',
        role: 'manager',
        isActive: true,
      },
      {
        id: ids.foreignAdmin,
        username: `${TEST_TAG}-other-${ids.foreignAdmin.slice(0, 8)}`,
        email: `${ids.foreignAdmin}@${TEST_TAG}.test`,
        password: 'unused-bcrypt-hash',
        firstName: 'Bulk',
        lastName: 'Outsider',
        role: 'admin',
        isActive: true,
      },
    ]);

    // Link the primary admin to the test organization so the
    // `canUserAccessOrganization` guard on the exclude endpoint
    // succeeds. The foreign admin is intentionally NOT linked so
    // they exercise the 403 path.
    await db.insert(schema.userOrganizations).values({
      userId: ids.admin,
      organizationId: ids.org,
      organizationRole: 'admin',
      isActive: true,
    });
  }, 30_000);

  afterAll(async () => {
    // Restore the staging-root env var unconditionally so a partial
    // beforeAll failure (e.g. db setup threw before `db` was assigned)
    // cannot leak a cleared env var into sibling suites.
    const restoreStagingRootEnv = () => {
      if (PREV_STAGING_ROOT_ENV === undefined) {
        delete process.env.BULK_IMPORT_STAGING_ROOT;
      } else {
        process.env.BULK_IMPORT_STAGING_ROOT = PREV_STAGING_ROOT_ENV;
      }
    };
    if (!REAL_DB_URL || !db) {
      restoreStagingRootEnv();
      return;
    }
    if (trackedItems.size > 0) {
      await db
        .delete(schema.bulkImportItems)
        .where(inArray(schema.bulkImportItems.id, Array.from(trackedItems)));
    }
    if (trackedSessions.size > 0) {
      await db
        .delete(schema.bulkImportSessions)
        .where(inArray(schema.bulkImportSessions.id, Array.from(trackedSessions)));
      // Also clean any staging dirs left behind.
      for (const sid of trackedSessions) {
        const dir = nodePath.join(stagingRoot, sid);
        try {
          if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        } catch {
          /* best-effort */
        }
      }
    }
    // Drop the org link before the user/org rows so the FK cascade
    // doesn't surprise us if the row was inserted manually.
    await db
      .delete(schema.userOrganizations)
      .where(
        inArray(schema.userOrganizations.userId, [
          ids.admin,
          ids.nonAdmin,
          ids.foreignAdmin,
        ]),
      );
    await db
      .delete(schema.users)
      .where(
        inArray(schema.users.id, [ids.admin, ids.nonAdmin, ids.foreignAdmin]),
      );
    await db.delete(schema.buildings).where(eq(schema.buildings.id, ids.building));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, ids.org));
    restoreStagingRootEnv();
  }, 30_000);

  // After every test, also clean up sessions/items that test created
  // so DB lookups for "active" session in subsequent tests don't see
  // stale rows.
  beforeEach(async () => {
    if (!REAL_DB_URL) return;
    if (trackedItems.size > 0) {
      await db
        .delete(schema.bulkImportItems)
        .where(inArray(schema.bulkImportItems.id, Array.from(trackedItems)));
      trackedItems.clear();
    }
    if (trackedSessions.size > 0) {
      await db
        .delete(schema.bulkImportSessions)
        .where(inArray(schema.bulkImportSessions.id, Array.from(trackedSessions)));
      for (const sid of trackedSessions) {
        const dir = nodePath.join(stagingRoot, sid);
        try {
          if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        } catch {
          /* best-effort */
        }
      }
      trackedSessions.clear();
    }
  });

  function asAdmin() {
    return request(app).agent(app);
  }

  async function createSession(): Promise<string> {
    const res = await request(app)
      .post('/api/admin/bulk-import/sessions')
      .set('x-test-user-id', ids.admin)
      .send({ buildingId: ids.building });
    expect([200, 201]).toContain(res.status);
    const sid = res.body.id;
    trackedSessions.add(sid);
    return sid;
  }

  it('rejects non-admins on every endpoint', async () => {
    const create = await request(app)
      .post('/api/admin/bulk-import/sessions')
      .set('x-test-user-id', ids.nonAdmin)
      .send({ buildingId: ids.building });
    expect([401, 403]).toContain(create.status);

    const list = await request(app)
      .get('/api/admin/bulk-import/sessions')
      .set('x-test-user-id', ids.nonAdmin);
    expect([401, 403]).toContain(list.status);
  });

  it('creates a new session and returns the same one if called twice', async () => {
    const first = await request(app)
      .post('/api/admin/bulk-import/sessions')
      .set('x-test-user-id', ids.admin)
      .send({ buildingId: ids.building });
    expect(first.status).toBe(201);
    expect(first.body.buildingId).toBe(ids.building);
    expect(first.body.organizationId).toBe(ids.org);
    expect(first.body.adminUserId).toBe(ids.admin);
    expect(first.body.currentStep).toBe('upload');
    expect(first.body.status).toBe('active');
    trackedSessions.add(first.body.id);

    // Second call for the same admin/building must return the
    // existing active session (idempotent resume).
    const second = await request(app)
      .post('/api/admin/bulk-import/sessions')
      .set('x-test-user-id', ids.admin)
      .send({ buildingId: ids.building });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
  });

  it('returns 404 for an unknown building', async () => {
    const res = await request(app)
      .post('/api/admin/bulk-import/sessions')
      .set('x-test-user-id', ids.admin)
      .send({ buildingId: crypto.randomUUID() });
    expect(res.status).toBe(404);
  });

  it('400s when buildingId is missing', async () => {
    const res = await request(app)
      .post('/api/admin/bulk-import/sessions')
      .set('x-test-user-id', ids.admin)
      .send({});
    expect(res.status).toBe(400);
  });

  it('lists sessions, fetches a single session with items, and patches step/progress', async () => {
    const sid = await createSession();

    const list = await request(app)
      .get('/api/admin/bulk-import/sessions')
      .set('x-test-user-id', ids.admin);
    expect(list.status).toBe(200);
    // Response is now paginated: { sessions, limit, offset, hasMore }
    expect(Array.isArray(list.body.sessions)).toBe(true);
    expect(list.body.sessions.find((s: any) => s.id === sid)).toBeDefined();

    const get = await request(app)
      .get(`/api/admin/bulk-import/sessions/${sid}`)
      .set('x-test-user-id', ids.admin);
    expect(get.status).toBe(200);
    expect(get.body.session.id).toBe(sid);
    expect(Array.isArray(get.body.items)).toBe(true);
    expect(get.body.items).toHaveLength(0);

    const patch = await request(app)
      .patch(`/api/admin/bulk-import/sessions/${sid}`)
      .set('x-test-user-id', ids.admin)
      .send({ currentStep: 'screening', progress: { dismissedDuplicates: 2 } });
    expect(patch.status).toBe(200);
    expect(patch.body.currentStep).toBe('screening');
    expect(patch.body.progress).toEqual({ dismissedDuplicates: 2 });

    // Progress must round-trip on the resume payload.
    const resumed = await request(app)
      .get(`/api/admin/bulk-import/sessions/${sid}`)
      .set('x-test-user-id', ids.admin);
    expect(resumed.body.session.currentStep).toBe('screening');
    expect(resumed.body.session.progress).toEqual({ dismissedDuplicates: 2 });
  });

  it('rejects invalid step transitions on PATCH', async () => {
    const sid = await createSession();
    const res = await request(app)
      .patch(`/api/admin/bulk-import/sessions/${sid}`)
      .set('x-test-user-id', ids.admin)
      .send({ currentStep: 'not-a-step' });
    expect(res.status).toBe(400);
  });

  /**
   * Task #1223 — GET /api/admin/bulk-import/sessions must attach a
   * per-session `aiFailureSummary` keyed off the session's
   * `currentStep`. The shape is consumed by the sessions-list page
   * (Task #1219) to render an aggregated "Anthropic looks degraded"
   * banner and a per-row indicator.
   *
   * The math the wizard's in-page banner (Task #1209) uses is:
   *   - aiTotalCount  = every item in the session
   *   - aiFailedCount = items NOT in `rejected` status whose current-
   *                     step `fallbackReason` is in
   *                     RETRYABLE_AI_FALLBACK_REASONS
   *   - aiDegraded    = aiFailedCount > 0 AND
   *                     aiFailedCount / aiTotalCount > 0.25
   *
   * Below we seed two sessions in parallel:
   *   - degraded session (currentStep=screening): 4 items total, two
   *     with retryable fallback reasons (`api_error`,
   *     `unreadable_response`), one with a permanent reason
   *     (`oversize`) that must NOT bump the failed counter, and one
   *     `rejected` row whose retryable fallback must also be ignored
   *     (excluded items don't count). Failure rate 2/4 = 50% > 25%
   *     ⇒ aiDegraded should be true.
   *   - healthy session (currentStep=identification): 3 items, none
   *     with retryable fallback ⇒ aiDegraded should be false.
   *
   * Asserting both shapes in one test (rather than splitting them)
   * keeps the cleanup deterministic — `beforeEach` already resets
   * tracked sessions/items between cases — and proves the per-row
   * indicator agrees with the per-session aggregation in a single
   * paginated response.
   */
  it('attaches aiFailureSummary with the correct aiDegraded flag on the sessions list (Task #1223)', async () => {
    // --- Degraded session ---------------------------------------------------
    const degradedSid = await createSession();
    // Move it onto an AI step so the summary actually scores items.
    // The default `currentStep` of a fresh session is `upload`, which
    // would force `step: null` / `aiDegraded: false` regardless of
    // the items' fallback reasons.
    const movedDegraded = await request(app)
      .patch(`/api/admin/bulk-import/sessions/${degradedSid}`)
      .set('x-test-user-id', ids.admin)
      .send({ currentStep: 'screening' });
    expect(movedDegraded.status).toBe(200);

    const seedItem = async (
      sid: string,
      overrides: Record<string, unknown>,
    ) => {
      const id = crypto.randomUUID();
      trackedItems.add(id);
      await db.insert(schema.bulkImportItems).values({
        id,
        sessionId: sid,
        originalPath: `${id}.pdf`,
        originalName: `${id}.pdf`,
        stagedPath: `${stagingRoot}/${sid}/${id}.pdf`,
        contentHash: crypto.createHash('sha256').update(id).digest('hex'),
        mimeType: 'application/pdf',
        fileSize: 1,
        status: 'pending',
        ...overrides,
      });
      return id;
    };

    // 4 items: two retryable failures, one permanent failure (oversize),
    // one rejected row that even with a retryable fallback must be
    // skipped by the failed-counter loop.
    await seedItem(degradedSid, {
      status: 'screened',
      screening: { fallbackReason: 'api_error' },
    });
    await seedItem(degradedSid, {
      status: 'screened',
      screening: { fallbackReason: 'unreadable_response' },
    });
    await seedItem(degradedSid, {
      status: 'screened',
      screening: { fallbackReason: 'oversize' },
    });
    await seedItem(degradedSid, {
      status: 'rejected',
      screening: { fallbackReason: 'api_error' },
    });

    // --- Healthy session ----------------------------------------------------
    // Use a different building so the idempotent-resume rule on
    // POST /sessions doesn't return the degraded session's id again.
    const otherBuildingId = crypto.randomUUID();
    await db.insert(schema.buildings).values({
      id: otherBuildingId,
      organizationId: ids.org,
      name: `${TEST_TAG} bldg-1223-healthy`,
      address: '2 Test',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 1,
      isActive: true,
    });
    const healthyCreate = await request(app)
      .post('/api/admin/bulk-import/sessions')
      .set('x-test-user-id', ids.admin)
      .send({ buildingId: otherBuildingId });
    expect([200, 201]).toContain(healthyCreate.status);
    const healthySid = healthyCreate.body.id;
    trackedSessions.add(healthySid);

    const movedHealthy = await request(app)
      .patch(`/api/admin/bulk-import/sessions/${healthySid}`)
      .set('x-test-user-id', ids.admin)
      .send({ currentStep: 'identification' });
    expect(movedHealthy.status).toBe(200);

    // 3 items: one with no fallback (already identified) and two
    // with non-retryable reasons that must NOT bump the failed counter.
    await seedItem(healthySid, {
      status: 'identified',
      identification: { name: 'invoice.pdf' },
    });
    await seedItem(healthySid, {
      status: 'identified',
      identification: { fallbackReason: 'oversize' },
    });
    await seedItem(healthySid, {
      status: 'identified',
      identification: { fallbackReason: 'unsupported_mime' },
    });

    // --- Assertions ---------------------------------------------------------
    const list = await request(app)
      .get('/api/admin/bulk-import/sessions')
      .set('x-test-user-id', ids.admin);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.sessions)).toBe(true);

    const degradedRow = list.body.sessions.find((s: any) => s.id === degradedSid);
    expect(degradedRow).toBeDefined();
    expect(degradedRow.aiFailureSummary).toEqual({
      step: 'screening',
      aiTotalCount: 4,
      aiFailedCount: 2,
      aiDegraded: true,
    });

    const healthyRow = list.body.sessions.find((s: any) => s.id === healthySid);
    expect(healthyRow).toBeDefined();
    expect(healthyRow.aiFailureSummary).toEqual({
      step: 'identification',
      aiTotalCount: 3,
      aiFailedCount: 0,
      aiDegraded: false,
    });

    // --- Cleanup of the extra building seeded for this test ---------------
    // Sessions/items are torn down by the suite-wide `beforeEach`, but
    // the extra building is local to this case so we drop it here to
    // avoid polluting the next test's name lookups.
    await db
      .delete(schema.buildings)
      .where(eq(schema.buildings.id, otherBuildingId));
  });

  it('uploads files into a session, dedupes by content hash, and exposes them for streaming', async () => {
    const sid = await createSession();

    const upload = await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/items`)
      .set('x-test-user-id', ids.admin)
      .attach('files', PDF_BODY, {
        filename: 'lease.pdf',
        contentType: 'application/pdf',
      })
      .attach('files', PNG_BODY, {
        filename: 'meter.png',
        contentType: 'image/png',
      });
    expect(upload.status).toBe(201);
    expect(upload.body.items).toHaveLength(2);
    upload.body.items.forEach((row: any) => trackedItems.add(row.id));

    const pdfItem = upload.body.items.find((r: any) => r.originalName === 'lease.pdf');
    const pngItem = upload.body.items.find((r: any) => r.originalName === 'meter.png');
    expect(pdfItem.contentHash).toBe(
      crypto.createHash('sha256').update(PDF_BODY).digest('hex'),
    );
    expect(pdfItem.fileSize).toBe(PDF_BODY.length);
    expect(pdfItem.mimeType).toBe('application/pdf');
    expect(pngItem.mimeType).toBe('image/png');

    // The bytes really were written to the staging dir.
    expect(fs.existsSync(pdfItem.stagedPath)).toBe(true);
    expect(fs.readFileSync(pdfItem.stagedPath)).toEqual(PDF_BODY);

    // GET …/items/:id/file streams the staged file with the right
    // Content-Type (Task #457 endpoint, exercised end-to-end).
    const stream = await request(app)
      .get(`/api/admin/bulk-import/items/${pdfItem.id}/file`)
      .set('x-test-user-id', ids.admin)
      .buffer(true)
      .parse((res: any, cb: (err: Error | null, body: Buffer) => void) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(stream.status).toBe(200);
    expect(stream.headers['content-type']).toMatch(/application\/pdf/);
    expect(stream.body as Buffer).toEqual(PDF_BODY);

    // 400 with No files when nothing is attached.
    const empty = await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/items`)
      .set('x-test-user-id', ids.admin);
    expect(empty.status).toBe(400);
  });

  // Task #1373 — Folder-path soft hint plumbing
  // ──────────────────────────────────────────
  // When the wizard's Choose-folder button is used, the client appends a
  // parallel `relativePaths` text field per file. The server must persist
  // that path verbatim into `bulkImportItems.originalPath`, fall back to
  // the basename for files uploaded without a relativePath, and reject any
  // path that would escape the file (absolute, contains "..", or whose
  // basename does not match the file's own basename) so a malicious form
  // body can never poison the row.
  it('persists relativePaths to originalPath for folder uploads, falls back to basename otherwise, and rejects unsafe paths', async () => {
    const sid = await createSession();

    const upload = await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/items`)
      .set('x-test-user-id', ids.admin)
      // file 0: well-formed folder upload — keep verbatim
      .attach('files', PDF_BODY, {
        filename: 'jan-statement.pdf',
        contentType: 'application/pdf',
      })
      .field('relativePaths', '2024 bills/January/jan-statement.pdf')
      // file 1: empty relativePath — must fall back to basename
      .attach('files', PNG_BODY, {
        filename: 'meter.png',
        contentType: 'image/png',
      })
      .field('relativePaths', '')
      // file 2: malicious absolute path — must fall back to basename
      .attach('files', Buffer.from('%PDF-1.4 a'), {
        filename: 'absolute.pdf',
        contentType: 'application/pdf',
      })
      .field('relativePaths', '/etc/passwd/absolute.pdf')
      // file 3: parent traversal — must fall back to basename
      .attach('files', Buffer.from('%PDF-1.4 b'), {
        filename: 'parent.pdf',
        contentType: 'application/pdf',
      })
      .field('relativePaths', '../../parent.pdf')
      // file 4: basename mismatch — must fall back to basename
      .attach('files', Buffer.from('%PDF-1.4 c'), {
        filename: 'mismatch.pdf',
        contentType: 'application/pdf',
      })
      .field('relativePaths', '2024/something-else.pdf');

    expect(upload.status).toBe(201);
    expect(upload.body.items).toHaveLength(5);
    upload.body.items.forEach((row: any) => trackedItems.add(row.id));

    const byName = new Map<string, any>(
      upload.body.items.map((r: any) => [r.originalName, r] as const),
    );
    expect(byName.get('jan-statement.pdf').originalPath).toBe(
      '2024 bills/January/jan-statement.pdf',
    );
    expect(byName.get('meter.png').originalPath).toBe('meter.png');
    expect(byName.get('absolute.pdf').originalPath).toBe('absolute.pdf');
    expect(byName.get('parent.pdf').originalPath).toBe('parent.pdf');
    expect(byName.get('mismatch.pdf').originalPath).toBe('mismatch.pdf');

    // The /lite payload must surface the same originalPath so the wizard
    // can render the parent-folder portion in the per-item details panel
    // without making a second round-trip.
    const lite = await request(app)
      .get(`/api/admin/bulk-import/sessions/${sid}/lite`)
      .set('x-test-user-id', ids.admin);
    expect(lite.status).toBe(200);
    const liteByName = new Map<string, any>(
      lite.body.items.map((i: any) => [i.originalName, i] as const),
    );
    expect(liteByName.get('jan-statement.pdf').originalPath).toBe(
      '2024 bills/January/jan-statement.pdf',
    );
    expect(liteByName.get('meter.png').originalPath).toBe('meter.png');
  });

  it('falls back to basename when the client omits the relativePaths field entirely', async () => {
    // Mirrors the **Choose files** (non-folder) upload path: the client
    // sends no `relativePaths` field at all, so `originalPath` must be
    // the file's basename — the pre-task behaviour. The companion
    // `deriveFolderHintFromOriginalPath` unit test pins that this
    // shape produces a null folder hint, so the analyzer prompt is
    // unchanged versus the pre-task baseline.
    const sid = await createSession();
    const upload = await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/items`)
      .set('x-test-user-id', ids.admin)
      .attach('files', PDF_BODY, {
        filename: 'no-folder.pdf',
        contentType: 'application/pdf',
      });

    expect(upload.status).toBe(201);
    expect(upload.body.items).toHaveLength(1);
    upload.body.items.forEach((row: any) => trackedItems.add(row.id));
    expect(upload.body.items[0].originalPath).toBe('no-folder.pdf');
  });

  it('preserves originalPath through the replace-file route so folder lineage is not lost', async () => {
    const sid = await createSession();
    const upload = await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/items`)
      .set('x-test-user-id', ids.admin)
      .attach('files', PDF_BODY, {
        filename: 'lease.pdf',
        contentType: 'application/pdf',
      })
      .field('relativePaths', 'leases/2024/lease.pdf');
    expect(upload.status).toBe(201);
    const item = upload.body.items[0];
    trackedItems.add(item.id);
    expect(item.originalPath).toBe('leases/2024/lease.pdf');

    const replacement = Buffer.from('%PDF-1.4 replacement body');
    const replaced = await request(app)
      .post(`/api/admin/bulk-import/items/${item.id}/replace-file`)
      .set('x-test-user-id', ids.admin)
      .attach('files', replacement, {
        filename: 'lease.pdf',
        contentType: 'application/pdf',
      });
    expect(replaced.status).toBe(200);
    // Even though the admin uploaded a fresh file (no relativePath on the
    // replace endpoint at all), the row's originalPath must keep the
    // folder lineage from the original Choose-folder upload.
    expect(replaced.body.originalPath).toBe('leases/2024/lease.pdf');
    expect(replaced.body.originalName).toBe('lease.pdf');
  });

  it('patches a single item decision and persists it', async () => {
    const sid = await createSession();
    const upload = await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/items`)
      .set('x-test-user-id', ids.admin)
      .attach('files', PDF_BODY, {
        filename: 'invoice.pdf',
        contentType: 'application/pdf',
      });
    expect(upload.status).toBe(201);
    const item = upload.body.items[0];
    trackedItems.add(item.id);

    const patch = await request(app)
      .patch(`/api/admin/bulk-import/items/${item.id}`)
      .set('x-test-user-id', ids.admin)
      .send({
        status: 'identified',
        identification: {
          name: 'Invoice 2026-04',
          tags: ['bill'],
          confidence: 0.83,
        },
        finalFileName: 'invoice-2026-04.pdf',
      });
    expect(patch.status).toBe(200);
    expect(patch.body.status).toBe('identified');
    expect(patch.body.identification?.name).toBe('Invoice 2026-04');
    expect(patch.body.finalFileName).toBe('invoice-2026-04.pdf');

    const rows = await db
      .select()
      .from(schema.bulkImportItems)
      .where(eq(schema.bulkImportItems.id, item.id));
    expect(rows[0].identification?.name).toBe('Invoice 2026-04');
    expect(rows[0].status).toBe('identified');
  });

  it('clears a session: marks it cleared, deletes items, removes staging dir', async () => {
    const sid = await createSession();
    const upload = await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/items`)
      .set('x-test-user-id', ids.admin)
      .attach('files', PDF_BODY, {
        filename: 'temp.pdf',
        contentType: 'application/pdf',
      });
    expect(upload.status).toBe(201);
    const item = upload.body.items[0];
    trackedItems.add(item.id);
    const stagingDir = nodePath.join(stagingRoot, sid);
    expect(fs.existsSync(stagingDir)).toBe(true);

    const del = await request(app)
      .delete(`/api/admin/bulk-import/sessions/${sid}`)
      .set('x-test-user-id', ids.admin);
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ ok: true });

    const sessionRow = await db
      .select()
      .from(schema.bulkImportSessions)
      .where(eq(schema.bulkImportSessions.id, sid));
    expect(sessionRow[0].status).toBe('cleared');

    const itemRows = await db
      .select()
      .from(schema.bulkImportItems)
      .where(eq(schema.bulkImportItems.sessionId, sid));
    expect(itemRows).toHaveLength(0);

    expect(fs.existsSync(stagingDir)).toBe(false);

    // Once the test deleted the session, we can drop the tracked-item
    // entry so beforeEach doesn't try to delete an already-gone row.
    trackedItems.delete(item.id);
  });

  it('auto-screens every pending item via POST /run-all (step=screening) and is idempotent (Task #575)', async () => {
    const sid = await createSession();
    const upload = await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/items`)
      .set('x-test-user-id', ids.admin)
      .attach('files', PDF_BODY, {
        filename: 'auto-1.pdf',
        contentType: 'application/pdf',
      })
      .attach('files', PNG_BODY, {
        filename: 'auto-2.png',
        contentType: 'image/png',
      });
    expect(upload.status).toBe(201);
    upload.body.items.forEach((row: any) => trackedItems.add(row.id));

    // Task #1098 — wire a deterministic fake Anthropic client BEFORE
    // kicking off the loop so the test never depends on a live
    // network call. The previous version assumed a 401 from the real
    // Anthropic API would let the analyzer fall through to its
    // 20%-confidence stub fast enough; in practice that depended on
    // outbound connectivity from CI and added 1–2 s of latency per
    // item, which was the root cause of the flake.
    const fastSpy = jest.fn().mockImplementation(async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            isComplete: true,
            isMultiDocument: false,
            pageOrderHint: null,
            rotationDegrees: 0,
            suggestedFilename: 'auto.pdf',
            description: 'fake',
            confidence: 0.85,
          }),
        },
      ],
    }));
    bulkImportAnalyzer.__setClientForTests({
      messages: { create: fastSpy },
    } as unknown as Parameters<
      typeof bulkImportAnalyzer.__setClientForTests
    >[0]);

    try {
      // First call kicks off the fire-and-forget loop and must respond
      // immediately without blocking on the AI work.
      const start = Date.now();
      const trigger = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/run-all`)
        .set('x-test-user-id', ids.admin)
        .send({ step: 'screening' });
      expect(trigger.status).toBe(200);
      expect(trigger.body.step).toBe('screening');
      expect(trigger.body.alreadyRunning).toBe(false);
      expect(Date.now() - start).toBeLessThan(2000);

      // A second call while the loop is still running must be reported
      // as already in progress so the wizard does not stack duplicates.
      // Note we do NOT assert `alreadyRunning=true` deterministically
      // because the first loop may have drained between the two
      // requests on a fast machine; the strict idempotency check is
      // covered by the dedicated "does not start a second loop" test
      // below where the loop is artificially slowed.
      const again = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/run-all`)
        .set('x-test-user-id', ids.admin)
        .send({ step: 'screening' });
      expect(again.status).toBe(200);
      expect(again.body.step).toBe('screening');
      expect(typeof again.body.alreadyRunning).toBe('boolean');

      // Wait for the background loop to finish — every item should land
      // in `screened` (or downstream status) with a screening payload.
      const deadline = Date.now() + 30_000;
      let finalRows: any[] = [];
      while (Date.now() < deadline) {
        finalRows = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.sessionId, sid));
        if (
          finalRows.length === upload.body.items.length &&
          finalRows.every((r) => r.status !== 'pending' && r.status !== 'screening')
        ) {
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(finalRows).toHaveLength(upload.body.items.length);
      finalRows.forEach((row) => {
        expect(['screened']).toContain(row.status);
        expect(row.screening).toBeTruthy();
        expect(typeof row.screening.confidence).toBe('number');
      });

      // Wait for the run-all key to drop so a sibling test cannot see
      // a stale in-flight marker on this session.
      const keyDeadline = Date.now() + 2_000;
      while (
        inFlightRunAll.has(screeningRunAllKey(sid)) &&
        Date.now() < keyDeadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(inFlightRunAll.has(screeningRunAllKey(sid))).toBe(false);
    } finally {
      bulkImportAnalyzer.__setClientForTests(null);
      // Defensive: clear the in-flight key in case the loop crashed
      // before the natural cleanup ran.
      inFlightRunAll.delete(screeningRunAllKey(sid));
    }
  }, 45_000);

  it('run-all (step=screening) returns 404 for an unknown session and rejects non-admins', async () => {
    const missing = await request(app)
      .post(`/api/admin/bulk-import/sessions/${crypto.randomUUID()}/run-all`)
      .set('x-test-user-id', ids.admin)
      .send({ step: 'screening' });
    expect(missing.status).toBe(404);

    const sid = await createSession();
    const forbidden = await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/run-all`)
      .set('x-test-user-id', ids.nonAdmin)
      .send({ step: 'screening' });
    expect([401, 403]).toContain(forbidden.status);
  });

  it('returns 404 for unknown session/item IDs and rejects invalid stagedPath escapes', async () => {
    const get = await request(app)
      .get(`/api/admin/bulk-import/sessions/${crypto.randomUUID()}`)
      .set('x-test-user-id', ids.admin);
    expect(get.status).toBe(404);

    const file = await request(app)
      .get(`/api/admin/bulk-import/items/${crypto.randomUUID()}/file`)
      .set('x-test-user-id', ids.admin);
    expect(file.status).toBe(404);

    const patchMissing = await request(app)
      .patch(`/api/admin/bulk-import/items/${crypto.randomUUID()}`)
      .set('x-test-user-id', ids.admin)
      .send({ status: 'rejected' });
    expect(patchMissing.status).toBe(404);

    // Forge an item row pointing OUTSIDE the staging root and prove
    // GET …/items/:id/file refuses to stream it (Task #457 path-
    // traversal guard).
    const sid = await createSession();
    const itemId = crypto.randomUUID();
    trackedItems.add(itemId);
    await db.insert(schema.bulkImportItems).values({
      id: itemId,
      sessionId: sid,
      originalPath: 'evil.txt',
      originalName: 'evil.txt',
      stagedPath: '/etc/passwd',
      contentHash: crypto.createHash('sha256').update('x').digest('hex'),
      mimeType: 'text/plain',
      fileSize: 1,
      status: 'pending',
    });
    const evil = await request(app)
      .get(`/api/admin/bulk-import/items/${itemId}/file`)
      .set('x-test-user-id', ids.admin);
    expect(evil.status).toBe(400);
  });

  /**
   * Task #593: clearing a session must stop the in-flight `screen-all`
   * background loop on its very next iteration. We seed a handful of
   * pending items, swap in a slow Anthropic stub so the loop is
   * guaranteed to still be running when the DELETE lands, then assert
   * that the cancellation set is emptied promptly and that the loop
   * stopped before screening every item (i.e. no wasted Anthropic
   * calls on cleared rows).
   */
  it('cancels the screen-all loop when the session is cleared mid-flight', async () => {
    const sid = await createSession();

    // Stage enough pending items that the run-all worker pool
    // (RUN_ALL_CONCURRENCY=4) cannot grab the whole queue in its first
    // batch — otherwise cancellation would have nothing left to skip
    // and the "loop stopped before screening every item" assertion
    // below would be physically unprovable. With 8 items + 4 workers
    // the loop processes the first 4 in parallel and only reaches
    // items 5–8 after the first batch resolves; cancelling between
    // those two waves is what we are checking.
    // Task #1098 — per-run nonce keeps the analyzer's persistent
    // `ai_suggestion_cache` from short-circuiting screen() with a
    // cached result from a prior suite run. If the cache hits, the
    // worker pool would drain the queue in microseconds and the
    // `inFlightRunAll.has(key)` poll below would never observe `true`.
    const nonce = crypto.randomBytes(16).toString('hex');
    const filenames = [
      'a.pdf', 'b.pdf', 'c.pdf', 'd.pdf',
      'e.pdf', 'f.pdf', 'g.pdf', 'h.pdf',
    ];
    for (const name of filenames) {
      const upload = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin)
        .attach(
          'files',
          Buffer.concat([PDF_BODY, Buffer.from(`${nonce}-${name}`)]),
          {
            filename: name,
            contentType: 'application/pdf',
          },
        );
      expect(upload.status).toBe(201);
      upload.body.items.forEach((row: any) => trackedItems.add(row.id));
    }

    // Slow fake Anthropic transport: every screen() takes ~500 ms so
    // even with concurrency 4 the first batch is still in flight when
    // the DELETE lands at ~300 ms. After the first batch settles,
    // workers re-check the cancellation flag and exit before grabbing
    // any of items 5–8 from the queue.
    const slowSpy = jest.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              isComplete: true,
              isMultiDocument: false,
              pageOrderHint: null,
              rotationDegrees: 0,
              suggestedFilename: 'x.pdf',
              description: 'fake',
              confidence: 0.7,
            }),
          },
        ],
      };
    });
    bulkImportAnalyzer.__setClientForTests({
      messages: { create: slowSpy },
    } as unknown as Parameters<
      typeof bulkImportAnalyzer.__setClientForTests
    >[0]);

    try {
      const start = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/run-all`)
        .set('x-test-user-id', ids.admin)
        .send({ step: 'screening' });
      expect(start.status).toBe(200);
      expect(start.body.step).toBe('screening');
      expect(start.body.alreadyRunning).toBe(false);

      // Task #1098 — wait for the loop to actually start (i.e. the
      // worker has added the run-all key to the in-flight set) before
      // sending the DELETE. Polling with a deadline beats a fixed
      // sleep because the run-all loop runs `await loadSession`,
      // `await db.select(...)` and `await patchRunAllProgress(...)`
      // before its first `processItemForStep`, and on a slow CI host
      // those can outlast a 200 ms sleep — at which point the DELETE
      // would land before the loop even started and the
      // `inFlightRunAll.has(sid)` assertion would fail spuriously.
      const startDeadline = Date.now() + 2_000;
      while (
        !inFlightRunAll.has(screeningRunAllKey(sid)) &&
        Date.now() < startDeadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(inFlightRunAll.has(screeningRunAllKey(sid))).toBe(true);

      const del = await request(app)
        .delete(`/api/admin/bulk-import/sessions/${sid}`)
        .set('x-test-user-id', ids.admin);
      expect(del.status).toBe(200);

      // The DELETE handler removes the run-all key synchronously, but
      // that only signals cancellation — workers that already grabbed
      // an item before the signal will keep awaiting their in-flight
      // spy call (500 ms each) and only re-check the cancellation
      // flag at the top of their NEXT iteration. So
      // `inFlightRunAll.has(key) === false` is NOT sufficient
      // evidence that the loop has fully drained. We instead poll for
      // the spy call count to stabilize: once it has not changed for
      // 300 ms, every in-flight worker has either finished its
      // current item or exited, and no new items will be picked up.
      let stableCount = -1;
      let stableSince = 0;
      const stabilityDeadline = Date.now() + 5_000;
      while (Date.now() < stabilityDeadline) {
        const current = slowSpy.mock.calls.length;
        if (current === stableCount) {
          if (Date.now() - stableSince >= 300) break;
        } else {
          stableCount = current;
          stableSince = Date.now();
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      // Once stable, the run-all key must have been dropped too —
      // either by the DELETE handler (sync) or by the run-all loop's
      // own `finally` block when the worker pool emptied.
      expect(inFlightRunAll.has(screeningRunAllKey(sid))).toBe(false);

      // Snapshot the (now-stable) call count and wait further to
      // confirm no late-starting iteration sneaks in past cancellation.
      const callsAtCancel = slowSpy.mock.calls.length;
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(slowSpy.mock.calls.length).toBe(callsAtCancel);

      // And we must have stopped early: with 8 items @500 ms each and
      // RUN_ALL_CONCURRENCY=4, the unbounded loop would have called
      // screen() 8 times. Cancellation between the first and second
      // batch must hold this strictly below the queue length.
      expect(slowSpy.mock.calls.length).toBeLessThan(filenames.length);

      // Items got deleted by the cascade DELETE — the screen-all loop
      // never inserted any rows, so trackedItems entries for the now-
      // gone items would just no-op in beforeEach but we drop them
      // explicitly to keep the cleanup path tidy.
      for (const itemId of Array.from(trackedItems)) {
        const rows = await db
          .select()
          .from(schema.bulkImportItems)
          .where(eq(schema.bulkImportItems.id, itemId));
        if (rows.length === 0) trackedItems.delete(itemId);
      }
    } finally {
      bulkImportAnalyzer.__setClientForTests(null);
      // Defensive: drop the run-all key from the cancellation set in
      // case the test failed before the natural cleanup ran.
      inFlightRunAll.delete(screeningRunAllKey(sid));
    }
  }, 15_000);

  /**
   * Companion check for Task #593: a `screen-all` POST against a
   * session that already has the loop running must be a no-op (still
   * 202) and must not start a second background loop.
   */
  it('does not start a second screen-all loop when one is already running', async () => {
    const sid = await createSession();
    // Task #1098 — append a per-run nonce so the analyzer's persistent
    // `ai_suggestion_cache` table (keyed by SHA-256 of the file
    // content) does not return a cached screening result from a prior
    // suite run. Without this, the slow Anthropic spy is never called
    // and `slowSpy.mock.calls.length` is 0 instead of 1.
    const nonce = crypto.randomBytes(16).toString('hex');
    await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/items`)
      .set('x-test-user-id', ids.admin)
      .attach(
        'files',
        Buffer.concat([PDF_BODY, Buffer.from(`once-${nonce}.pdf`)]),
        {
          filename: 'once.pdf',
          contentType: 'application/pdf',
        },
      )
      .then((res) => res.body.items.forEach((r: any) => trackedItems.add(r.id)));

    const slowSpy = jest.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              isComplete: true,
              isMultiDocument: false,
              pageOrderHint: null,
              rotationDegrees: 0,
              suggestedFilename: 'once.pdf',
              description: 'fake',
              confidence: 0.7,
            }),
          },
        ],
      };
    });
    bulkImportAnalyzer.__setClientForTests({
      messages: { create: slowSpy },
    } as unknown as Parameters<
      typeof bulkImportAnalyzer.__setClientForTests
    >[0]);

    try {
      const first = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/run-all`)
        .set('x-test-user-id', ids.admin)
        .send({ step: 'screening' });
      expect(first.status).toBe(200);
      expect(first.body.step).toBe('screening');
      expect(first.body.alreadyRunning).toBe(false);

      // Task #1098 — wait for the loop to actually register itself in
      // `inFlightRunAll` (one or two awaits inside `runAllForStep`
      // happen before the worker pool starts) before firing the
      // duplicate request. A fixed 50 ms sleep raced with `await
      // loadSession()` + `await db.select(...)` on slow CI hosts.
      const startDeadline = Date.now() + 2_000;
      while (
        !inFlightRunAll.has(screeningRunAllKey(sid)) &&
        Date.now() < startDeadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(inFlightRunAll.has(screeningRunAllKey(sid))).toBe(true);

      // Fire the duplicate request: it must short-circuit with
      // `alreadyRunning=true` so the wizard does not stack a second
      // background loop on top of the first.
      const second = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/run-all`)
        .set('x-test-user-id', ids.admin)
        .send({ step: 'screening' });
      expect(second.status).toBe(200);
      expect(second.body.step).toBe('screening');
      expect(second.body.alreadyRunning).toBe(true);

      // Wait for the (single) loop to finish and verify only one
      // Anthropic call was made for the one staged item.
      const deadline = Date.now() + 5_000;
      while (
        inFlightRunAll.has(screeningRunAllKey(sid)) &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(inFlightRunAll.has(screeningRunAllKey(sid))).toBe(false);
      expect(slowSpy.mock.calls.length).toBe(1);
    } finally {
      bulkImportAnalyzer.__setClientForTests(null);
      inFlightRunAll.delete(screeningRunAllKey(sid));
    }
  }, 15_000);

  /**
   * Task #720: end-to-end coverage for the manual exclude toggle.
   *
   * The wizard's `Exclude` button hits
   * `PATCH /api/admin/bulk-import/items/:itemId/exclude` with a
   * `{ exclude: boolean }` body. The four scenarios below exercise:
   *
   *   1. Excluding flips `status` to `rejected` and parks the previous
   *      status in `preExcludeStatus`.
   *   2. Un-excluding restores the original status and clears
   *      `preExcludeStatus`.
   *   3. `committed` and `duplicate` items are 400 (terminal states).
   *   4. An admin from a different org (no `userOrganizations` link)
   *      gets 403 — proves the `canUserAccessOrganization` guard runs.
   *
   * All four hit the real Postgres so we know the schema column and
   * route handler agree end-to-end, not just at the type-checker
   * level.
   */
  describe('PATCH /items/:itemId/exclude (Task #720)', () => {
    /**
     * Helper: stage one PDF item in a fresh session and force its
     * status to `screened` so the round-trip can prove that the
     * pre-exclude status really is restored (not silently coerced
     * back to `pending`).
     */
    async function seedScreenedItem(): Promise<{ sid: string; itemId: string }> {
      const sid = await createSession();
      const upload = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin)
        .attach('files', PDF_BODY, {
          filename: 'exclude-me.pdf',
          contentType: 'application/pdf',
        });
      expect(upload.status).toBe(201);
      const item = upload.body.items[0];
      trackedItems.add(item.id);
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'screened' })
        .where(eq(schema.bulkImportItems.id, item.id));
      return { sid, itemId: item.id };
    }

    it('flips status to rejected and stores preExcludeStatus when excluding', async () => {
      const { itemId } = await seedScreenedItem();

      const res = await request(app)
        .patch(`/api/admin/bulk-import/items/${itemId}/exclude`)
        .set('x-test-user-id', ids.admin)
        .send({ excluded: true });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('rejected');
      expect(res.body.preExcludeStatus).toBe('screened');

      const [row] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, itemId));
      expect(row.status).toBe('rejected');
      expect(row.preExcludeStatus).toBe('screened');
    });

    it('restores the original status and clears preExcludeStatus when un-excluding', async () => {
      const { itemId } = await seedScreenedItem();

      const excl = await request(app)
        .patch(`/api/admin/bulk-import/items/${itemId}/exclude`)
        .set('x-test-user-id', ids.admin)
        .send({ excluded: true });
      expect(excl.status).toBe(200);
      expect(excl.body.preExcludeStatus).toBe('screened');

      const restore = await request(app)
        .patch(`/api/admin/bulk-import/items/${itemId}/exclude`)
        .set('x-test-user-id', ids.admin)
        .send({ excluded: false });
      expect(restore.status).toBe(200);
      expect(restore.body.status).toBe('screened');
      expect(restore.body.preExcludeStatus).toBeNull();

      const [row] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, itemId));
      expect(row.status).toBe('screened');
      expect(row.preExcludeStatus).toBeNull();
    });

    it('returns 400 for committed and duplicate items', async () => {
      // Committed item — force the terminal status straight on the row
      // (the real commit path inserts a documents row which would
      // require way more fixture setup than this guard test needs).
      const { itemId: committedId } = await seedScreenedItem();
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'committed' })
        .where(eq(schema.bulkImportItems.id, committedId));

      const committed = await request(app)
        .patch(`/api/admin/bulk-import/items/${committedId}/exclude`)
        .set('x-test-user-id', ids.admin)
        .send({ excluded: true });
      expect(committed.status).toBe(400);

      // Duplicate item — set the status directly so we don't have to
      // actually re-upload an identical file.
      const { itemId: dupeId } = await seedScreenedItem();
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'duplicate' })
        .where(eq(schema.bulkImportItems.id, dupeId));

      const dupe = await request(app)
        .patch(`/api/admin/bulk-import/items/${dupeId}/exclude`)
        .set('x-test-user-id', ids.admin)
        .send({ excluded: true });
      expect(dupe.status).toBe(400);
    });

    it("returns 403 for a cross-org admin (no userOrganizations link)", async () => {
      const { itemId } = await seedScreenedItem();

      const res = await request(app)
        .patch(`/api/admin/bulk-import/items/${itemId}/exclude`)
        .set('x-test-user-id', ids.foreignAdmin)
        .send({ excluded: true });
      expect(res.status).toBe(403);

      // And the row must not have been touched.
      const [row] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, itemId));
      expect(row.status).toBe('screened');
      expect(row.preExcludeStatus).toBeNull();
    });
  });

  /**
   * Task #1273: end-to-end coverage for the wizard's batched
   * exclude/re-include endpoint. Mirrors the per-row contract:
   * preExcludeStatus is captured/restored, terminal items are refused
   * and counted under `skipped`, and the fingerprint cache is updated
   * in lockstep.
   */
  describe('PATCH /sessions/:id/items/exclude-bulk (Task #1273)', () => {
    it('excludes a batch and remembers preExcludeStatus per row', async () => {
      const sid = await createSession();
      const upload = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin)
        .attach('files', PDF_BODY, { filename: 'a.pdf', contentType: 'application/pdf' })
        .attach('files', PDF_BODY_B, { filename: 'b.pdf', contentType: 'application/pdf' });
      expect(upload.status).toBe(201);
      const [a, b] = upload.body.items;
      trackedItems.add(a.id);
      trackedItems.add(b.id);
      // Force one row to `screened` so we can prove preExcludeStatus
      // captures the per-row status, not a constant `pending`.
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'screened' })
        .where(eq(schema.bulkImportItems.id, a.id));

      const res = await request(app)
        .patch(`/api/admin/bulk-import/sessions/${sid}/items/exclude-bulk`)
        .set('x-test-user-id', ids.admin)
        .send({ itemIds: [a.id, b.id], excluded: true });
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(2);
      expect(res.body.skipped).toEqual({ committed: 0, duplicate: 0, notFound: 0 });

      const rows = await db
        .select()
        .from(schema.bulkImportItems)
        .where(inArray(schema.bulkImportItems.id, [a.id, b.id]));
      const byId = new Map(rows.map((r) => [r.id, r]));
      expect(byId.get(a.id)?.status).toBe('rejected');
      expect(byId.get(a.id)?.preExcludeStatus).toBe('screened');
      expect(byId.get(b.id)?.status).toBe('rejected');
      expect(byId.get(b.id)?.preExcludeStatus).toBe('pending');
    });

    it('re-includes a batch and restores per-row preExcludeStatus', async () => {
      const sid = await createSession();
      const upload = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin)
        .attach('files', PDF_BODY, { filename: 'c.pdf', contentType: 'application/pdf' })
        .attach('files', PDF_BODY_B, { filename: 'd.pdf', contentType: 'application/pdf' });
      expect(upload.status).toBe(201);
      const [a, b] = upload.body.items;
      trackedItems.add(a.id);
      trackedItems.add(b.id);
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'screened' })
        .where(eq(schema.bulkImportItems.id, a.id));

      const excl = await request(app)
        .patch(`/api/admin/bulk-import/sessions/${sid}/items/exclude-bulk`)
        .set('x-test-user-id', ids.admin)
        .send({ itemIds: [a.id, b.id], excluded: true });
      expect(excl.status).toBe(200);
      expect(excl.body.updated).toBe(2);

      const restore = await request(app)
        .patch(`/api/admin/bulk-import/sessions/${sid}/items/exclude-bulk`)
        .set('x-test-user-id', ids.admin)
        .send({ itemIds: [a.id, b.id], excluded: false });
      expect(restore.status).toBe(200);
      expect(restore.body.updated).toBe(2);

      const rows = await db
        .select()
        .from(schema.bulkImportItems)
        .where(inArray(schema.bulkImportItems.id, [a.id, b.id]));
      const byId = new Map(rows.map((r) => [r.id, r]));
      expect(byId.get(a.id)?.status).toBe('screened');
      expect(byId.get(a.id)?.preExcludeStatus).toBeNull();
      expect(byId.get(b.id)?.status).toBe('pending');
      expect(byId.get(b.id)?.preExcludeStatus).toBeNull();
    });

    it('skips committed and duplicate rows and reports them under `skipped`', async () => {
      const sid = await createSession();
      const upload = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin)
        .attach('files', PDF_BODY, { filename: 'e.pdf', contentType: 'application/pdf' })
        .attach('files', PDF_BODY_B, { filename: 'f.pdf', contentType: 'application/pdf' });
      expect(upload.status).toBe(201);
      const [committed, duplicate] = upload.body.items;
      trackedItems.add(committed.id);
      trackedItems.add(duplicate.id);
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'committed' })
        .where(eq(schema.bulkImportItems.id, committed.id));
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'duplicate' })
        .where(eq(schema.bulkImportItems.id, duplicate.id));

      const fakeId = crypto.randomUUID();
      const res = await request(app)
        .patch(`/api/admin/bulk-import/sessions/${sid}/items/exclude-bulk`)
        .set('x-test-user-id', ids.admin)
        .send({ itemIds: [committed.id, duplicate.id, fakeId], excluded: true });
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(0);
      expect(res.body.items).toEqual([]);
      expect(res.body.skipped).toEqual({ committed: 1, duplicate: 1, notFound: 1 });

      const rows = await db
        .select()
        .from(schema.bulkImportItems)
        .where(inArray(schema.bulkImportItems.id, [committed.id, duplicate.id]));
      const byId = new Map(rows.map((r) => [r.id, r]));
      expect(byId.get(committed.id)?.status).toBe('committed');
      expect(byId.get(duplicate.id)?.status).toBe('duplicate');
    });

    it('returns 403 for a cross-org admin and does not mutate any row', async () => {
      const sid = await createSession();
      const upload = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin)
        .attach('files', PDF_BODY, { filename: 'g.pdf', contentType: 'application/pdf' });
      expect(upload.status).toBe(201);
      const [item] = upload.body.items;
      trackedItems.add(item.id);

      const res = await request(app)
        .patch(`/api/admin/bulk-import/sessions/${sid}/items/exclude-bulk`)
        .set('x-test-user-id', ids.foreignAdmin)
        .send({ itemIds: [item.id], excluded: true });
      expect(res.status).toBe(403);

      const [row] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, item.id));
      expect(row.status).toBe('pending');
      expect(row.preExcludeStatus).toBeNull();
    });
  });

  /**
   * Task #858: end-to-end coverage for the persistent exclusion memory
   * flow added in Task #847.
   *
   * The two scenarios below exercise the cross-session round-trip that
   * the upload handler + exclude toggle keep in sync via the
   * `client_excluded_fingerprints` cache:
   *
   *   1. Upload → exclude → re-upload (in a brand-new session): the
   *      second upload must auto-exclude the file because its content
   *      hash matches the persisted fingerprint. The new row is born
   *      `rejected` with `excludeSource='prior_session'` so the wizard
   *      can render the "Previously excluded" badge instead of the
   *      generic one.
   *   2. Un-excluding an auto-excluded item: deletes the fingerprint
   *      row for the org+hash AND restores the item to its
   *      preExcludeStatus, with `excludeSource` cleared so the row no
   *      longer reads as auto-excluded.
   *
   * Both run against real Postgres so we know the schema column, route
   * handler, and transactional upsert/delete agree end-to-end.
   */
  describe('persistent exclusion memory across sessions (Task #858)', () => {
    /**
     * Per-test cleanup tag for the fingerprint cache: we cannot rely on
     * the org cascade until afterAll, but back-to-back tests in this
     * block must not see each other's persisted fingerprints, so we
     * delete every fingerprint scoped to the test org before each run.
     */
    beforeEach(async () => {
      if (!REAL_DB_URL) return;
      await db
        .delete(schema.clientExcludedFingerprints)
        .where(eq(schema.clientExcludedFingerprints.organizationId, ids.org));
    });

    afterAll(async () => {
      if (!REAL_DB_URL || !db) return;
      await db
        .delete(schema.clientExcludedFingerprints)
        .where(eq(schema.clientExcludedFingerprints.organizationId, ids.org));
    });

    /**
     * Body bytes are unique-per-test so a stray fingerprint row left
     * behind by a previous run would not silently make the assertion
     * pass on the *first* upload. The hash is recomputed from these
     * bytes for the assertions further down.
     */
    function fingerprintBody(tag: string): Buffer {
      return Buffer.concat([PDF_BODY, Buffer.from(`task858:${tag}`)]);
    }

    it('re-uploading an excluded file in a new session auto-excludes it with excludeSource=prior_session', async () => {
      const body = fingerprintBody('reupload');
      const expectedHash = crypto.createHash('sha256').update(body).digest('hex');

      // Session A: upload, then manually exclude. The exclude toggle
      // is what writes the fingerprint into client_excluded_fingerprints.
      const sidA = await createSession();
      const uploadA = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sidA}/items`)
        .set('x-test-user-id', ids.admin)
        .attach('files', body, {
          filename: 'memory.pdf',
          contentType: 'application/pdf',
        });
      expect(uploadA.status).toBe(201);
      const itemA = uploadA.body.items[0];
      trackedItems.add(itemA.id);
      // Born clean, never seen before in this org.
      expect(itemA.status).toBe('pending');
      expect(itemA.excludeSource).toBeNull();

      const exclude = await request(app)
        .patch(`/api/admin/bulk-import/items/${itemA.id}/exclude`)
        .set('x-test-user-id', ids.admin)
        .send({ excluded: true });
      expect(exclude.status).toBe(200);
      expect(exclude.body.status).toBe('rejected');

      // The fingerprint must now be persisted for this org+hash.
      const fp = await db
        .select()
        .from(schema.clientExcludedFingerprints)
        .where(
          and(
            eq(schema.clientExcludedFingerprints.organizationId, ids.org),
            eq(schema.clientExcludedFingerprints.contentHash, expectedHash),
          ),
        );
      expect(fp).toHaveLength(1);
      expect(fp[0].source).toBe('manual');

      // Clear session A so the next createSession() does not return
      // the same active session id (the upload endpoint is idempotent
      // per admin+building).
      const delA = await request(app)
        .delete(`/api/admin/bulk-import/sessions/${sidA}`)
        .set('x-test-user-id', ids.admin);
      expect(delA.status).toBe(200);
      // The cascade dropped itemA so beforeEach should not retry it.
      trackedItems.delete(itemA.id);

      // Session B: re-upload the same bytes. The handler must consult
      // the persisted fingerprint and create the new row already in
      // the excluded state with the prior-session marker.
      const sidB = await createSession();
      const uploadB = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sidB}/items`)
        .set('x-test-user-id', ids.admin)
        .attach('files', body, {
          filename: 'memory.pdf',
          contentType: 'application/pdf',
        });
      expect(uploadB.status).toBe(201);
      const itemB = uploadB.body.items[0];
      trackedItems.add(itemB.id);

      expect(itemB.status).toBe('rejected');
      expect(itemB.preExcludeStatus).toBe('pending');
      expect(itemB.excludeSource).toBe('prior_session');
      expect(itemB.contentHash).toBe(expectedHash);

      // And the persisted row matches what the API returned.
      const [rowB] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, itemB.id));
      expect(rowB.status).toBe('rejected');
      expect(rowB.preExcludeStatus).toBe('pending');
      expect(rowB.excludeSource).toBe('prior_session');
    });

    it('un-excluding an auto-excluded item deletes the fingerprint and restores the row', async () => {
      const body = fingerprintBody('unexclude');
      const expectedHash = crypto.createHash('sha256').update(body).digest('hex');

      // Seed the fingerprint cache directly so the very first upload
      // for this org+hash is auto-excluded — there is no need to walk
      // the full upload→exclude→re-upload path twice.
      await db.insert(schema.clientExcludedFingerprints).values({
        organizationId: ids.org,
        contentHash: expectedHash,
        source: 'manual',
      });

      const sid = await createSession();
      const upload = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin)
        .attach('files', body, {
          filename: 'auto-excluded.pdf',
          contentType: 'application/pdf',
        });
      expect(upload.status).toBe(201);
      const item = upload.body.items[0];
      trackedItems.add(item.id);

      // Sanity: the upload handler honored the persisted fingerprint.
      expect(item.status).toBe('rejected');
      expect(item.preExcludeStatus).toBe('pending');
      expect(item.excludeSource).toBe('prior_session');

      // Un-exclude — must remove the fingerprint row AND restore the
      // item to its pre-exclusion status with excludeSource cleared.
      const restore = await request(app)
        .patch(`/api/admin/bulk-import/items/${item.id}/exclude`)
        .set('x-test-user-id', ids.admin)
        .send({ excluded: false });
      expect(restore.status).toBe(200);
      expect(restore.body.status).toBe('pending');
      expect(restore.body.preExcludeStatus).toBeNull();
      expect(restore.body.excludeSource).toBeNull();

      // The fingerprint row for this org+hash is gone.
      const fpAfter = await db
        .select()
        .from(schema.clientExcludedFingerprints)
        .where(
          and(
            eq(schema.clientExcludedFingerprints.organizationId, ids.org),
            eq(schema.clientExcludedFingerprints.contentHash, expectedHash),
          ),
        );
      expect(fpAfter).toHaveLength(0);

      // And the persisted item row matches what the API returned.
      const [row] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, item.id));
      expect(row.status).toBe('pending');
      expect(row.preExcludeStatus).toBeNull();
      expect(row.excludeSource).toBeNull();
    });
  });

  /**
   * Task #796: end-to-end coverage for the bulk group reassign endpoint
   * added in Task #776 — `POST /sessions/:id/items/reassign-bulk`.
   *
   * The handler is the server-side safety net that backs the
   * "Reassign all in group" button on the Sorting step. The button
   * already filters out excluded files client-side, but the endpoint
   * has its own filter for `rejected` / `committed` / `duplicate`
   * items so that a future regression on the client cannot silently
   * re-include excluded files in a bulk move. These tests lock that
   * filter in place by sending the entire mixed-status id set and
   * asserting only the live items get a new `branchDecision`.
   */
  describe('POST /sessions/:id/items/reassign-bulk (Task #796)', () => {
    /**
     * Stage four PDFs in a fresh session and force their statuses to a
     * representative mix: two live items (one `screened`, one
     * `branched`) plus one each of the three statuses the endpoint
     * must skip (`rejected`, `committed`, `duplicate`). Returns the
     * id buckets so each test can assert per-row outcomes.
     */
    async function seedMixedSession(): Promise<{
      sid: string;
      live: string[];
      excluded: { rejected: string; committed: string; duplicate: string };
    }> {
      const sid = await createSession();
      const filenames = ['live-a.pdf', 'live-b.pdf', 'rejected.pdf', 'committed.pdf', 'duplicate.pdf'];
      // supertest needs each .attach individually; chain them so we
      // can stage the whole mixed bag in a single multipart request.
      let req = request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin);
      for (const name of filenames) {
        req = req.attach('files', Buffer.concat([PDF_BODY, Buffer.from(name)]), {
          filename: name,
          contentType: 'application/pdf',
        });
      }
      const res = await req;
      expect(res.status).toBe(201);
      expect(res.body.items).toHaveLength(filenames.length);
      const byName: Record<string, any> = {};
      for (const row of res.body.items) {
        trackedItems.add(row.id);
        byName[row.originalName] = row;
      }
      // Force terminal-ish statuses directly so we don't have to walk
      // the full pipeline. We also seed an existing branchDecision on
      // the excluded rows so we can prove later that the bulk endpoint
      // did not overwrite them.
      const seedDecision = { branch: 'other', subCategory: 'other', manualOverride: false };
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'screened' })
        .where(eq(schema.bulkImportItems.id, byName['live-a.pdf'].id));
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'branched', branchDecision: seedDecision })
        .where(eq(schema.bulkImportItems.id, byName['live-b.pdf'].id));
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'rejected', branchDecision: seedDecision })
        .where(eq(schema.bulkImportItems.id, byName['rejected.pdf'].id));
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'committed', branchDecision: seedDecision })
        .where(eq(schema.bulkImportItems.id, byName['committed.pdf'].id));
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'duplicate', branchDecision: seedDecision })
        .where(eq(schema.bulkImportItems.id, byName['duplicate.pdf'].id));

      return {
        sid,
        live: [byName['live-a.pdf'].id, byName['live-b.pdf'].id],
        excluded: {
          rejected: byName['rejected.pdf'].id,
          committed: byName['committed.pdf'].id,
          duplicate: byName['duplicate.pdf'].id,
        },
      };
    }

    it('updates only the live items even when excluded ids are sent in the same payload', async () => {
      const { sid, live, excluded } = await seedMixedSession();

      const allIds = [...live, excluded.rejected, excluded.committed, excluded.duplicate];

      const res = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items/reassign-bulk`)
        .set('x-test-user-id', ids.admin)
        .send({
          branch: 'building_documents',
          subCategory: 'minutes',
          itemIds: allIds,
        });
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(live.length);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items).toHaveLength(live.length);
      const returnedIds = (res.body.items as Array<{ id: string }>)
        .map((r) => r.id)
        .sort();
      expect(returnedIds).toEqual([...live].sort());

      // Persist check: each live row got the new branchDecision +
      // manualOverride flag, none of the excluded rows were touched.
      const rows = await db
        .select()
        .from(schema.bulkImportItems)
        .where(inArray(schema.bulkImportItems.id, allIds));
      const byId = new Map(rows.map((r: any) => [r.id, r]));
      for (const id of live) {
        const r = byId.get(id) as any;
        expect(r.branchDecision?.branch).toBe('building_documents');
        expect(r.branchDecision?.subCategory).toBe('minutes');
        expect(r.branchDecision?.manualOverride).toBe(true);
      }
      for (const [status, id] of Object.entries(excluded)) {
        const r = byId.get(id) as any;
        // The seed wrote { branch: 'other', subCategory: 'other' } and
        // the bulk endpoint must leave that intact for any row whose
        // status disqualifies it from the move.
        expect(r.branchDecision?.branch).toBe('other');
        expect(r.branchDecision?.subCategory).toBe('other');
        expect(r.status).toBe(status);
      }
    });

    it('returns updated=0 (and never touches branchDecision) when every id is excluded', async () => {
      const { sid, excluded } = await seedMixedSession();
      const onlyExcluded = [excluded.rejected, excluded.committed, excluded.duplicate];

      const res = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items/reassign-bulk`)
        .set('x-test-user-id', ids.admin)
        .send({
          branch: 'building_documents',
          subCategory: 'minutes',
          itemIds: onlyExcluded,
        });
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(0);
      expect(res.body.items).toEqual([]);

      const rows = await db
        .select()
        .from(schema.bulkImportItems)
        .where(inArray(schema.bulkImportItems.id, onlyExcluded));
      for (const r of rows as any[]) {
        expect(r.branchDecision?.branch).toBe('other');
        expect(r.branchDecision?.subCategory).toBe('other');
      }
    });

    it('rejects an invalid (branch, subCategory) pair with 400 and leaves rows untouched', async () => {
      const { sid, live } = await seedMixedSession();
      const before = await db
        .select()
        .from(schema.bulkImportItems)
        .where(inArray(schema.bulkImportItems.id, live));

      const res = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items/reassign-bulk`)
        .set('x-test-user-id', ids.admin)
        .send({
          branch: 'building_documents',
          subCategory: 'utility', // valid for `bill`, NOT for building_documents
          itemIds: live,
        });
      expect(res.status).toBe(400);

      const after = await db
        .select()
        .from(schema.bulkImportItems)
        .where(inArray(schema.bulkImportItems.id, live));
      // No row mutated.
      const beforeById = new Map((before as any[]).map((r) => [r.id, r.branchDecision]));
      for (const r of after as any[]) {
        expect(r.branchDecision).toEqual(beforeById.get(r.id));
      }
    });

    it('returns 404 for an unknown session and rejects non-admins', async () => {
      const missing = await request(app)
        .post(`/api/admin/bulk-import/sessions/${crypto.randomUUID()}/items/reassign-bulk`)
        .set('x-test-user-id', ids.admin)
        .send({
          branch: 'building_documents',
          subCategory: 'minutes',
          itemIds: [crypto.randomUUID()],
        });
      expect(missing.status).toBe(404);

      const sid = await createSession();
      const forbidden = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items/reassign-bulk`)
        .set('x-test-user-id', ids.nonAdmin)
        .send({
          branch: 'building_documents',
          subCategory: 'minutes',
          itemIds: [crypto.randomUUID()],
        });
      expect([401, 403]).toContain(forbidden.status);
    });
  });

  /**
   * Task #1092 — integration coverage for the optional `residenceId`
   * field on /items/reassign-bulk added in Task #1084. The unit
   * suite at `tests/unit/api/bulk-import-bulk-reassign-with-
   * residence.test.ts` mocks `db`; this one runs the same shapes
   * through the real router, Zod schema, and Postgres.
   */
  describe('POST /sessions/:id/items/reassign-bulk — with residenceId (Task #1092)', () => {
    type BranchDecision = NonNullable<schema.BulkImportItem['branchDecision']>;
    let goodResidenceId: string;
    let foreignBuildingId: string;
    let foreignResidenceId: string;

    beforeAll(async () => {
      if (!REAL_DB_URL) return;
      goodResidenceId = crypto.randomUUID();
      foreignBuildingId = crypto.randomUUID();
      foreignResidenceId = crypto.randomUUID();

      await db.insert(schema.residences).values({
        id: goodResidenceId,
        buildingId: ids.building,
        unitNumber: '101',
        isActive: true,
      });
      // Second building owned by the same org so canAccess still
      // passes — drives the 400 "different building" branch.
      await db.insert(schema.buildings).values({
        id: foreignBuildingId,
        organizationId: ids.org,
        name: `${TEST_TAG} bldg-other`,
        address: '2 Test',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A2',
        buildingType: 'condo',
        totalUnits: 1,
        isActive: true,
      });
      await db.insert(schema.residences).values({
        id: foreignResidenceId,
        buildingId: foreignBuildingId,
        unitNumber: '202',
        isActive: true,
      });
    }, 30_000);

    afterAll(async () => {
      if (!REAL_DB_URL || !db) return;
      // Drop residences before the foreign building; the primary
      // `ids.building` is cleaned by the outer afterAll.
      await db
        .delete(schema.residences)
        .where(
          inArray(schema.residences.id, [goodResidenceId, foreignResidenceId]),
        );
      await db
        .delete(schema.buildings)
        .where(eq(schema.buildings.id, foreignBuildingId));
    }, 30_000);

    /**
     * Stage one PDF and force its status + branchDecision to the
     * requested seed values. Tracks the row for cleanup.
     */
    async function seedItem(
      sid: string,
      filename: string,
      branchDecision: BranchDecision,
      status: schema.BulkImportItem['status'],
    ): Promise<string> {
      const upload = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin)
        .attach(
          'files',
          // Salt the body so each filename hashes uniquely and
          // the upload endpoint's dedupe doesn't drop it.
          Buffer.concat([PDF_BODY, Buffer.from(filename)]),
          { filename, contentType: 'application/pdf' },
        );
      expect(upload.status).toBe(201);
      const item = upload.body.items[0] as schema.BulkImportItem;
      trackedItems.add(item.id);
      await db
        .update(schema.bulkImportItems)
        .set({ status, branchDecision })
        .where(eq(schema.bulkImportItems.id, item.id));
      return item.id;
    }

    async function loadItems(itemIds: string[]): Promise<schema.BulkImportItem[]> {
      const rows = await db
        .select()
        .from(schema.bulkImportItems)
        .where(inArray(schema.bulkImportItems.id, itemIds));
      return rows as schema.BulkImportItem[];
    }

    it('happy path: stamps the residence on every eligible item, sets per-row override/confirm flags, and promotes them to branched', async () => {
      const sid = await createSession();
      // Item A: no AI residence suggestion → manualOverride flips on.
      const idA = await seedItem(
        sid,
        'res-a.pdf',
        { branch: 'building_documents', subCategory: 'other' } as BranchDecision,
        'sorted',
      );
      // Item B: AI suggestion already matches the chosen residence
      // → saving counts as confirming the AI's pick.
      const idB = await seedItem(
        sid,
        'res-b.pdf',
        {
          branch: 'building_documents',
          subCategory: 'other',
          residenceAiSuggestedId: goodResidenceId,
        } as BranchDecision,
        'sorted',
      );

      const res = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items/reassign-bulk`)
        .set('x-test-user-id', ids.admin)
        .send({
          branch: 'residence_documents',
          subCategory: 'lease',
          itemIds: [idA, idB],
          residenceId: goodResidenceId,
        });
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(2);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect((res.body.items as Array<schema.BulkImportItem>).map((r) => r.id).sort()).toEqual(
        [idA, idB].sort(),
      );

      const rows = await loadItems([idA, idB]);
      const byId = new Map(rows.map((r) => [r.id, r]));

      const a = byId.get(idA)!;
      const aBd = a.branchDecision as BranchDecision;
      expect(aBd.branch).toBe('residence_documents');
      expect(aBd.subCategory).toBe('lease');
      expect(aBd.residenceId).toBe(goodResidenceId);
      expect(aBd.residenceManualOverride).toBe(true);
      expect(aBd.residenceAiConfirmed).toBe(false);
      expect(a.status).toBe('branched');

      const b = byId.get(idB)!;
      const bBd = b.branchDecision as BranchDecision;
      expect(bBd.residenceId).toBe(goodResidenceId);
      expect(bBd.residenceManualOverride).toBe(false);
      expect(bBd.residenceAiConfirmed).toBe(true);
      expect(b.status).toBe('branched');
    });

    it('returns 404 when the residenceId does not exist (and never updates any row)', async () => {
      const sid = await createSession();
      const seed = {
        branch: 'building_documents',
        subCategory: 'other',
        manualOverride: false,
      } as BranchDecision;
      const id = await seedItem(sid, 'missing-res.pdf', seed, 'screened');
      const [before] = await loadItems([id]);

      const res = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items/reassign-bulk`)
        .set('x-test-user-id', ids.admin)
        .send({
          branch: 'residence_documents',
          subCategory: 'lease',
          itemIds: [id],
          residenceId: crypto.randomUUID(),
        });
      expect(res.status).toBe(404);
      expect(String(res.body.error)).toMatch(/Residence not found/i);

      const [after] = await loadItems([id]);
      expect(after.branchDecision).toEqual(before.branchDecision);
      expect(after.status).toBe(before.status);
    });

    it('returns 400 when the residenceId belongs to a different building (and never updates any row)', async () => {
      const sid = await createSession();
      const seed = {
        branch: 'building_documents',
        subCategory: 'other',
        manualOverride: false,
      } as BranchDecision;
      const id = await seedItem(sid, 'foreign-res.pdf', seed, 'screened');
      const [before] = await loadItems([id]);

      const res = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items/reassign-bulk`)
        .set('x-test-user-id', ids.admin)
        .send({
          branch: 'residence_documents',
          subCategory: 'lease',
          itemIds: [id],
          residenceId: foreignResidenceId,
        });
      expect(res.status).toBe(400);
      expect(String(res.body.error)).toMatch(/building/i);

      const [after] = await loadItems([id]);
      expect(after.branchDecision).toEqual(before.branchDecision);
      expect(after.status).toBe(before.status);
    });

    it('residenceId: null still moves destination/subCategory but leaves the existing residence bookkeeping untouched', async () => {
      const sid = await createSession();
      // Item already routed to residence_documents with a real
      // residence saved against it. Sending residenceId: null must
      // NOT clear that pick — the residence path is opt-in via a
      // non-null residenceId.
      const seed = {
        branch: 'residence_documents',
        subCategory: 'other',
        residenceId: goodResidenceId,
        residenceManualOverride: true,
        residenceAiConfirmed: false,
      } as BranchDecision;
      const id = await seedItem(sid, 'null-res.pdf', seed, 'branched');

      const res = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items/reassign-bulk`)
        .set('x-test-user-id', ids.admin)
        .send({
          branch: 'residence_documents',
          subCategory: 'lease',
          itemIds: [id],
          residenceId: null,
        });
      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(1);

      const [after] = await loadItems([id]);
      const bd = after.branchDecision as BranchDecision;
      expect(bd.branch).toBe('residence_documents');
      expect(bd.subCategory).toBe('lease');
      expect(bd.residenceId).toBe(goodResidenceId);
      expect(bd.residenceManualOverride).toBe(true);
      expect(bd.residenceAiConfirmed).toBe(false);
      // Status was branched and no residence promotion fired.
      expect(after.status).toBe('branched');
    });
  });

  describe('commit — effectiveDate priority (Task #1003)', () => {
    const trackedDocuments = new Set<string>();

    afterAll(async () => {
      if (!REAL_DB_URL || !db) return;
      if (trackedDocuments.size > 0) {
        await db
          .delete(schema.documents)
          .where(inArray(schema.documents.id, Array.from(trackedDocuments)));
      }
    }, 15_000);

    async function seedItemForCommit(opts: {
      screening?: Record<string, unknown>;
      identification?: Record<string, unknown>;
    }): Promise<{ sid: string; itemId: string }> {
      const sid = await createSession();
      const upload = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin)
        .attach('files', PDF_BODY, {
          filename: `commit-test-${crypto.randomUUID()}.pdf`,
          contentType: 'application/pdf',
        });
      expect(upload.status).toBe(201);
      const item = upload.body.items[0];
      trackedItems.add(item.id);
      await db
        .update(schema.bulkImportItems)
        .set({
          screening: opts.screening ?? null,
          identification: opts.identification ?? null,
          branchDecision: { branch: 'building_documents' },
          status: 'screened',
        })
        .where(eq(schema.bulkImportItems.id, item.id));
      return { sid, itemId: item.id };
    }

    it('uses parsed periodHint as effectiveDate when identification has none', async () => {
      const { itemId } = await seedItemForCommit({
        screening: { periodHint: '2024-03-15' },
        identification: { name: 'Test doc — period hint only' },
      });

      const res = await request(app)
        .post(`/api/admin/bulk-import/items/${itemId}/commit`)
        .set('x-test-user-id', ids.admin);

      expect(res.status).toBe(200);
      expect(res.body.document).toBeDefined();
      trackedDocuments.add(res.body.document.id);

      expect(new Date(res.body.document.effectiveDate).toISOString()).toBe(
        '2024-03-15T00:00:00.000Z',
      );
      expect(res.body.item.status).toBe('committed');
    });

    it('identification.effectiveDate wins over periodHint at commit', async () => {
      const { itemId } = await seedItemForCommit({
        screening: { periodHint: '2024-03-15' },
        identification: { name: 'Test doc — ident wins', effectiveDate: '2025-06-15' },
      });

      const res = await request(app)
        .post(`/api/admin/bulk-import/items/${itemId}/commit`)
        .set('x-test-user-id', ids.admin);

      expect(res.status).toBe(200);
      expect(res.body.document).toBeDefined();
      trackedDocuments.add(res.body.document.id);

      const d = new Date(res.body.document.effectiveDate);
      expect(d.getUTCFullYear()).toBe(2025);
      expect(d.getUTCMonth()).toBe(5);
      expect(d.getUTCDate()).toBe(15);
    });

    it('effectiveDate is null when periodHint is a non-date string and identification has none', async () => {
      const { itemId } = await seedItemForCommit({
        screening: { periodHint: 'INV-2024-042' },
        identification: { name: 'Invoice doc — hint unparseable' },
      });

      const res = await request(app)
        .post(`/api/admin/bulk-import/items/${itemId}/commit`)
        .set('x-test-user-id', ids.admin);

      expect(res.status).toBe(200);
      expect(res.body.document).toBeDefined();
      trackedDocuments.add(res.body.document.id);

      expect(res.body.document.effectiveDate).toBeNull();
    });
  });

  /**
   * Task #1051 — POST /items/:id/replace-file lets an admin swap a
   * corrupt staged PDF for a re-saved copy without leaving the wizard.
   * The endpoint must:
   *   - require admin role
   *   - enforce org-scope via canUserAccessOrganization
   *   - refuse `committed` / `duplicate` items
   *   - update contentHash, originalName, mimeType, fileSize, stagedPath
   *     and write the new bytes onto disk
   *   - delete the previous staged bytes (best-effort) when the path
   *     changed and lived inside STAGING_ROOT
   *   - preserve all AI analysis state (screening, identification,
   *     sortingDecision, branchDecision)
   */
  describe('POST /items/:id/replace-file (Task #1051)', () => {
    const REPLACEMENT_PDF = Buffer.from('%PDF-1.5\nfresh-bytes\n%%EOF', 'utf8');

    async function seedItemForReplace(): Promise<{
      sid: string;
      itemId: string;
      stagedPath: string;
      contentHash: string;
    }> {
      const sid = await createSession();
      // The earlier `commit — effectiveDate priority` describe block
      // commits multiple uploads of the bare `PDF_BODY` constant
      // against `ids.org`, which leaves matching rows in
      // `clientDocumentFingerprints` for that exact hash. The upload
      // endpoint dedups against those fingerprints and would mark a
      // fresh `PDF_BODY` upload as `status: 'duplicate'`, which the
      // replace-file route then rejects with "Cannot replace a
      // duplicate item" — masking both the happy-path test and the
      // "no file attached" 400 path. Stir a per-call unique tail into
      // the bytes so each seeded item has its own hash and starts in
      // a non-duplicate `pending` state.
      const uniqueTag = crypto.randomUUID();
      const seedBody = Buffer.concat([PDF_BODY, Buffer.from(uniqueTag)]);
      const upload = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin)
        .attach('files', seedBody, {
          filename: `corrupt-${uniqueTag}.pdf`,
          contentType: 'application/pdf',
        });
      expect(upload.status).toBe(201);
      const item = upload.body.items[0];
      expect(item.status).not.toBe('duplicate');
      trackedItems.add(item.id);
      return {
        sid,
        itemId: item.id,
        stagedPath: item.stagedPath,
        contentHash: item.contentHash,
      };
    }

    it('replaces the staged file, updates row metadata, and removes the old bytes', async () => {
      const { itemId, stagedPath: oldPath, contentHash: oldHash } =
        await seedItemForReplace();

      // Decorate the item with AI analysis so we can confirm those
      // columns are NOT wiped by the replace.
      await db
        .update(schema.bulkImportItems)
        .set({
          screening: { docType: 'minutes', confidence: 0.9 },
          identification: { name: 'AGM 2024' },
          branchDecision: { branch: 'building_documents' },
          sortingDecision: 'accepted',
        })
        .where(eq(schema.bulkImportItems.id, itemId));

      expect(fs.existsSync(oldPath)).toBe(true);

      const res = await request(app)
        .post(`/api/admin/bulk-import/items/${itemId}/replace-file`)
        .set('x-test-user-id', ids.admin)
        .attach('files', REPLACEMENT_PDF, {
          filename: 'fixed.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(200);
      const expectedHash = crypto
        .createHash('sha256')
        .update(REPLACEMENT_PDF)
        .digest('hex');
      expect(res.body.contentHash).toBe(expectedHash);
      expect(res.body.contentHash).not.toBe(oldHash);
      expect(res.body.originalName).toBe('fixed.pdf');
      expect(res.body.mimeType).toBe('application/pdf');
      expect(res.body.fileSize).toBe(REPLACEMENT_PDF.length);
      expect(res.body.stagedPath).not.toBe(oldPath);

      // New bytes are on disk.
      expect(fs.existsSync(res.body.stagedPath)).toBe(true);
      expect(fs.readFileSync(res.body.stagedPath)).toEqual(REPLACEMENT_PDF);

      // Old bytes were swept up by the best-effort cleanup.
      expect(fs.existsSync(oldPath)).toBe(false);

      // AI analysis state is preserved untouched.
      const [row] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, itemId));
      expect(row.screening).toEqual({ docType: 'minutes', confidence: 0.9 });
      expect(row.identification).toEqual({ name: 'AGM 2024' });
      expect(row.branchDecision).toEqual({ branch: 'building_documents' });
      expect(row.sortingDecision).toBe('accepted');
    });

    it('rejects non-admins with 401/403', async () => {
      const { itemId } = await seedItemForReplace();
      const res = await request(app)
        .post(`/api/admin/bulk-import/items/${itemId}/replace-file`)
        .set('x-test-user-id', ids.nonAdmin)
        .attach('files', REPLACEMENT_PDF, {
          filename: 'fixed.pdf',
          contentType: 'application/pdf',
        });
      expect([401, 403]).toContain(res.status);
    });

    it('rejects an admin from a foreign organization with 403', async () => {
      const { itemId } = await seedItemForReplace();
      const res = await request(app)
        .post(`/api/admin/bulk-import/items/${itemId}/replace-file`)
        .set('x-test-user-id', ids.foreignAdmin)
        .attach('files', REPLACEMENT_PDF, {
          filename: 'fixed.pdf',
          contentType: 'application/pdf',
        });
      expect(res.status).toBe(403);
    });

    it('refuses to replace a committed item', async () => {
      const { itemId } = await seedItemForReplace();
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'committed' })
        .where(eq(schema.bulkImportItems.id, itemId));

      const res = await request(app)
        .post(`/api/admin/bulk-import/items/${itemId}/replace-file`)
        .set('x-test-user-id', ids.admin)
        .attach('files', REPLACEMENT_PDF, {
          filename: 'fixed.pdf',
          contentType: 'application/pdf',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/committed/i);
    });

    it('refuses to replace a linked item (already merged into a document)', async () => {
      const { itemId } = await seedItemForReplace();
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'linked' })
        .where(eq(schema.bulkImportItems.id, itemId));

      const res = await request(app)
        .post(`/api/admin/bulk-import/items/${itemId}/replace-file`)
        .set('x-test-user-id', ids.admin)
        .attach('files', REPLACEMENT_PDF, {
          filename: 'fixed.pdf',
          contentType: 'application/pdf',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/linked/i);
    });

    it('refuses to replace a duplicate item', async () => {
      const { itemId } = await seedItemForReplace();
      await db
        .update(schema.bulkImportItems)
        .set({ status: 'duplicate' })
        .where(eq(schema.bulkImportItems.id, itemId));

      const res = await request(app)
        .post(`/api/admin/bulk-import/items/${itemId}/replace-file`)
        .set('x-test-user-id', ids.admin)
        .attach('files', REPLACEMENT_PDF, {
          filename: 'fixed.pdf',
          contentType: 'application/pdf',
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/duplicate/i);
    });

    it('400s when no file is attached', async () => {
      const { itemId } = await seedItemForReplace();
      const res = await request(app)
        .post(`/api/admin/bulk-import/items/${itemId}/replace-file`)
        .set('x-test-user-id', ids.admin);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/No file uploaded/i);
    });

    it('404s when the item does not exist', async () => {
      const res = await request(app)
        .post(`/api/admin/bulk-import/items/${crypto.randomUUID()}/replace-file`)
        .set('x-test-user-id', ids.admin)
        .attach('files', REPLACEMENT_PDF, {
          filename: 'fixed.pdf',
          contentType: 'application/pdf',
        });
      expect(res.status).toBe(404);
    });
  });

  /**
   * Task #1377 — skipExisting flag on the upload route.
   *
   * Three scenarios:
   *   (a) skipExisting=true skips a file whose hash is in the org's
   *       committed fingerprint cache, removes the staged copy, and
   *       reports skippedExisting > 0.
   *   (b) skipExisting=true still creates a `rejected` row for a file
   *       matching the exclusion store — exclusion store takes priority
   *       over the skip-existing shortcut only when the fingerprint
   *       cache has no match (unchanged behaviour).
   *   (c) skipExisting=false preserves today's behaviour: a file whose
   *       hash is in the fingerprint cache is still staged as a
   *       `duplicate` row.
   */
  describe('POST …/items — skipExisting flag (Task #1377)', () => {
    it('(a) skips a committed-fingerprint file, removes its staged copy, and reports skippedExisting', async () => {
      const sid = await createSession();

      // Use a unique body so we don't collide with fingerprints from
      // other tests in this suite.
      const uniqueSuffix = crypto.randomUUID();
      const body = Buffer.concat([PDF_BODY, Buffer.from(`1377a-${uniqueSuffix}`)]);
      const expectedHash = crypto.createHash('sha256').update(body).digest('hex');

      // Seed a committed fingerprint for this org+hash.
      await db.insert(schema.clientDocumentFingerprints).values({
        organizationId: ids.org,
        contentHash: expectedHash,
        buildingId: ids.building,
        sourceFileName: 'existing.pdf',
      });

      const upload = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin)
        .field('skipExisting', 'true')
        .attach('files', body, {
          filename: 'existing.pdf',
          contentType: 'application/pdf',
        });

      expect(upload.status).toBe(201);
      // No item row created.
      expect(upload.body.items).toHaveLength(0);
      // skippedExisting counter reports the skipped file.
      expect(upload.body.skippedExisting).toBe(1);

      // Verify no DB row was inserted.
      const rows = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.sessionId, sid));
      expect(rows).toHaveLength(0);

      // The staging directory for this session should have no file
      // matching this hash (temp copy removed from disk).
      const sessionDir = nodePath.join(stagingRoot, sid);
      const matchingFiles = fs.existsSync(sessionDir)
        ? fs.readdirSync(sessionDir).filter((f) => f.startsWith(expectedHash))
        : [];
      expect(matchingFiles).toHaveLength(0);

      // Cleanup the seeded fingerprint.
      await db
        .delete(schema.clientDocumentFingerprints)
        .where(
          and(
            eq(schema.clientDocumentFingerprints.organizationId, ids.org),
            eq(schema.clientDocumentFingerprints.contentHash, expectedHash),
          ),
        );
    });

    it('(b) skipExisting=true still stages exclusion-store matches as rejected rows', async () => {
      const sid = await createSession();

      const uniqueSuffix = crypto.randomUUID();
      const body = Buffer.concat([PDF_BODY, Buffer.from(`1377b-${uniqueSuffix}`)]);
      const expectedHash = crypto.createHash('sha256').update(body).digest('hex');

      // Seed the exclusion store only (no committed fingerprint).
      await db.insert(schema.clientExcludedFingerprints).values({
        organizationId: ids.org,
        contentHash: expectedHash,
        source: 'manual',
      });

      const upload = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin)
        .field('skipExisting', 'true')
        .attach('files', body, {
          filename: 'excluded.pdf',
          contentType: 'application/pdf',
        });

      expect(upload.status).toBe(201);
      // Item IS created — exclusion store wins and marks it rejected.
      expect(upload.body.items).toHaveLength(1);
      expect(upload.body.skippedExisting).toBe(0);
      const item = upload.body.items[0];
      trackedItems.add(item.id);
      expect(item.status).toBe('rejected');
      expect(item.preExcludeStatus).toBe('pending');
      expect(item.excludeSource).toBe('prior_session');

      // Cleanup the seeded exclusion fingerprint.
      await db
        .delete(schema.clientExcludedFingerprints)
        .where(
          and(
            eq(schema.clientExcludedFingerprints.organizationId, ids.org),
            eq(schema.clientExcludedFingerprints.contentHash, expectedHash),
          ),
        );
    });

    it('(c) skipExisting=false creates a duplicate row even when the hash is committed', async () => {
      const sid = await createSession();

      const uniqueSuffix = crypto.randomUUID();
      const body = Buffer.concat([PDF_BODY, Buffer.from(`1377c-${uniqueSuffix}`)]);
      const expectedHash = crypto.createHash('sha256').update(body).digest('hex');

      // Seed a committed fingerprint.
      await db.insert(schema.clientDocumentFingerprints).values({
        organizationId: ids.org,
        contentHash: expectedHash,
        buildingId: ids.building,
        sourceFileName: 'dup.pdf',
      });

      const upload = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin)
        .field('skipExisting', 'false')
        .attach('files', body, {
          filename: 'dup.pdf',
          contentType: 'application/pdf',
        });

      expect(upload.status).toBe(201);
      // Row IS created with duplicate status (old behaviour preserved).
      expect(upload.body.items).toHaveLength(1);
      expect(upload.body.skippedExisting).toBe(0);
      const item = upload.body.items[0];
      trackedItems.add(item.id);
      expect(item.status).toBe('duplicate');

      // Cleanup.
      await db
        .delete(schema.clientDocumentFingerprints)
        .where(
          and(
            eq(schema.clientDocumentFingerprints.organizationId, ids.org),
            eq(schema.clientDocumentFingerprints.contentHash, expectedHash),
          ),
        );
    });
  });
});
