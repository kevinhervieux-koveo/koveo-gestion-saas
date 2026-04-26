// @ts-nocheck — Pre-existing pattern shared with the staging-janitor /
// staging-disk-usage tests in this directory.
/**
 * @jest-environment node
 *
 * Task #1096 — `bulk-import-staging-disk-usage.test.ts` (Task #1088)
 * verifies the *probe* shape and pins the thresholds, but it never
 * exercises the janitor wiring that turns an `isLow=true` snapshot
 * into the actual WARN log line ops have set their alert rules on.
 * If a future refactor moves the disk-usage report or downgrades
 * its level to INFO, the alert silently breaks and nobody notices.
 *
 * This suite closes that gap by driving `runStagingJanitorOnce()`
 * end-to-end with a stubbed `fs.promises.statfs` so we can choose a
 * `{ isLow: true }` or `{ isLow: false }` snapshot deterministically:
 *
 *   1. Low-disk path: `logWarn` is called and the message contains
 *      the literal phrase `"staging disk free space is LOW"` — the
 *      same phrase `docs/deployment/bulk-import-staging.md` tells
 *      operators to grep for. `logInfo` is NOT called for a disk
 *      usage line in this case.
 *   2. Healthy path: `logInfo` is called with `"staging disk usage"`
 *      and `logWarn` is NOT called.
 *
 * The orphan sweep that runs in the same pass is neutralised by
 * pointing `BULK_IMPORT_STAGING_ROOT` at a temp directory whose
 * staging tree has no session subdirectories — `sweepStagingOrphans`
 * then returns zero counters and never logs.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  jest,
} from '@jest/globals';
import * as nodeFs from 'fs';
import * as nodeOs from 'os';
import * as nodePath from 'path';

// Per-test isolated staging root inside the OS temp dir, mirroring
// the sibling staging suites. The dir exists but is empty, so the
// orphan sweep is a no-op and the only log lines under test come
// from the disk-usage branch of `runStagingJanitorOnce`.
const TMP_ROOT = nodeFs.mkdtempSync(
  nodePath.join(nodeOs.tmpdir(), 'bulk-import-disk-low-alert-test-'),
);
const PREV_STAGING_ROOT_ENV = process.env.BULK_IMPORT_STAGING_ROOT;
process.env.BULK_IMPORT_STAGING_ROOT = TMP_ROOT;

// Minimal db mock — `sweepStagingOrphans` returns early before
// calling `db.select` because the staging dir is empty, but the
// real `server/db` module pulls in a Postgres driver we do not want
// to load in a unit test.
jest.mock('../../../server/db', () => ({
  db: { select: () => ({}) },
}));

// Capture the logger calls so we can assert the WARN line fires (or
// does not) on the right code path.
jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logDebug: jest.fn(),
}));

// Import AFTER the mocks above so the module under test picks them up.
const { runStagingJanitorOnce } = require('../../../server/api/bulk-import');
const logger = require('../../../server/utils/logger');

// The literal phrase the runbook tells operators to grep for. Pinning
// it here means a future refactor that paraphrases the warn message
// fails this test instead of silently breaking the alert rule.
const ALERT_PHRASE = 'staging disk free space is LOW';

describe('Task #1096 — runStagingJanitorOnce emits the staging disk-low alert', () => {
  let statfsSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.BULK_IMPORT_STAGING_ROOT = TMP_ROOT;
    (logger.logWarn as jest.Mock).mockClear();
    (logger.logInfo as jest.Mock).mockClear();
    (logger.logError as jest.Mock).mockClear();
  });

  afterEach(() => {
    if (statfsSpy) statfsSpy.mockRestore();
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

  it('calls logWarn with the canonical alert phrase when the probe reports isLow=true', async () => {
    // Stub statfs so `getStagingDiskUsage` reports a tiny amount of
    // free space on a 100 GiB volume — well below BOTH the 1 GiB
    // absolute threshold and the 10 % ratio threshold, so `isLow`
    // is unambiguously true.
    const bsize = 4096;
    const totalBlocks = (100 * 1024 * 1024 * 1024) / bsize; // 100 GiB
    const freeBlocks = (10 * 1024 * 1024) / bsize; // 10 MiB free
    statfsSpy = jest
      .spyOn(nodeFs.promises, 'statfs')
      .mockResolvedValue({
        bsize,
        bavail: freeBlocks,
        blocks: totalBlocks,
      } as any);

    await runStagingJanitorOnce();

    expect(logger.logWarn).toHaveBeenCalledTimes(1);
    const [warnMsg, warnCtx] = (logger.logWarn as jest.Mock).mock.calls[0];
    expect(typeof warnMsg).toBe('string');
    expect(warnMsg).toContain(ALERT_PHRASE);
    // The metadata payload is what dashboards graph; confirm the
    // janitor still attaches the resolved root and free-space numbers
    // alongside the alert phrase.
    expect(warnCtx?.metadata?.stagingRoot).toBe(TMP_ROOT);
    expect(typeof warnCtx?.metadata?.freeBytes).toBe('number');
    expect(typeof warnCtx?.metadata?.totalBytes).toBe('number');

    // The healthy `staging disk usage` info line MUST NOT also fire on
    // the same pass — the two branches are mutually exclusive and an
    // alert rule that matches "LOW" should not be paired with a
    // contradicting "usage" line at INFO.
    const infoMessages = (logger.logInfo as jest.Mock).mock.calls.map(
      (c) => c[0],
    );
    expect(
      infoMessages.some((m: string) => m && m.includes('staging disk usage')),
    ).toBe(false);
  });

  it('calls logInfo with "staging disk usage" and does NOT call logWarn on the healthy path', async () => {
    // Stub statfs so the probe reports plenty of free space on a
    // 100 GiB volume — 80 GiB free is comfortably above both the
    // 1 GiB absolute floor and the 10 % ratio floor, so `isLow` is
    // unambiguously false.
    const bsize = 4096;
    const totalBlocks = (100 * 1024 * 1024 * 1024) / bsize; // 100 GiB
    const freeBlocks = (80 * 1024 * 1024 * 1024) / bsize; // 80 GiB free
    statfsSpy = jest
      .spyOn(nodeFs.promises, 'statfs')
      .mockResolvedValue({
        bsize,
        bavail: freeBlocks,
        blocks: totalBlocks,
      } as any);

    await runStagingJanitorOnce();

    // No WARN line at all on the healthy path — alert rules must stay
    // silent when the volume is healthy. We assert "not called at all"
    // (rather than just "no message containing the alert phrase") so a
    // future code change that quietly adds a different WARN to the
    // janitor's healthy branch is still caught here.
    expect(logger.logWarn).not.toHaveBeenCalled();

    // The recurring INFO gauge fires instead.
    const infoCall = (logger.logInfo as jest.Mock).mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('staging disk usage'),
    );
    expect(infoCall).toBeDefined();
    expect(infoCall![1]?.metadata?.stagingRoot).toBe(TMP_ROOT);
    expect(infoCall![1]?.metadata?.freeBytes).toBeGreaterThan(0);
    expect(infoCall![1]?.metadata?.totalBytes).toBeGreaterThan(0);
  });
});
