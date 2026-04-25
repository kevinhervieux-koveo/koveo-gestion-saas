/**
 * @jest-environment node
 *
 * Task #463: Cover the Anthropic file-upload path with a real-PDF
 * integration test.
 *
 * The unit tests in `tests/unit/services/bulk-import-analyzer.test.ts`
 * mock the Anthropic client and assert on the content blocks the
 * analyzer *sends*, but they call the analyzer directly. They do not
 * exercise the Express route (`POST /api/admin/bulk-import/items/:id/screen`)
 * which is responsible for loading the staged item from Postgres,
 * passing the on-disk `stagedPath` to the analyzer, and persisting
 * the screening result back. A future refactor of the route layer
 * could silently drop `stagedPath` from the analyzer call and the
 * unit tests would still pass.
 *
 * This test stages a tiny real PDF on disk, inserts a real
 * bulk_import_session + bulk_import_item row pointing at it, swaps in
 * a fake Anthropic transport via `__setClientForTests`, and POSTs the
 * screen endpoint. It then asserts the fake transport received a
 * `document` content block whose base64 payload matches the staged
 * file bytes — i.e. the full pipeline routed the on-disk file all the
 * way to the LLM call.
 *
 * Follows the existing real-Postgres integration pattern (see
 * `tests/integration/upload-filename-normalization.test.ts`): gated on
 * `_INTEGRATION_DB_URL` (auto-populated from `DATABASE_URL` by
 * `jest.polyfills.js`) and skips cleanly when no Postgres is
 * available.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

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
const TEST_TAG = 'task463-bulk-import-screen';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

const PDF_BODY = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF',
  'utf8',
);
const PDF_BASE64 = PDF_BODY.toString('base64');
const ORIGINAL_NAME = 'lease.pdf';

describeIfDb('bulk-import screen route attaches staged PDF to Anthropic call — Task #463', () => {
  let app: express.Application;
  let db: any;
  let schema: any;
  let bulkImportAnalyzer: typeof import('../../server/services/bulk-import-analyzer').bulkImportAnalyzer;
  let inFlightPerItemRetry: Set<string>;

  /**
   * Task #1047: per-item retry endpoints are now fire-and-forget. The
   * HTTP response carries the pre-AI snapshot, so we wait for the
   * `inFlightPerItemRetry` marker to clear before reading the
   * persisted row.
   */
  async function waitForRetryToSettle(
    itemId: string,
    step: 'screening' | 'sorting' | 'branching' | 'identification' | 'linking',
    maxMs = 8000,
  ): Promise<void> {
    const key = `${itemId}:${step}`;
    const start = Date.now();
    while (inFlightPerItemRetry.has(key)) {
      if (Date.now() - start > maxMs) {
        throw new Error(
          `[test] per-item retry ${key} did not settle within ${maxMs}ms`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  let stagedPath: string;
  let stagingDir: string;
  let createSpy: jest.Mock;

  const ids = {
    org: crypto.randomUUID(),
    building: crypto.randomUUID(),
    admin: crypto.randomUUID(),
    session: crypto.randomUUID(),
    item: crypto.randomUUID(),
  };

  const created = {
    items: new Set<string>([ids.item]),
    sessions: new Set<string>([ids.session]),
    users: new Set<string>([ids.admin]),
    buildings: new Set<string>([ids.building]),
    organizations: new Set<string>([ids.org]),
  };

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || 'test-session-secret-task463';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    // Make sure the analyzer takes the real-client path (we override
    // the client below) instead of the no-API-key fallback.
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-fake-key';

    db = require('../../server/db').db;
    schema = require('@shared/schema');
    bulkImportAnalyzer =
      require('../../server/services/bulk-import-analyzer').bulkImportAnalyzer;
    const bulkImportApi = require('../../server/api/bulk-import');
    const { registerBulkImportRoutes } = bulkImportApi;
    inFlightPerItemRetry = bulkImportApi.inFlightPerItemRetry;

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

    // Seed org / building / admin user.
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
    await db.insert(schema.users).values({
      id: ids.admin,
      username: `${TEST_TAG}-admin-${ids.admin.slice(0, 8)}`,
      email: `${ids.admin}@${TEST_TAG}.test`,
      password: 'unused-bcrypt-hash',
      firstName: 'Bulk',
      lastName: 'Admin',
      role: 'admin',
      isActive: true,
    });

    // Stage a real PDF on disk under the route's expected staging
    // directory layout.
    stagingDir = nodePath.join(
      process.cwd(),
      '.staging',
      'bulk-import',
      ids.session,
    );
    fs.mkdirSync(stagingDir, { recursive: true });
    const contentHash = crypto.createHash('sha256').update(PDF_BODY).digest('hex');
    stagedPath = nodePath.join(stagingDir, `${contentHash}_${ORIGINAL_NAME}`);
    fs.writeFileSync(stagedPath, PDF_BODY);

    // Seed a session + a single item that points at the staged PDF.
    await db.insert(schema.bulkImportSessions).values({
      id: ids.session,
      buildingId: ids.building,
      organizationId: ids.org,
      adminUserId: ids.admin,
      currentStep: 'screening',
      status: 'active',
      progress: {},
    });
    await db.insert(schema.bulkImportItems).values({
      id: ids.item,
      sessionId: ids.session,
      originalPath: ORIGINAL_NAME,
      originalName: ORIGINAL_NAME,
      stagedPath,
      contentHash,
      mimeType: 'application/pdf',
      fileSize: PDF_BODY.length,
      status: 'pending',
    });

    // Swap in a fake Anthropic transport that returns a deterministic
    // screening JSON. We capture the call args to assert on the
    // content blocks the route caused the analyzer to send.
    createSpy = jest.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            isComplete: true,
            isMultiDocument: false,
            pageOrderHint: null,
            rotationDegrees: 0,
            suggestedFilename: ORIGINAL_NAME,
            description: 'Lease agreement',
            confidence: 0.91,
          }),
        },
      ],
    });
    bulkImportAnalyzer.__setClientForTests({
      messages: { create: createSpy },
    } as unknown as Parameters<typeof bulkImportAnalyzer.__setClientForTests>[0]);
  }, 30_000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    try {
      bulkImportAnalyzer.__setClientForTests(null);
    } catch {
      /* best-effort */
    }
    if (created.items.size > 0) {
      await db
        .delete(schema.bulkImportItems)
        .where(inArray(schema.bulkImportItems.id, Array.from(created.items)));
    }
    if (created.sessions.size > 0) {
      await db
        .delete(schema.bulkImportSessions)
        .where(
          inArray(schema.bulkImportSessions.id, Array.from(created.sessions)),
        );
    }
    if (created.users.size > 0) {
      await db
        .delete(schema.users)
        .where(inArray(schema.users.id, Array.from(created.users)));
    }
    if (created.buildings.size > 0) {
      await db
        .delete(schema.buildings)
        .where(inArray(schema.buildings.id, Array.from(created.buildings)));
    }
    if (created.organizations.size > 0) {
      await db
        .delete(schema.organizations)
        .where(
          inArray(schema.organizations.id, Array.from(created.organizations)),
        );
    }
    try {
      if (stagingDir && fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
    } catch {
      /* best-effort */
    }
  }, 30_000);

  it('streams the staged PDF to Anthropic as a base64 document block', async () => {
    const res = await request(app)
      .post(`/api/admin/bulk-import/items/${ids.item}/screen`)
      .set('x-test-user-id', ids.admin)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(ids.item);

    // Task #1047: per-item retry is fire-and-forget — the HTTP body
    // is the pre-AI snapshot. Wait for the background AI call to
    // settle before reading the persisted row.
    await waitForRetryToSettle(ids.item, 'screening');

    // The fake transport must have been called exactly once, and the
    // first message's content must include a `document` block whose
    // base64 payload equals the staged PDF bytes.
    expect(createSpy).toHaveBeenCalledTimes(1);
    const sent = createSpy.mock.calls[0][0] as {
      messages: Array<{ content: Array<{ type: string; source?: any }> }>;
    };
    expect(Array.isArray(sent.messages[0].content)).toBe(true);
    const blocks = sent.messages[0].content;

    const docBlock = blocks.find((b) => b.type === 'document');
    expect(docBlock).toBeDefined();
    expect(docBlock!.source.type).toBe('base64');
    expect(docBlock!.source.media_type).toBe('application/pdf');
    expect(docBlock!.source.data).toBe(PDF_BASE64);

    // And a text block carrying the prompt.
    const textBlock = blocks.find((b) => b.type === 'text');
    expect(textBlock).toBeDefined();

    // The screening result should also be persisted on the item row.
    const rows = await db
      .select()
      .from(schema.bulkImportItems)
      .where(eq(schema.bulkImportItems.id, ids.item));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('screened');
    expect(rows[0].screening?.suggestedFilename).toBe(ORIGINAL_NAME);
  }, 30_000);
});
