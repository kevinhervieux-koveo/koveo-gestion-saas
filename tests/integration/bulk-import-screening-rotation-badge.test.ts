/**
 * @jest-environment node
 *
 * Task #785 — Server-side coverage for the Screening "Rotated Xdeg"
 * badge contract introduced by Task #772.
 *
 * Two contracts are locked down here so a future refactor of the
 * screening pipeline (or the lite polling endpoint) cannot silently
 * regress the rotation visibility that admins depend on:
 *
 *   1. `processItemForStep('screening', ...)` must persist
 *      `rotationApplied: true` on the screening JSONB when the
 *      `rotateAndRewriteStagedFile` helper returns a new content hash,
 *      and `rotationApplied: false` when it returns null (the failed /
 *      unsupported-MIME path that leaves the staged file untouched).
 *
 *   2. `GET /api/admin/bulk-import/sessions/:id/lite` must surface
 *      both `screeningRotationDegrees` and `screeningRotationApplied`
 *      from the stored screening blob, and default both to 0/false for
 *      legacy items that pre-date Task #772 and have no rotation
 *      fields persisted.
 *
 * `processItemForStep` is not exported from `server/api/bulk-import.ts`,
 * so it is exercised through the per-item retry endpoint
 * (`POST /api/admin/bulk-import/items/:id/screen`) which is a thin
 * wrapper around the same helper — exactly the contract Task #772
 * relies on for the per-row "Retry" button.
 *
 * Same real-Postgres pattern as `bulk-import-rest-endpoints.test.ts`:
 * gated on `_INTEGRATION_DB_URL`, skips cleanly when no DB is
 * available so this suite never blocks lanes that lack a Postgres
 * fixture.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';

// Re-route the auto-mocked server modules back to their real
// implementations. The repo-wide jest config aliases `server/storage`,
// `server/auth`, and `server/routes` to their `__mocks__` shims; these
// `jest.mock()` calls are the canonical way to "un-mock" them inside
// integration tests that boot the real Express app.
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

// Replace the rotation helper with a jest mock so each test can
// deterministically simulate "rotation succeeded → new hash" and
// "rotation skipped → null" without depending on real PDF/image
// transformation libraries (`pdf-lib`, `sharp`). The helper itself is
// unit-tested elsewhere; here we are only proving how the bulk-import
// route stores its result.
const mockRotate = jest.fn<
  Promise<string | null>,
  [
    {
      stagedPath: string;
      mimeType: string | null | undefined;
      rotationDegrees: 0 | 90 | 180 | 270;
    },
  ]
>();
jest.mock('../../server/services/bulk-import-rotation', () => ({
  rotateAndRewriteStagedFile: (...args: unknown[]) =>
    (mockRotate as unknown as (...a: unknown[]) => Promise<string | null>)(...args),
}));

import express from 'express';
import session from 'express-session';
import request from 'supertest';
import crypto from 'crypto';
import fs from 'fs';
import nodePath from 'path';
import { eq, inArray } from 'drizzle-orm';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task785-rotation-badge';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

const PDF_BODY = Buffer.from('%PDF-1.4\n%%EOF', 'utf8');

describeIfDb('Screening rotation badge — Task #785', () => {
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

  const ids = {
    org: crypto.randomUUID(),
    building: crypto.randomUUID(),
    admin: crypto.randomUUID(),
  };

  const trackedSessions = new Set<string>();
  const trackedItems = new Set<string>();
  // Task #1086 — pin this suite to the project's `.staging/bulk-import`
  // so it matches the default `getBulkImportStagingRoot()` (Task #1080).
  // We explicitly clear `BULK_IMPORT_STAGING_ROOT` in beforeAll so an
  // operator-set value in CI cannot misroute the per-session cleanup.
  const stagingRoot = nodePath.join(process.cwd(), '.staging', 'bulk-import');
  const PREV_STAGING_ROOT_ENV = process.env.BULK_IMPORT_STAGING_ROOT;

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || 'test-session-secret-task785';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    // Task #1086 — match the default staging root we point fixtures at.
    delete process.env.BULK_IMPORT_STAGING_ROOT;
    // Force the analyzer down the real-client path so our fake
    // Anthropic transport is actually invoked, instead of the no-API-
    // key stub which always returns rotationDegrees: 0.
    process.env.ANTHROPIC_API_KEY =
      process.env.ANTHROPIC_API_KEY || 'test-fake-key-task785';

    db = require('../../server/db').db;
    schema = require('@shared/schema');
    const bulkImportApi = require('../../server/api/bulk-import');
    const { registerBulkImportRoutes } = bulkImportApi;
    inFlightPerItemRetry = bulkImportApi.inFlightPerItemRetry;
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
      .delete(schema.userOrganizations)
      .where(eq(schema.userOrganizations.userId, ids.admin));
    await db.delete(schema.users).where(eq(schema.users.id, ids.admin));
    await db.delete(schema.buildings).where(eq(schema.buildings.id, ids.building));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, ids.org));
    bulkImportAnalyzer.__setClientForTests(null);
    restoreStagingRootEnv();
  }, 30_000);

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
    mockRotate.mockReset();
    bulkImportAnalyzer.__setClientForTests(null);
  });

  /** Stub the Anthropic client to make `screen()` return a fixed payload. */
  function fakeAnalyzer(payload: Record<string, unknown>) {
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(payload) }],
    });
    bulkImportAnalyzer.__setClientForTests({
      messages: { create },
    } as unknown as Parameters<typeof bulkImportAnalyzer.__setClientForTests>[0]);
    return create;
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

  async function uploadOnePdf(sid: string, filename: string): Promise<any> {
    const res = await request(app)
      .post(`/api/admin/bulk-import/sessions/${sid}/items`)
      .set('x-test-user-id', ids.admin)
      .attach('files', Buffer.concat([PDF_BODY, Buffer.from(filename)]), {
        filename,
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(201);
    res.body.items.forEach((row: any) => trackedItems.add(row.id));
    return res.body.items[0];
  }

  // ---------------------------------------------------------------------------
  // 1. processItemForStep('screening', ...) → screening.rotationApplied
  // ---------------------------------------------------------------------------

  describe('processItemForStep persists screening.rotationApplied', () => {
    it('records rotationApplied: true when the rotation helper returns a new content hash', async () => {
      const sid = await createSession();
      const item = await uploadOnePdf(sid, 'rotated.pdf');
      const newHash = crypto.createHash('sha256').update('rotated-bytes').digest('hex');

      fakeAnalyzer({
        isComplete: true,
        isMultiDocument: false,
        pageOrderHint: null,
        rotationDegrees: 90,
        suggestedFilename: 'rotated.pdf',
        description: 'Sideways scan',
        confidence: 0.82,
      });
      mockRotate.mockResolvedValue(newHash);

      const screen = await request(app)
        .post(`/api/admin/bulk-import/items/${item.id}/screen`)
        .set('x-test-user-id', ids.admin);
      expect(screen.status).toBe(200);

      // Task #1047: per-item retry is fire-and-forget — the HTTP body
      // is the pre-AI snapshot. Wait for the background work to settle
      // before reading the persisted row.
      await waitForRetryToSettle(item.id, 'screening');

      // Sanity: the helper was invoked with the analyzer-supplied
      // rotation. If this breaks, processItemForStep stopped funneling
      // the AI value into the helper and the badge would never light up.
      expect(mockRotate).toHaveBeenCalledTimes(1);
      expect(mockRotate.mock.calls[0][0]).toMatchObject({
        rotationDegrees: 90,
        mimeType: 'application/pdf',
      });

      // Round-trip the row from Postgres so we know the JSONB column
      // really persisted the flag.
      const [row] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, item.id));
      expect(row.status).toBe('screened');
      expect((row.screening as any).rotationApplied).toBe(true);
      expect((row.screening as any).rotationDegrees).toBe(90);
      expect(row.contentHash).toBe(newHash);
    });

    it('records rotationApplied: false when the rotation helper returns null (failed / unsupported MIME)', async () => {
      const sid = await createSession();
      const item = await uploadOnePdf(sid, 'unsupported.pdf');
      const originalHash = item.contentHash as string;

      fakeAnalyzer({
        isComplete: true,
        isMultiDocument: false,
        pageOrderHint: null,
        rotationDegrees: 270,
        suggestedFilename: 'unsupported.pdf',
        description: 'Sideways but unsupported',
        confidence: 0.55,
      });
      // null → rotation skipped (helper logged "unsupported MIME" or
      // "rotation library threw"). Per the Task #772 contract the
      // staged file must stay untouched and the badge must NOT light up.
      mockRotate.mockResolvedValue(null);

      const screen = await request(app)
        .post(`/api/admin/bulk-import/items/${item.id}/screen`)
        .set('x-test-user-id', ids.admin);
      expect(screen.status).toBe(200);

      // Task #1047: response is the pre-AI snapshot; wait for the
      // background AI call to settle, then assert on the persisted row.
      await waitForRetryToSettle(item.id, 'screening');

      const [row] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, item.id));
      expect(row.status).toBe('screened');
      expect((row.screening as any).rotationApplied).toBe(false);
      // Even when the rewrite was skipped, the AI-suggested degrees
      // are still surfaced so admins know "AI thought it was sideways
      // but we couldn't rotate it" rather than "AI saw nothing wrong".
      expect((row.screening as any).rotationDegrees).toBe(270);
      // The original hash must be retained because the bytes weren't
      // rewritten — analyzer cache keys downstream still apply.
      expect(row.contentHash).toBe(originalHash);
    });

    it('records rotationApplied: false and skips the helper entirely when the AI returns rotationDegrees: 0', async () => {
      // Guard the second branch of the if-block: when the AI says the
      // file is upright the route must NOT call the rotation helper at
      // all, and the persisted flag must still default to false. Without
      // this case, a regression that always set rotationApplied: true
      // would slip past the previous two tests.
      const sid = await createSession();
      const item = await uploadOnePdf(sid, 'upright.pdf');

      fakeAnalyzer({
        isComplete: true,
        isMultiDocument: false,
        pageOrderHint: null,
        rotationDegrees: 0,
        suggestedFilename: 'upright.pdf',
        description: 'Already upright',
        confidence: 0.9,
      });

      const screen = await request(app)
        .post(`/api/admin/bulk-import/items/${item.id}/screen`)
        .set('x-test-user-id', ids.admin);
      expect(screen.status).toBe(200);

      // Task #1047: response is the pre-AI snapshot; wait for the
      // background AI call to settle.
      await waitForRetryToSettle(item.id, 'screening');

      const [row] = await db
        .select()
        .from(schema.bulkImportItems)
        .where(eq(schema.bulkImportItems.id, item.id));
      expect(row.status).toBe('screened');
      expect((row.screening as any).rotationApplied).toBe(false);
      expect((row.screening as any).rotationDegrees).toBe(0);
      expect(mockRotate).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. /lite endpoint surfaces rotation fields with safe defaults
  // ---------------------------------------------------------------------------

  describe('GET /api/admin/bulk-import/sessions/:id/lite — rotation fields', () => {
    it('surfaces screeningRotationDegrees and screeningRotationApplied from the screening blob', async () => {
      const sid = await createSession();
      const item = await uploadOnePdf(sid, 'lite-rotated.pdf');

      // Write the screening blob directly so this test does not depend
      // on the AI / rotation pipeline at all — it locks down the
      // extraction logic in `extractScreeningRotation` in isolation.
      await db
        .update(schema.bulkImportItems)
        .set({
          status: 'screened',
          screening: {
            isComplete: true,
            isMultiDocument: false,
            pageOrderHint: null,
            rotationDegrees: 90,
            rotationApplied: true,
            suggestedFilename: 'lite-rotated.pdf',
            description: 'Rotated 90deg',
            confidence: 0.8,
          },
        })
        .where(eq(schema.bulkImportItems.id, item.id));

      const lite = await request(app)
        .get(`/api/admin/bulk-import/sessions/${sid}/lite`)
        .set('x-test-user-id', ids.admin);
      expect(lite.status).toBe(200);
      const liteItem = (lite.body.items as any[]).find((it) => it.id === item.id);
      expect(liteItem).toBeDefined();
      expect(liteItem.screeningRotationDegrees).toBe(90);
      expect(liteItem.screeningRotationApplied).toBe(true);
    });

    it('still surfaces the degrees but reports rotationApplied: false when the rewrite was skipped', async () => {
      const sid = await createSession();
      const item = await uploadOnePdf(sid, 'lite-skipped.pdf');

      await db
        .update(schema.bulkImportItems)
        .set({
          status: 'screened',
          screening: {
            rotationDegrees: 180,
            rotationApplied: false,
            confidence: 0.4,
          },
        })
        .where(eq(schema.bulkImportItems.id, item.id));

      const lite = await request(app)
        .get(`/api/admin/bulk-import/sessions/${sid}/lite`)
        .set('x-test-user-id', ids.admin);
      expect(lite.status).toBe(200);
      const liteItem = (lite.body.items as any[]).find((it) => it.id === item.id);
      expect(liteItem.screeningRotationDegrees).toBe(180);
      expect(liteItem.screeningRotationApplied).toBe(false);
    });

    it('defaults to 0 / false for legacy items whose screening blob predates the rotation fields', async () => {
      const sid = await createSession();
      const legacy = await uploadOnePdf(sid, 'legacy.pdf');
      const noScreen = await uploadOnePdf(sid, 'no-screening.pdf');

      // Legacy item: a screening blob that pre-dates Task #772 — it has
      // a confidence and description but neither `rotationDegrees`
      // nor `rotationApplied`. Both fields must default cleanly.
      await db
        .update(schema.bulkImportItems)
        .set({
          status: 'screened',
          screening: {
            isComplete: true,
            isMultiDocument: false,
            confidence: 0.6,
            description: 'Pre-rotation-feature item',
          },
        })
        .where(eq(schema.bulkImportItems.id, legacy.id));

      // Item that has not been screened yet — `screening` column is
      // still null. The lite endpoint must not crash and both fields
      // must surface as 0 / false rather than undefined.
      // (no DB update; uploadOnePdf leaves screening = null)

      const lite = await request(app)
        .get(`/api/admin/bulk-import/sessions/${sid}/lite`)
        .set('x-test-user-id', ids.admin);
      expect(lite.status).toBe(200);

      const legacyLite = (lite.body.items as any[]).find((it) => it.id === legacy.id);
      expect(legacyLite).toBeDefined();
      expect(legacyLite.screeningRotationDegrees).toBe(0);
      expect(legacyLite.screeningRotationApplied).toBe(false);

      const noScreenLite = (lite.body.items as any[]).find((it) => it.id === noScreen.id);
      expect(noScreenLite).toBeDefined();
      expect(noScreenLite.screeningRotationDegrees).toBe(0);
      expect(noScreenLite.screeningRotationApplied).toBe(false);
    });

    it('coerces a non-90/180/270 rotationDegrees value to 0 even when rotationApplied is true', async () => {
      // Defensive case: if a future bug writes an invalid degrees value
      // (e.g. 45) the lite endpoint must clamp it to 0 so the badge —
      // which gates on `screeningRotationDegrees !== 0` — never renders
      // a nonsensical "Rotated 45°" pill.
      const sid = await createSession();
      const item = await uploadOnePdf(sid, 'lite-bad-degrees.pdf');

      await db
        .update(schema.bulkImportItems)
        .set({
          status: 'screened',
          screening: {
            rotationDegrees: 45,
            rotationApplied: true,
            confidence: 0.5,
          },
        })
        .where(eq(schema.bulkImportItems.id, item.id));

      const lite = await request(app)
        .get(`/api/admin/bulk-import/sessions/${sid}/lite`)
        .set('x-test-user-id', ids.admin);
      expect(lite.status).toBe(200);
      const liteItem = (lite.body.items as any[]).find((it) => it.id === item.id);
      expect(liteItem.screeningRotationDegrees).toBe(0);
      expect(liteItem.screeningRotationApplied).toBe(true);
    });
  });
});
