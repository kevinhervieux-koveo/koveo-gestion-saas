/**
 * @jest-environment node
 */
// @ts-nocheck — Same pre-existing pattern shared with the staging-disk-usage
// unit test (see tests/unit/api/bulk-import-staging-disk-usage.test.ts and
// TYPE_CHECK_DEBT.md, task #769).
/**
 * Task #1095 — pin the `/api/health` contract for the `bulkImportStaging`
 * field so the surface admins curl (and the admin "system status" card on
 * the Performance Dashboard) cannot silently drift.
 *
 * Task #1088 already exposes `getStagingDiskUsage()` and a recurring
 * INFO/WARN log line from the staging janitor. This test guarantees that
 * the same snapshot is mirrored on `/api/health` with the human-readable
 * `freePercent` shape promised in the task description:
 *
 *   bulkImportStaging: {
 *     root: string,         // configured staging root
 *     freeBytes: number,    // free bytes on the staging volume
 *     totalBytes: number,   // total bytes on the staging volume
 *     freePercent: number,  // freeBytes / totalBytes * 100, 1 decimal
 *     isLow: boolean,       // true when either Task #1088 threshold trips
 *   }
 *
 * The test wires the same `createApiHealthHandler()` factory the
 * production server uses (`server/index.ts`) onto a tiny isolated
 * Express app. That avoids booting the real server, but exercises the
 * exact handler whose contract we want to lock down — so a future
 * refactor that renames a field, drops one, or stops calling
 * `getStagingDiskUsage()` will fail this test loudly.
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import * as nodeFs from 'fs';
import * as nodeOs from 'os';
import * as nodePath from 'path';
import express from 'express';
import request from 'supertest';

// Per-test isolated staging root so a parallel test run cannot have its
// state damaged by this suite. The probe inside the handler honours
// `BULK_IMPORT_STAGING_ROOT`, so pointing it at this temp dir lets us
// assert that the `root` field round-trips faithfully.
const TMP_ROOT = nodeFs.mkdtempSync(
  nodePath.join(nodeOs.tmpdir(), 'api-health-staging-test-'),
);
const PREV_STAGING_ROOT_ENV = process.env.BULK_IMPORT_STAGING_ROOT;

// Mock the DB module so the handler's `crossOrgDemands` probe doesn't
// need a real Postgres. The handler swallows DB errors and omits the
// field — but mocking is cheaper than relying on that fallback path,
// and keeps the assertions deterministic.
jest.mock('../../server/db', () => ({
  db: {
    execute: async () => ({ rows: [{ cross_org_demands: 0 }] }),
  },
}));

const { createApiHealthHandler } = require('../../server/api/health-handler');

function buildApp() {
  const app = express();
  app.get(
    '/api/health',
    createApiHealthHandler({ port: 5000, host: '0.0.0.0' }),
  );
  return app;
}

describe('Task #1095 — /api/health surfaces bulk-import staging disk usage', () => {
  beforeEach(() => {
    process.env.BULK_IMPORT_STAGING_ROOT = TMP_ROOT;
  });

  afterAll(() => {
    try {
      nodeFs.rmSync(TMP_ROOT, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
    if (PREV_STAGING_ROOT_ENV === undefined) {
      delete process.env.BULK_IMPORT_STAGING_ROOT;
    } else {
      process.env.BULK_IMPORT_STAGING_ROOT = PREV_STAGING_ROOT_ENV;
    }
  });

  it('returns a bulkImportStaging object with the documented field shape', async () => {
    const res = await request(buildApp()).get('/api/health');
    expect(res.status).toBe(200);

    expect(res.body).toHaveProperty('bulkImportStaging');
    const staging = res.body.bulkImportStaging;
    expect(staging).not.toBeNull();
    expect(typeof staging).toBe('object');

    // Exact key set — the contract is pinned so a downstream
    // dashboard / `jq` query cannot silently break.
    expect(Object.keys(staging).sort()).toEqual(
      ['freeBytes', 'freePercent', 'isLow', 'root', 'totalBytes'].sort(),
    );

    // The reported root must match whichever volume the operator
    // pointed `BULK_IMPORT_STAGING_ROOT` at — otherwise an alert on
    // this field would name the wrong disk.
    expect(staging.root).toBe(TMP_ROOT);

    expect(typeof staging.freeBytes).toBe('number');
    expect(typeof staging.totalBytes).toBe('number');
    expect(typeof staging.freePercent).toBe('number');
    expect(typeof staging.isLow).toBe('boolean');

    expect(staging.totalBytes).toBeGreaterThan(0);
    expect(staging.freeBytes).toBeGreaterThanOrEqual(0);
    expect(staging.freeBytes).toBeLessThanOrEqual(staging.totalBytes);
    expect(staging.freePercent).toBeGreaterThanOrEqual(0);
    expect(staging.freePercent).toBeLessThanOrEqual(100);
  });

  it('still reports a snapshot when the staging root has not been created yet', async () => {
    const missing = nodePath.join(TMP_ROOT, 'never-created-yet');
    process.env.BULK_IMPORT_STAGING_ROOT = missing;
    try {
      const res = await request(buildApp()).get('/api/health');
      expect(res.status).toBe(200);
      // Brand-new install case: the configured root does not exist on
      // disk yet, but `getStagingDiskUsage()` walks up to the nearest
      // existing ancestor, so the field must still be present and
      // describe a real volume.
      expect(res.body.bulkImportStaging).not.toBeUndefined();
      expect(res.body.bulkImportStaging.root).toBe(missing);
      expect(res.body.bulkImportStaging.totalBytes).toBeGreaterThan(0);
    } finally {
      process.env.BULK_IMPORT_STAGING_ROOT = TMP_ROOT;
    }
  });

  it('keeps the static-shape fields the handler has always returned', async () => {
    // Belt-and-braces: make sure adding the new `bulkImportStaging`
    // field did not silently drop any of the previously-documented
    // top-level fields. A regression here would break log-scrapers
    // and dashboards that already pull `status`/`uptime`/`environment`.
    const res = await request(buildApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(typeof res.body.timestamp).toBe('string');
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.environment).toBe('string');
    expect(res.body.port).toBe(5000);
    expect(res.body.host).toBe('0.0.0.0');
  });
});
