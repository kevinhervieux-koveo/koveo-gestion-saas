/**
 * @jest-environment node
 *
 * Task #1063 — `screeningParsedPeriodHintDate` on the bulk-import lite
 * endpoint must honour the building's fiscal-year-start month.
 *
 * Background:
 *   - Task #1060 added `screeningParsedPeriodHintDate` to the lite
 *     payload so the Sorting Period picker can prefill from the
 *     server-parsed periodHint.
 *   - The shared parser (`server/services/period-hint-parser.ts`)
 *     already accepts an optional `fiscalYearStartMonth` and the
 *     commit-time path passes it (`server/api/bulk-import.ts:781,
 *     :4165`). The lite endpoint, however, used to call
 *     `parsePeriodHint(rawPh)` without it, so a fiscal-year hint like
 *     `"2025-2026"` always resolved to January 1 — even on an
 *     April-start building. That mismatch broke the "Done looks like"
 *     promise of Task #1060.
 *
 * This suite locks down the wiring at the lite endpoint:
 *   1. For an April-start building, periodHint `"2025-2026"` resolves
 *      to `2025-04-01` in the lite payload (matches commit time).
 *   2. For a building with no fiscal-year-start month set, the same
 *      hint still resolves to `2025-01-01` (parser fallback). NB: the
 *      buildings table defaults `financialYearStart` to `'2026-01-01'`
 *      so an unset value still surfaces as month=1, which is exactly
 *      the parser's fallback.
 *   3. ISO dates / ISO months are unaffected by the fiscal-year wiring
 *      so the lite endpoint must still surface them verbatim — added
 *      as a guard so a future "always pass fiscal year" change can't
 *      silently break non-fiscal-year hints.
 *
 * Same real-Postgres pattern as the other bulk-import integration
 * tests: gated on `_INTEGRATION_DB_URL`, skips cleanly when no DB is
 * available so this suite never blocks lanes that lack a Postgres
 * fixture.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';

// Re-route the auto-mocked server modules back to their real
// implementations. Same shim pattern as the other integration files —
// the repo-wide jest config aliases these to `__mocks__/`, and
// integration tests need the real Express app + DB wiring.
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
const TEST_TAG = 'task1063-lite-fy-period-hint';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

const PDF_BODY = Buffer.from('%PDF-1.4\n%%EOF', 'utf8');

describeIfDb('Lite endpoint surfaces fiscal-year-aware periodHint — Task #1063', () => {
  let app: express.Application;
  let db: any;
  let schema: any;

  const ids = {
    org: crypto.randomUUID(),
    aprilBuilding: crypto.randomUUID(),
    janBuilding: crypto.randomUUID(),
    admin: crypto.randomUUID(),
  };

  const trackedSessions = new Set<string>();
  const trackedItems = new Set<string>();
  const stagingRoot = nodePath.join(process.cwd(), '.staging', 'bulk-import');

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || 'test-session-secret-task1063';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';

    db = require('../../server/db').db;
    schema = require('@shared/schema');
    const { registerBulkImportRoutes, __resetFiscalYearStartMonthCacheForTests } =
      require('../../server/api/bulk-import');
    // Make sure earlier suites haven't poisoned the per-process cache
    // with a fiscal-year value for ids we are about to insert.
    __resetFiscalYearStartMonthCacheForTests();

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
    // April-start building — fiscal year hints like "2025-2026" must
    // resolve to April 1 of the starting year.
    await db.insert(schema.buildings).values({
      id: ids.aprilBuilding,
      organizationId: ids.org,
      name: `${TEST_TAG} April bldg`,
      address: '1 April',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 1,
      isActive: true,
      financialYearStart: '2024-04-01',
    });
    // January-start building — fiscal year hints fall back to Jan 1.
    // The buildings table defaults `financialYearStart` to a January
    // date, so an explicit `'2024-01-01'` here mirrors the "no
    // fiscal-year-start configured" case from the admin's POV.
    await db.insert(schema.buildings).values({
      id: ids.janBuilding,
      organizationId: ids.org,
      name: `${TEST_TAG} Jan bldg`,
      address: '1 Jan',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A1A1',
      buildingType: 'condo',
      totalUnits: 1,
      isActive: true,
      financialYearStart: '2024-01-01',
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
    await db
      .delete(schema.buildings)
      .where(inArray(schema.buildings.id, [ids.aprilBuilding, ids.janBuilding]));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, ids.org));
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
    // The cache is keyed by buildingId, not session, so it survives
    // across tests within the suite. Resetting per-test guarantees the
    // April test cannot leak into the January test (or vice versa) if
    // a future change introduces a shared id.
    const { __resetFiscalYearStartMonthCacheForTests } =
      require('../../server/api/bulk-import');
    __resetFiscalYearStartMonthCacheForTests();
  });

  async function createSession(buildingId: string): Promise<string> {
    const res = await request(app)
      .post('/api/admin/bulk-import/sessions')
      .set('x-test-user-id', ids.admin)
      .send({ buildingId });
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
    res.body.forEach((row: any) => trackedItems.add(row.id));
    return res.body[0];
  }

  /** Persist a screening blob with the given periodHint directly so
   *  these tests don't depend on the AI screening pipeline. */
  async function setScreeningHint(itemId: string, periodHint: string) {
    await db
      .update(schema.bulkImportItems)
      .set({
        status: 'screened',
        screening: {
          isComplete: true,
          isMultiDocument: false,
          confidence: 0.8,
          description: 'period-hint fixture',
          periodHint,
        },
      })
      .where(eq(schema.bulkImportItems.id, itemId));
  }

  async function getLiteItem(sid: string, itemId: string): Promise<any> {
    const lite = await request(app)
      .get(`/api/admin/bulk-import/sessions/${sid}/lite`)
      .set('x-test-user-id', ids.admin);
    expect(lite.status).toBe(200);
    const liteItem = (lite.body.items as any[]).find((it) => it.id === itemId);
    expect(liteItem).toBeDefined();
    return liteItem;
  }

  it('resolves "2025-2026" to 2025-04-01 for an April-start building', async () => {
    const sid = await createSession(ids.aprilBuilding);
    const item = await uploadOnePdf(sid, 'fy-april.pdf');
    await setScreeningHint(item.id, '2025-2026');

    const liteItem = await getLiteItem(sid, item.id);
    expect(liteItem.screeningPeriodHint).toBe('2025-2026');
    expect(liteItem.screeningParsedPeriodHintDate).toBe('2025-04-01');
  });

  it('falls back to 2025-01-01 for a January-start (default) building', async () => {
    const sid = await createSession(ids.janBuilding);
    const item = await uploadOnePdf(sid, 'fy-jan.pdf');
    await setScreeningHint(item.id, '2025-2026');

    const liteItem = await getLiteItem(sid, item.id);
    expect(liteItem.screeningPeriodHint).toBe('2025-2026');
    expect(liteItem.screeningParsedPeriodHintDate).toBe('2025-01-01');
  });

  it('passes ISO date hints through unchanged regardless of fiscal year', async () => {
    // Guard: fiscal-year wiring must NOT shift non-fiscal-year hints.
    // Without this case, a future "always rebase to fiscal year" bug
    // could silently move ISO dates from October to April.
    const sid = await createSession(ids.aprilBuilding);
    const item = await uploadOnePdf(sid, 'iso-date.pdf');
    await setScreeningHint(item.id, '2025-10-15');

    const liteItem = await getLiteItem(sid, item.id);
    expect(liteItem.screeningParsedPeriodHintDate).toBe('2025-10-15');
  });
});
