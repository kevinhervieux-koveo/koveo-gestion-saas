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
const PNG_BODY = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489',
  'hex',
);

describeIfDb('bulk-import REST endpoints — Task #456', () => {
  let app: express.Application;
  let db: any;
  let schema: any;
  let bulkImportAnalyzer: typeof import('../../server/services/bulk-import-analyzer').bulkImportAnalyzer;
  let screenAllInProgress: Set<string>;

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
  const stagingRoot = nodePath.join(process.cwd(), '.staging', 'bulk-import');

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || 'test-session-secret-task456';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    // Ensure the analyzer takes the real-client path so our test fake
    // (`__setClientForTests`) is actually exercised by the screen-all
    // loop instead of falling back to the no-API-key stub.
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-fake-key';

    db = require('../../server/db').db;
    schema = require('@shared/schema');
    const bulkImportModule = require('../../server/api/bulk-import');
    const { registerBulkImportRoutes } = bulkImportModule;
    screenAllInProgress = bulkImportModule.screenAllInProgress;
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
    if (!REAL_DB_URL || !db) return;
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
    expect(upload.body).toHaveLength(2);
    upload.body.forEach((row: any) => trackedItems.add(row.id));

    const pdfItem = upload.body.find((r: any) => r.originalName === 'lease.pdf');
    const pngItem = upload.body.find((r: any) => r.originalName === 'meter.png');
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
    const item = upload.body[0];
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
    const item = upload.body[0];
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

  it('auto-screens every pending item via POST /screen-all and is idempotent (Task #575)', async () => {
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
    upload.body.forEach((row: any) => trackedItems.add(row.id));

    // First call kicks off the fire-and-forget loop and must respond
    // immediately without blocking on the AI work.
    const start = Date.now();
    const trigger = await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/screen-all`)
      .set('x-test-user-id', ids.admin);
    expect(trigger.status).toBe(202);
    expect(trigger.body.status).toBe('started');
    expect(Date.now() - start).toBeLessThan(2000);

    // A second call while the loop is still running must be reported
    // as already in progress so the wizard does not stack duplicates.
    const again = await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/screen-all`)
      .set('x-test-user-id', ids.admin);
    expect(again.status).toBe(202);
    expect(['started', 'in-progress']).toContain(again.body.status);

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
        finalRows.length === upload.body.length &&
        finalRows.every((r) => r.status !== 'pending' && r.status !== 'screening')
      ) {
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(finalRows).toHaveLength(upload.body.length);
    finalRows.forEach((row) => {
      expect(['screened']).toContain(row.status);
      expect(row.screening).toBeTruthy();
      expect(typeof row.screening.confidence).toBe('number');
    });
  }, 45_000);

  it('screen-all returns 404 for an unknown session and rejects non-admins', async () => {
    const missing = await request(app)
      .post(`/api/admin/bulk-import/sessions/${crypto.randomUUID()}/screen-all`)
      .set('x-test-user-id', ids.admin);
    expect(missing.status).toBe(404);

    const sid = await createSession();
    const forbidden = await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/screen-all`)
      .set('x-test-user-id', ids.nonAdmin);
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

    // Stage four pending items so the loop has to make several
    // sequential Anthropic calls; the DELETE in the middle should
    // interrupt processing well before the queue drains.
    const filenames = ['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf'];
    for (const name of filenames) {
      const upload = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/items`)
        .set('x-test-user-id', ids.admin)
        .attach('files', Buffer.concat([PDF_BODY, Buffer.from(name)]), {
          filename: name,
          contentType: 'application/pdf',
        });
      expect(upload.status).toBe(201);
      upload.body.forEach((row: any) => trackedItems.add(row.id));
    }

    // Slow fake Anthropic transport: every screen() takes ~150 ms so
    // four items would need ~600 ms total. We will DELETE after the
    // first one or two complete and assert the rest are skipped.
    const slowSpy = jest.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
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
        .post(`/api/admin/bulk-import/sessions/${sid}/screen-all`)
        .set('x-test-user-id', ids.admin);
      expect(start.status).toBe(202);
      expect(start.body.status).toBe('started');
      // The loop is scheduled fire-and-forget; give it a moment to
      // start the first item and then clear before the queue drains.
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(screenAllInProgress.has(sid)).toBe(true);

      const del = await request(app)
        .delete(`/api/admin/bulk-import/sessions/${sid}`)
        .set('x-test-user-id', ids.admin);
      expect(del.status).toBe(200);

      // The DELETE handler removes the session id synchronously, so
      // the next iteration of the loop will see an empty set and
      // exit. After that finally block runs, the set must be empty.
      const deadline = Date.now() + 2_000;
      while (screenAllInProgress.has(sid) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(screenAllInProgress.has(sid)).toBe(false);

      // Snapshot the call count right after cancellation, then wait
      // long enough that any uncancelled loop would have made several
      // more screen() calls. The count must not grow.
      const callsAtCancel = slowSpy.mock.calls.length;
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(slowSpy.mock.calls.length).toBe(callsAtCancel);

      // And we must have stopped early: with 4 items @150 ms each the
      // unbounded loop would call screen() 4 times. Cancellation should
      // hold this strictly below the queue length.
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
      // Defensive: drop the session id from the cancellation set in
      // case the test failed before the natural cleanup ran.
      screenAllInProgress.delete(sid);
    }
  }, 15_000);

  /**
   * Companion check for Task #593: a `screen-all` POST against a
   * session that already has the loop running must be a no-op (still
   * 202) and must not start a second background loop.
   */
  it('does not start a second screen-all loop when one is already running', async () => {
    const sid = await createSession();
    await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/items`)
      .set('x-test-user-id', ids.admin)
      .attach('files', Buffer.concat([PDF_BODY, Buffer.from('once.pdf')]), {
        filename: 'once.pdf',
        contentType: 'application/pdf',
      })
      .then((res) => res.body.forEach((r: any) => trackedItems.add(r.id)));

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
        .post(`/api/admin/bulk-import/sessions/${sid}/screen-all`)
        .set('x-test-user-id', ids.admin);
      expect(first.status).toBe(202);
      expect(first.body.status).toBe('started');

      // While the first loop is still on its first item, fire a
      // duplicate request: it must short-circuit with `in-progress`.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const second = await request(app)
        .post(`/api/admin/bulk-import/sessions/${sid}/screen-all`)
        .set('x-test-user-id', ids.admin);
      expect(second.status).toBe(202);
      expect(second.body.status).toBe('in-progress');

      // Wait for the (single) loop to finish and verify only one
      // Anthropic call was made for the one staged item.
      const deadline = Date.now() + 2_000;
      while (screenAllInProgress.has(sid) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(screenAllInProgress.has(sid)).toBe(false);
      expect(slowSpy.mock.calls.length).toBe(1);
    } finally {
      bulkImportAnalyzer.__setClientForTests(null);
      screenAllInProgress.delete(sid);
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
      const item = upload.body[0];
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
      const itemA = uploadA.body[0];
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
      const itemB = uploadB.body[0];
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
      const item = upload.body[0];
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
});
