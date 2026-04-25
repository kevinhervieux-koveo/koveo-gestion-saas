/**
 * @jest-environment node
 *
 * Task #479: Cover the rest of the bulk-import AI steps with real-PDF
 * (and real-PNG) integration tests.
 *
 * Task #463 already locks down `POST /api/admin/bulk-import/items/:id/screen`,
 * but the other four AI route handlers (`/sort`, `/branch`, `/identify`,
 * `/link`) read the same `stagedPath` + `mimeType` off the item row and
 * must keep forwarding the file body to the analyzer. The unit tests in
 * `tests/unit/services/bulk-import-analyzer.test.ts` only exercise the
 * analyzer directly — a future refactor of any of these route handlers
 * could silently drop the file attachment without those tests noticing.
 *
 * For each route this test stages a real file on disk, swaps a fake
 * Anthropic transport in via `bulkImportAnalyzer.__setClientForTests`,
 * POSTs the route, and asserts the captured Anthropic payload contains
 * a `document` (PDF) or `image` (PNG) content block whose base64 bytes
 * match the staged file. /branch is exercised against a PNG so the
 * image-block path is covered too.
 *
 * Follows the real-Postgres pattern from
 * `tests/integration/bulk-import-screen-file-attachment.test.ts`: gated
 * on `_INTEGRATION_DB_URL` and skips cleanly when no Postgres is
 * available.
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
const TEST_TAG = 'task479-bulk-import-ai-steps';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

const PDF_BODY = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF',
  'utf8',
);
const PDF_BASE64 = PDF_BODY.toString('base64');
const PDF_NAME = 'lease.pdf';

// Minimal valid 1x1 PNG (8-byte signature + IHDR + IDAT + IEND).
const PNG_BODY = Buffer.from(
  '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4' +
    '890000000A49444154789C6300010000000500010DDA22DB0000000049454E44' +
    'AE426082',
  'hex',
);
const PNG_BASE64 = PNG_BODY.toString('base64');
const PNG_NAME = 'invoice-scan.png';

describeIfDb('bulk-import AI route handlers stream staged files to Anthropic — Task #479', () => {
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
  let stagingDir: string;
  let pdfStagedPath: string;
  let pngStagedPath: string;
  let createSpy: jest.Mock;

  const ids = {
    org: crypto.randomUUID(),
    building: crypto.randomUUID(),
    admin: crypto.randomUUID(),
    session: crypto.randomUUID(),
    pdfItem: crypto.randomUUID(),
    pngItem: crypto.randomUUID(),
  };

  const created = {
    items: new Set<string>([ids.pdfItem, ids.pngItem]),
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
      process.env.SESSION_SECRET || 'test-session-secret-task479';
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

    // Stage real files on disk under the route's expected staging
    // directory layout.
    stagingDir = nodePath.join(
      process.cwd(),
      '.staging',
      'bulk-import',
      ids.session,
    );
    fs.mkdirSync(stagingDir, { recursive: true });
    const pdfHash = crypto.createHash('sha256').update(PDF_BODY).digest('hex');
    pdfStagedPath = nodePath.join(stagingDir, `${pdfHash}_${PDF_NAME}`);
    fs.writeFileSync(pdfStagedPath, PDF_BODY);
    const pngHash = crypto.createHash('sha256').update(PNG_BODY).digest('hex');
    pngStagedPath = nodePath.join(stagingDir, `${pngHash}_${PNG_NAME}`);
    fs.writeFileSync(pngStagedPath, PNG_BODY);

    await db.insert(schema.bulkImportSessions).values({
      id: ids.session,
      buildingId: ids.building,
      organizationId: ids.org,
      adminUserId: ids.admin,
      currentStep: 'sorting',
      status: 'active',
      progress: {},
    });
    // Pre-seed both items with screening + branch decisions so
    // /identify and /link can pull a description / branch off the row
    // without us having to run the earlier steps first.
    await db.insert(schema.bulkImportItems).values({
      id: ids.pdfItem,
      sessionId: ids.session,
      originalPath: PDF_NAME,
      originalName: PDF_NAME,
      stagedPath: pdfStagedPath,
      contentHash: pdfHash,
      mimeType: 'application/pdf',
      fileSize: PDF_BODY.length,
      status: 'screened',
      screening: { description: 'Lease agreement', suggestedFilename: PDF_NAME },
      branchDecision: { branch: 'building_documents', reason: '' },
    });
    await db.insert(schema.bulkImportItems).values({
      id: ids.pngItem,
      sessionId: ids.session,
      originalPath: PNG_NAME,
      originalName: PNG_NAME,
      stagedPath: pngStagedPath,
      contentHash: pngHash,
      mimeType: 'image/png',
      fileSize: PNG_BODY.length,
      status: 'screened',
      screening: { description: 'Scanned utility invoice', suggestedFilename: PNG_NAME },
      branchDecision: { branch: 'bill', reason: '' },
    });

    // Default fake transport — every test installs its own
    // `mockResolvedValue` payload in `beforeEach`.
    createSpy = jest.fn();
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

  beforeEach(() => {
    createSpy.mockReset();
  });

  function getFirstUserContent(): Array<{ type: string; source?: any; text?: string }> {
    expect(createSpy).toHaveBeenCalledTimes(1);
    const sent = createSpy.mock.calls[0][0] as {
      messages: Array<{ content: Array<{ type: string; source?: any; text?: string }> }>;
    };
    expect(Array.isArray(sent.messages[0].content)).toBe(true);
    return sent.messages[0].content;
  }

  it('/sort streams the staged PDF to Anthropic as a base64 document block', async () => {
    createSpy.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            decision: 'keep',
            reason: 'standalone',
            confidence: 0.8,
          }),
        },
      ],
    });

    const res = await request(app)
      .post(`/api/admin/bulk-import/items/${ids.pdfItem}/sort`)
      .set('x-test-user-id', ids.admin)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(ids.pdfItem);

    // Task #1047: per-item retry is fire-and-forget; wait for the
    // background AI call to settle before reading the persisted row.
    await waitForRetryToSettle(ids.pdfItem, 'sorting');

    const [row] = await db
      .select()
      .from(schema.bulkImportItems)
      .where(eq(schema.bulkImportItems.id, ids.pdfItem));
    expect(row.status).toBe('sorted');
    expect((row.sortingDecision as any).decision).toBe('keep');

    const blocks = getFirstUserContent();
    const docBlock = blocks.find((b) => b.type === 'document');
    expect(docBlock).toBeDefined();
    expect(docBlock!.source.type).toBe('base64');
    expect(docBlock!.source.media_type).toBe('application/pdf');
    expect(docBlock!.source.data).toBe(PDF_BASE64);
    expect(blocks.find((b) => b.type === 'text')).toBeDefined();
  }, 30_000);

  it('/branch streams the staged PNG to Anthropic as a base64 image block', async () => {
    createSpy.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            branch: 'bill',
            reason: 'looks like a utility bill',
            confidence: 0.77,
          }),
        },
      ],
    });

    const res = await request(app)
      .post(`/api/admin/bulk-import/items/${ids.pngItem}/branch`)
      .set('x-test-user-id', ids.admin)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(ids.pngItem);

    // Task #1047: per-item retry is fire-and-forget; wait for the
    // background AI call to settle before reading the persisted row.
    await waitForRetryToSettle(ids.pngItem, 'branching');

    const [row] = await db
      .select()
      .from(schema.bulkImportItems)
      .where(eq(schema.bulkImportItems.id, ids.pngItem));
    expect(row.status).toBe('branched');
    expect((row.branchDecision as any).branch).toBe('bill');

    const blocks = getFirstUserContent();
    const imageBlock = blocks.find((b) => b.type === 'image');
    expect(imageBlock).toBeDefined();
    expect(imageBlock!.source.type).toBe('base64');
    expect(imageBlock!.source.media_type).toBe('image/png');
    expect(imageBlock!.source.data).toBe(PNG_BASE64);
    expect(blocks.find((b) => b.type === 'text')).toBeDefined();
  }, 30_000);

  it('/identify streams the staged PDF to Anthropic as a base64 document block', async () => {
    createSpy.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            name: 'Lease 2026',
            description: 'Annual lease',
            tags: ['lease'],
            metadata: {},
            confidence: 0.85,
          }),
        },
      ],
    });

    const res = await request(app)
      .post(`/api/admin/bulk-import/items/${ids.pdfItem}/identify`)
      .set('x-test-user-id', ids.admin)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(ids.pdfItem);

    // Task #1047: per-item retry is fire-and-forget; wait for the
    // background AI call to settle before reading the persisted row.
    await waitForRetryToSettle(ids.pdfItem, 'identification');

    const [row] = await db
      .select()
      .from(schema.bulkImportItems)
      .where(eq(schema.bulkImportItems.id, ids.pdfItem));
    expect(row.status).toBe('identified');
    expect((row.identification as any).name).toBe('Lease 2026');

    const blocks = getFirstUserContent();
    const docBlock = blocks.find((b) => b.type === 'document');
    expect(docBlock).toBeDefined();
    expect(docBlock!.source.media_type).toBe('application/pdf');
    expect(docBlock!.source.data).toBe(PDF_BASE64);
    expect(blocks.find((b) => b.type === 'text')).toBeDefined();
  }, 30_000);

  it('/link streams the staged PDF to Anthropic as a base64 document block', async () => {
    createSpy.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            relatedItemIds: [ids.pngItem],
            reason: 'same building',
            confidence: 0.7,
          }),
        },
      ],
    });

    const res = await request(app)
      .post(`/api/admin/bulk-import/items/${ids.pdfItem}/link`)
      .set('x-test-user-id', ids.admin)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(ids.pdfItem);

    // Task #1047: per-item retry is fire-and-forget; wait for the
    // background AI call to settle before reading the persisted row.
    await waitForRetryToSettle(ids.pdfItem, 'linking');

    const blocks = getFirstUserContent();
    const docBlock = blocks.find((b) => b.type === 'document');
    expect(docBlock).toBeDefined();
    expect(docBlock!.source.media_type).toBe('application/pdf');
    expect(docBlock!.source.data).toBe(PDF_BASE64);
    expect(blocks.find((b) => b.type === 'text')).toBeDefined();

    // Persisted on the item row.
    const rows = await db
      .select()
      .from(schema.bulkImportItems)
      .where(eq(schema.bulkImportItems.id, ids.pdfItem));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('linked');
    expect(rows[0].linkDecisions?.relatedItemIds).toEqual([ids.pngItem]);
  }, 30_000);
});
