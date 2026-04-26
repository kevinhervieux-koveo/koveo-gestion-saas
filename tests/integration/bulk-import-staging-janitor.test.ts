/**
 * @jest-environment node
 */
// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * Task #1066 — integration test for the bulk-import staging janitor.
 *
 * The unit suite (`tests/unit/api/bulk-import-staging-janitor.test.ts`)
 * pins down the per-pass contract with a thin db mock. This suite
 * runs the janitor against the real Postgres + the real on-disk
 * staging root, in the same `_INTEGRATION_DB_URL`-gated style as
 * `bulk-import-rest-endpoints.test.ts`. It proves the end-to-end
 * "leftover file from a deleted session gets swept" guarantee that
 * the task is asking for.
 *
 *   1. A session row is inserted, a staging dir + a couple of files
 *      are dropped on disk, then the row is deleted (simulating the
 *      "user deleted their session while files were in flight"
 *      crash mode). The janitor sweeps the now-orphaned dir wholesale.
 *
 *   2. A second session row is left in place but its staging dir
 *      contains a stale `.upload-tmp-*` file (simulating a process
 *      kill mid-upload). The janitor deletes only the stale temp,
 *      preserves the committed `<hash>_<originalName>` file, and
 *      does not touch the session dir itself.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import fs from 'fs';
import nodePath from 'path';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task1066-bulk-import-janitor';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('bulk-import staging janitor — Task #1066', () => {
  let db: any;
  let schema: any;
  let sweepStagingOrphans: typeof import('../../server/api/bulk-import').sweepStagingOrphans;
  // Keep this test pinned to the project's `.staging/bulk-import` so it
  // matches the default `getBulkImportStagingRoot()` (Task #1080) — and
  // explicitly clear `BULK_IMPORT_STAGING_ROOT` in beforeAll so an
  // operator-set value in CI cannot misroute the sweep.
  const stagingRoot = nodePath.join(process.cwd(), '.staging', 'bulk-import');
  const PREV_STAGING_ROOT_ENV = process.env.BULK_IMPORT_STAGING_ROOT;

  const ids = {
    org: crypto.randomUUID(),
    building: crypto.randomUUID(),
    admin: crypto.randomUUID(),
    liveSession: crypto.randomUUID(),
    orphanSession: crypto.randomUUID(),
  };

  const trackedSessions = new Set<string>();

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.SESSION_SECRET =
      process.env.SESSION_SECRET || 'test-session-secret-task1066';
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    // Task #1080 — make sure an operator-set staging root in the CI
    // env cannot misdirect this test's sweep. Pin to the default,
    // which equals the `stagingRoot` we write our fixtures into.
    delete process.env.BULK_IMPORT_STAGING_ROOT;

    db = require('../../server/db').db;
    schema = require('@shared/schema');
    sweepStagingOrphans = require('../../server/api/bulk-import')
      .sweepStagingOrphans;

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
      firstName: 'Janitor',
      lastName: 'Admin',
      role: 'admin',
      isActive: true,
    });
  }, 30_000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    if (trackedSessions.size > 0) {
      const { inArray } = require('drizzle-orm');
      await db
        .delete(schema.bulkImportSessions)
        .where(
          inArray(schema.bulkImportSessions.id, Array.from(trackedSessions)),
        );
    }
    for (const sid of [ids.liveSession, ids.orphanSession]) {
      const dir = nodePath.join(stagingRoot, sid);
      try {
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    }
    const { eq } = require('drizzle-orm');
    await db.delete(schema.users).where(eq(schema.users.id, ids.admin));
    await db
      .delete(schema.buildings)
      .where(eq(schema.buildings.id, ids.building));
    await db
      .delete(schema.organizations)
      .where(eq(schema.organizations.id, ids.org));
    if (PREV_STAGING_ROOT_ENV === undefined) {
      delete process.env.BULK_IMPORT_STAGING_ROOT;
    } else {
      process.env.BULK_IMPORT_STAGING_ROOT = PREV_STAGING_ROOT_ENV;
    }
  }, 30_000);

  it('removes whole orphan session dirs and stale tmp files in live dirs in a single pass', async () => {
    if (!fs.existsSync(stagingRoot)) {
      fs.mkdirSync(stagingRoot, { recursive: true });
    }

    // Live session: insert row, drop a committed staged file plus a
    // stale `.upload-tmp-*` file (simulating a process kill mid-upload
    // a couple hours ago).
    await db.insert(schema.bulkImportSessions).values({
      id: ids.liveSession,
      organizationId: ids.org,
      buildingId: ids.building,
      adminUserId: ids.admin,
      status: 'active',
    });
    trackedSessions.add(ids.liveSession);

    const liveDir = nodePath.join(stagingRoot, ids.liveSession);
    fs.mkdirSync(liveDir, { recursive: true });
    const liveStaged = nodePath.join(liveDir, 'deadbeef_invoice.pdf');
    fs.writeFileSync(liveStaged, 'committed-bytes');
    const liveTmpStale = nodePath.join(liveDir, '.upload-tmp-stale');
    fs.writeFileSync(liveTmpStale, 'stale-tmp');
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(liveTmpStale, twoHoursAgo, twoHoursAgo);

    // Orphan session: drop a dir on disk for an id whose row will
    // never exist (simulating "row deleted while files were in
    // flight"). Track it so afterAll cleanup can drop the dir if the
    // sweep somehow fails to.
    const orphanDir = nodePath.join(stagingRoot, ids.orphanSession);
    fs.mkdirSync(orphanDir, { recursive: true });
    fs.writeFileSync(
      nodePath.join(orphanDir, 'baadc0de_lease.pdf'),
      'orphan-bytes',
    );
    fs.writeFileSync(
      nodePath.join(orphanDir, '.upload-tmp-orphan'),
      'orphan-tmp',
    );

    const result = await sweepStagingOrphans({
      now: Date.now(),
      maxTmpAgeMs: 60 * 60 * 1000,
    });

    // Counters should at least reflect what this test created. Other
    // sessions on disk (from parallel suites or the dev server) only
    // bump the totals further — they cannot push our counts down.
    expect(result.removedSessionDirs).toBeGreaterThanOrEqual(1);
    expect(result.removedTmp).toBeGreaterThanOrEqual(1);

    // Orphan dir is gone.
    expect(fs.existsSync(orphanDir)).toBe(false);
    // Live dir survives.
    expect(fs.existsSync(liveDir)).toBe(true);
    // Committed file survives.
    expect(fs.existsSync(liveStaged)).toBe(true);
    // Stale temp file removed.
    expect(fs.existsSync(liveTmpStale)).toBe(false);
  }, 30_000);
});
