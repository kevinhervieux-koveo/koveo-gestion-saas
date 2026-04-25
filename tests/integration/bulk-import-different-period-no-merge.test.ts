/**
 * @jest-environment node
 *
 * Task #961: End-to-end guarantee that two same-type / same-bucket
 * documents whose Screening blobs carry DIFFERENT periodHints are
 * never auto-merged by the sorting step.
 *
 * Task #955 fixed this at two levels:
 *   - the `suggestMergeOrSplit` prompt was tightened to forbid merging
 *     across different periods, and
 *   - `isTriviallyKeep` (server/api/bulk-import.ts) was extended so the
 *     sorting step short-circuits to `decision: 'keep'` without an AI
 *     call when every same-type+bucket sibling has a non-null
 *     periodHint that differs from this item's periodHint.
 *
 * Unit coverage exists for both halves, but there was no integration
 * test driving the full HTTP sorting flow end-to-end. A future prompt
 * tweak or an accidental change to the short-circuit could silently
 * break the fix without any test failing.
 *
 * This test:
 *   1. Stages two PV (meeting minutes) PDFs in one session whose
 *      screening blobs share `typeGuess='minutes'` +
 *      `bucketGuess='building_documents'` but carry different
 *      `periodHint`s ("2021-10" vs "2022-11"), with
 *      `isMultiDocument: false` on both.
 *   2. Installs a fake Anthropic transport that would return
 *      `decision: 'merge'` if it were ever called — i.e. simulates
 *      the worst-case scenario where a future prompt regression
 *      starts proposing merges for different-year siblings.
 *   3. POSTs `/api/admin/bulk-import/items/:id/sort` for both items
 *      (the per-item Retry / Run-all sorting endpoint, which both go
 *      through the shared `processItemForStep` helper).
 *   4. Asserts both items come back with `decision: 'keep'`, and the
 *      Anthropic mock was never invoked (proving the short-circuit
 *      caught the different-period case before any AI call).
 *
 * Follows the real-Postgres pattern from
 * `tests/integration/bulk-import-ai-steps-file-attachment.test.ts`:
 * gated on `_INTEGRATION_DB_URL` and skips cleanly when no Postgres
 * is available.
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
import { inArray } from 'drizzle-orm';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task961-different-period-no-merge';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

const PDF_BODY_2021 = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n% PV 2021-10',
  'utf8',
);
const PDF_BODY_2022 = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n% PV 2022-11',
  'utf8',
);
const PV_2021_NAME = 'pv-2021-10.pdf';
const PV_2022_NAME = 'pv-2022-11.pdf';

describeIfDb('bulk-import sorting never auto-merges different-period siblings — Task #961', () => {
  let app: express.Application;
  let db: any;
  let schema: any;
  let bulkImportAnalyzer: typeof import('../../server/services/bulk-import-analyzer').bulkImportAnalyzer;
  let stagingDir: string;
  let stagedPath2021: string;
  let stagedPath2022: string;
  let createSpy: jest.Mock;

  const ids = {
    org: crypto.randomUUID(),
    building: crypto.randomUUID(),
    admin: crypto.randomUUID(),
    session: crypto.randomUUID(),
    item2021: crypto.randomUUID(),
    item2022: crypto.randomUUID(),
  };

  const created = {
    items: new Set<string>([ids.item2021, ids.item2022]),
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
      process.env.SESSION_SECRET || 'test-session-secret-task961';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    // Force the analyzer onto the real-client path so our fake
    // transport is actually consulted (and so any regression that
    // bypasses the short-circuit would call our mock).
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-fake-key';

    db = require('../../server/db').db;
    schema = require('@shared/schema');
    bulkImportAnalyzer =
      require('../../server/services/bulk-import-analyzer').bulkImportAnalyzer;
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
    const hash2021 = crypto.createHash('sha256').update(PDF_BODY_2021).digest('hex');
    stagedPath2021 = nodePath.join(stagingDir, `${hash2021}_${PV_2021_NAME}`);
    fs.writeFileSync(stagedPath2021, PDF_BODY_2021);
    const hash2022 = crypto.createHash('sha256').update(PDF_BODY_2022).digest('hex');
    stagedPath2022 = nodePath.join(stagingDir, `${hash2022}_${PV_2022_NAME}`);
    fs.writeFileSync(stagedPath2022, PDF_BODY_2022);

    await db.insert(schema.bulkImportSessions).values({
      id: ids.session,
      buildingId: ids.building,
      organizationId: ids.org,
      adminUserId: ids.admin,
      currentStep: 'sorting',
      status: 'active',
      progress: {},
    });

    // Both items: same typeGuess + bucketGuess, isMultiDocument=false,
    // but DIFFERENT periodHints. This is the canonical "two PVs from
    // different years" shape that Task #955 protects.
    const screening2021 = {
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      rotationApplied: false,
      suggestedFilename: PV_2021_NAME,
      description: 'Procès-verbal réunion octobre 2021',
      confidence: 0.92,
      fallbackReason: null,
      periodHint: '2021-10',
      quickAnalysis: {
        typeGuess: 'minutes',
        bucketGuess: 'building_documents',
        reason: 'Meeting minutes for the building',
        confidence: 0.9,
      },
    };
    const screening2022 = {
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      rotationApplied: false,
      suggestedFilename: PV_2022_NAME,
      description: 'Procès-verbal réunion novembre 2022',
      confidence: 0.93,
      fallbackReason: null,
      periodHint: '2022-11',
      quickAnalysis: {
        typeGuess: 'minutes',
        bucketGuess: 'building_documents',
        reason: 'Meeting minutes for the building',
        confidence: 0.9,
      },
    };

    await db.insert(schema.bulkImportItems).values({
      id: ids.item2021,
      sessionId: ids.session,
      originalPath: PV_2021_NAME,
      originalName: PV_2021_NAME,
      stagedPath: stagedPath2021,
      contentHash: hash2021,
      mimeType: 'application/pdf',
      fileSize: PDF_BODY_2021.length,
      status: 'screened',
      screening: screening2021,
    });
    await db.insert(schema.bulkImportItems).values({
      id: ids.item2022,
      sessionId: ids.session,
      originalPath: PV_2022_NAME,
      originalName: PV_2022_NAME,
      stagedPath: stagedPath2022,
      contentHash: hash2022,
      mimeType: 'application/pdf',
      fileSize: PDF_BODY_2022.length,
      status: 'screened',
      screening: screening2022,
    });

    // Adversarial mock: if anything ever reaches Anthropic, it will
    // try to merge the two items. The short-circuit must keep this
    // payload from being consulted at all.
    createSpy = jest.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            decision: 'merge',
            mergeWithItemId: ids.item2022,
            reason: 'mock would have merged — short-circuit must prevent this',
            confidence: 0.95,
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

  beforeEach(() => {
    createSpy.mockClear();
  });

  it('per-item /sort returns decision=keep for both PVs and never calls Anthropic', async () => {
    const res2021 = await request(app)
      .post(`/api/admin/bulk-import/items/${ids.item2021}/sort`)
      .set('x-test-user-id', ids.admin)
      .send({});
    expect(res2021.status).toBe(200);
    expect(res2021.body?.id).toBe(ids.item2021);
    expect(res2021.body?.status).toBe('sorted');
    expect(res2021.body?.sortingDecision?.decision).toBe('keep');

    const res2022 = await request(app)
      .post(`/api/admin/bulk-import/items/${ids.item2022}/sort`)
      .set('x-test-user-id', ids.admin)
      .send({});
    expect(res2022.status).toBe(200);
    expect(res2022.body?.id).toBe(ids.item2022);
    expect(res2022.body?.status).toBe('sorted');
    expect(res2022.body?.sortingDecision?.decision).toBe('keep');

    // Short-circuit guarantee: the mock would have responded with
    // `decision: 'merge'`, so any call at all here would have made
    // at least one row come back as merge. Asserting zero calls is
    // the strongest end-to-end check that different-period siblings
    // never get auto-merged.
    expect(createSpy).not.toHaveBeenCalled();

    // And the persisted rows match the HTTP response.
    const rows = await db
      .select()
      .from(schema.bulkImportItems)
      .where(inArray(schema.bulkImportItems.id, [ids.item2021, ids.item2022]));
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.status).toBe('sorted');
      expect(row.sortingDecision?.decision).toBe('keep');
      // No mergeWithItemId pointing at the sibling.
      expect(row.sortingDecision?.mergeWithItemId).toBeFalsy();
    }
  }, 30_000);
});
