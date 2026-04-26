// @ts-nocheck — Pre-existing pattern shared with the staging-janitor test
// (see tests/unit/api/bulk-import-staging-janitor.test.ts).
/**
 * @jest-environment node
 *
 * Task #1088 — operators need a signal *before* the bulk-import staging
 * volume fills up, not after a mid-stream upload error. The janitor now
 * piggy-backs a `statfs` probe on every pass and:
 *
 *   1. Returns a typed snapshot (`{ root, freeBytes, totalBytes,
 *      freeRatio, isLow }`) the caller can log, surface in a health
 *      endpoint, or feed into a metric.
 *   2. Flags `isLow` when EITHER threshold is breached:
 *        - free bytes  < `STAGING_LOW_FREE_BYTES`  (default 1 GiB), OR
 *        - free ratio  < `STAGING_LOW_FREE_RATIO`  (default 10 %).
 *      Either-of guards both small disks (10 % is still lots of room)
 *      and large disks (1 GB free is dangerously little).
 *   3. Honours `BULK_IMPORT_STAGING_ROOT` so an alert based on the
 *      reported `root` reflects whichever volume ops actually
 *      configured.
 *   4. Falls back to the nearest existing ancestor when the staging
 *      root has not been created yet — `statfs` describes the
 *      *volume*, so the parent answer is correct on a brand-new
 *      install where no upload has run.
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import * as nodeFs from 'fs';
import * as nodeOs from 'os';
import * as nodePath from 'path';

// Per-test isolated staging root. We never touch the real
// `<cwd>/.staging/bulk-import` so a parallel test run cannot have its
// state damaged by this suite. The disk-usage probe reads the same
// `BULK_IMPORT_STAGING_ROOT` env var the production code does.
const TMP_ROOT = nodeFs.mkdtempSync(
  nodePath.join(nodeOs.tmpdir(), 'bulk-import-disk-usage-test-'),
);
const PREV_STAGING_ROOT_ENV = process.env.BULK_IMPORT_STAGING_ROOT;
process.env.BULK_IMPORT_STAGING_ROOT = TMP_ROOT;

jest.mock('../../../server/db', () => ({
  db: { select: () => ({}) },
}));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logDebug: jest.fn(),
}));

const {
  getStagingDiskUsage,
  STAGING_LOW_FREE_BYTES,
  STAGING_LOW_FREE_RATIO,
} = require('../../../server/api/bulk-import');

describe('Task #1088 — bulk-import staging disk-usage probe', () => {
  beforeEach(() => {
    process.env.BULK_IMPORT_STAGING_ROOT = TMP_ROOT;
  });

  afterAll(() => {
    try {
      nodeFs.rmSync(TMP_ROOT, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
    if (PREV_STAGING_ROOT_ENV === undefined) {
      delete process.env.BULK_IMPORT_STAGING_ROOT;
    } else {
      process.env.BULK_IMPORT_STAGING_ROOT = PREV_STAGING_ROOT_ENV;
    }
  });

  it('reports a real, non-degenerate snapshot for an existing staging root', async () => {
    const usage = await getStagingDiskUsage();
    expect(usage).not.toBeNull();
    expect(usage!.root).toBe(TMP_ROOT);
    // The temp directory lives on a real volume; both numbers should be
    // positive and the ratio should be a real fraction in [0, 1].
    expect(usage!.totalBytes).toBeGreaterThan(0);
    expect(usage!.freeBytes).toBeGreaterThanOrEqual(0);
    expect(usage!.freeBytes).toBeLessThanOrEqual(usage!.totalBytes);
    expect(usage!.freeRatio).toBeGreaterThanOrEqual(0);
    expect(usage!.freeRatio).toBeLessThanOrEqual(1);
    // `isLow` must be a boolean derived from the documented thresholds.
    const expectedLow =
      usage!.freeBytes < STAGING_LOW_FREE_BYTES ||
      usage!.freeRatio < STAGING_LOW_FREE_RATIO;
    expect(usage!.isLow).toBe(expectedLow);
  });

  it('still reports a snapshot when the staging root does not exist yet (brand-new install)', async () => {
    const missing = nodePath.join(TMP_ROOT, 'never-created-yet');
    process.env.BULK_IMPORT_STAGING_ROOT = missing;
    try {
      const usage = await getStagingDiskUsage();
      expect(usage).not.toBeNull();
      // The reported root is whatever is configured; the volume numbers
      // come from the nearest existing ancestor (TMP_ROOT here).
      expect(usage!.root).toBe(missing);
      expect(usage!.totalBytes).toBeGreaterThan(0);
    } finally {
      process.env.BULK_IMPORT_STAGING_ROOT = TMP_ROOT;
    }
  });

  it('exports sensible defaults so an alert on the warn line is meaningful', () => {
    // 1 GiB and 10 % are the documented operator-facing thresholds.
    // Pin them so a future drift here is a deliberate, reviewed change.
    expect(STAGING_LOW_FREE_BYTES).toBe(1024 * 1024 * 1024);
    expect(STAGING_LOW_FREE_RATIO).toBe(0.1);
  });
});
