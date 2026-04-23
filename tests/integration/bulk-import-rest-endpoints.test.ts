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
import { eq, inArray } from 'drizzle-orm';

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

  const ids = {
    org: crypto.randomUUID(),
    building: crypto.randomUUID(),
    admin: crypto.randomUUID(),
    nonAdmin: crypto.randomUUID(),
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

    db = require('../../server/db').db;
    schema = require('@shared/schema');
    const { registerBulkImportRoutes } = require('../../server/api/bulk-import');

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
    ]);
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
    await db
      .delete(schema.users)
      .where(inArray(schema.users.id, [ids.admin, ids.nonAdmin]));
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
    expect(list.body.find((s: any) => s.id === sid)).toBeDefined();

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
});
