// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * @jest-environment node
 *
 * Task #1066 — the bulk-import upload route streams files into a
 * per-session staging directory under
 * `process.cwd()/.staging/bulk-import/<sessionId>/`. The handler cleans
 * up after multer errors, missing-session 404s, and per-file insert
 * failures, but it cannot clean up after harder failures: the Node
 * process being killed mid-upload, the session row being deleted while
 * files were still in flight, etc. Without a periodic sweep those
 * orphan files accumulate forever and recreate the same disk-pressure
 * outage class Task #1061 fixed for memory pressure.
 *
 * `sweepStagingOrphans()` is the per-pass workhorse the janitor wires
 * into a startup hook + recurring interval. This test pins down its
 * contract directly, against the real filesystem inside an isolated
 * temp directory (so a parallel test run cannot have its real staging
 * files swept by this test), with a thin db mock that only answers
 * the live-session lookup:
 *
 *   1. A whole session directory whose id is NOT in
 *      `bulk_import_sessions` is removed wholesale, including any
 *      `<hash>_<originalName>` files inside it.
 *   2. A session directory whose id IS in `bulk_import_sessions` is
 *      kept; only stale `.upload-tmp-*` files inside it (older than
 *      the configured cutoff) are deleted. Fresh temp files (a live
 *      upload mid-flight) and committed `<hash>_<originalName>` files
 *      survive untouched.
 *   3. The returned counters reflect what was removed so the startup
 *      hook can log and alert on them.
 *   4. The function is safe to call when the staging root does not
 *      exist (a brand-new install).
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import * as nodeFs from 'fs';
import * as nodeOs from 'os';
import * as nodePath from 'path';

// Replace the drizzle-orm `inArray()` operator with a passthrough that
// surfaces the candidate ids on the predicate object. The db mock
// below pulls those ids back out so the test can decide which
// sessions are "alive" without standing up a real Postgres.
jest.mock('drizzle-orm', () => {
  const actual = jest.requireActual('drizzle-orm');
  return {
    ...actual,
    inArray: (column: any, values: any) => ({
      __mockType: 'inArray',
      column,
      values,
    }),
  };
});

// Per-test isolated staging root inside the OS temp dir. We never
// touch the real `<cwd>/.staging/bulk-import` so parallel test runs
// (or a real dev server staging files into the project) cannot have
// their state damaged by this suite.
const TMP_ROOT = nodeFs.mkdtempSync(
  nodePath.join(nodeOs.tmpdir(), 'bulk-import-janitor-test-'),
);

// Session ids the mocked db should report as alive. Anything not in
// this set is treated as an orphan whose row has been deleted.
const liveSessionIds = new Set<string>();

jest.mock('../../../server/db', () => {
  function builder() {
    let mode: 'select-sessions' | 'unknown' = 'unknown';
    let pendingFilter: { values?: string[] } | null = null;

    const api: any = {
      select(_cols?: any) {
        return api;
      },
      from(table: any) {
        const sym =
          (table &&
            (table[Symbol.for('drizzle:Name')] ||
              table[Symbol.for('drizzle:BaseName')])) ||
          (table && table.name);
        mode = sym === 'bulk_import_sessions' ? 'select-sessions' : 'unknown';
        return api;
      },
      where(predicate: any) {
        if (
          predicate &&
          typeof predicate === 'object' &&
          predicate.__mockType === 'inArray' &&
          Array.isArray(predicate.values)
        ) {
          pendingFilter = { values: predicate.values as string[] };
        }
        return api;
      },
      then(resolve: any, reject: any) {
        if (mode === 'select-sessions') {
          const candidateIds = pendingFilter?.values ?? [];
          const rows = candidateIds
            .filter((id) => liveSessionIds.has(id))
            .map((id) => ({ id }));
          return Promise.resolve(rows).then(resolve, reject);
        }
        return Promise.resolve([]).then(resolve, reject);
      },
    };
    return api;
  }

  return {
    db: {
      select: (...args: any[]) => builder().select(...args),
    },
  };
});

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logDebug: jest.fn(),
}));

// Import AFTER the mocks above so the module picks them up.
const { sweepStagingOrphans } = require('../../../server/api/bulk-import');

function makeSessionDir(sessionId: string): string {
  const dir = nodePath.join(TMP_ROOT, sessionId);
  nodeFs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeStaged(sessionDir: string, name: string, body = 'data'): string {
  const p = nodePath.join(sessionDir, name);
  nodeFs.writeFileSync(p, body);
  return p;
}

function setMtime(filePath: string, when: Date): void {
  nodeFs.utimesSync(filePath, when, when);
}

function clearTmpRoot(): void {
  if (!nodeFs.existsSync(TMP_ROOT)) return;
  for (const entry of nodeFs.readdirSync(TMP_ROOT)) {
    nodeFs.rmSync(nodePath.join(TMP_ROOT, entry), {
      recursive: true,
      force: true,
    });
  }
}

describe('Task #1066 — bulk-import staging janitor', () => {
  beforeEach(() => {
    clearTmpRoot();
    liveSessionIds.clear();
    nodeFs.mkdirSync(TMP_ROOT, { recursive: true });
  });

  afterAll(() => {
    try {
      nodeFs.rmSync(TMP_ROOT, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  });

  it('removes a whole orphan session directory whose id has no row in bulk_import_sessions', async () => {
    const orphanId = 'orphan-session-1';
    // Note: NOT added to `liveSessionIds` -> mock reports it as orphan.
    const orphanDir = makeSessionDir(orphanId);
    const stagedFile = writeStaged(
      orphanDir,
      'abc123_lease.pdf',
      'staged-bytes',
    );
    const tmpFile = writeStaged(orphanDir, '.upload-tmp-stale', 'tmp-bytes');
    expect(nodeFs.existsSync(stagedFile)).toBe(true);
    expect(nodeFs.existsSync(tmpFile)).toBe(true);

    const result = await sweepStagingOrphans({
      now: Date.now(),
      stagingRoot: TMP_ROOT,
    });

    expect(result.removedSessionDirs).toBe(1);
    expect(result.removedTmp).toBe(0);
    expect(result.inspectedDirs).toBe(1);
    expect(nodeFs.existsSync(orphanDir)).toBe(false);
  });

  it('keeps live session directories and only deletes stale `.upload-tmp-*` files inside them', async () => {
    const liveId = 'live-session-1';
    liveSessionIds.add(liveId);

    const liveDir = makeSessionDir(liveId);
    const stagedKeep = writeStaged(liveDir, 'deadbeef_invoice.pdf', 'real');
    const tmpFresh = writeStaged(liveDir, '.upload-tmp-fresh', 'fresh');
    const tmpStale = writeStaged(liveDir, '.upload-tmp-stale', 'stale');

    // Make the stale temp file 2 hours old; leave the fresh one at "now".
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    setMtime(tmpStale, twoHoursAgo);

    const result = await sweepStagingOrphans({
      now: Date.now(),
      maxTmpAgeMs: 60 * 60 * 1000,
      stagingRoot: TMP_ROOT,
    });

    expect(result.removedSessionDirs).toBe(0);
    expect(result.removedTmp).toBe(1);
    expect(result.inspectedDirs).toBe(1);
    // Live session dir survives.
    expect(nodeFs.existsSync(liveDir)).toBe(true);
    // Real staged file untouched.
    expect(nodeFs.existsSync(stagedKeep)).toBe(true);
    // Fresh in-flight temp file untouched.
    expect(nodeFs.existsSync(tmpFresh)).toBe(true);
    // Stale temp file removed.
    expect(nodeFs.existsSync(tmpStale)).toBe(false);
  });

  it('handles a mix of orphan and live dirs in a single pass', async () => {
    const liveId = 'live-mixed-1';
    const orphanId = 'orphan-mixed-1';
    liveSessionIds.add(liveId);

    const liveDir = makeSessionDir(liveId);
    const orphanDir = makeSessionDir(orphanId);
    writeStaged(liveDir, 'feedface_doc.pdf', 'live');
    writeStaged(orphanDir, 'baadc0de_doc.pdf', 'orphan');
    const orphanTmp = writeStaged(orphanDir, '.upload-tmp-orphan', 'tmp');
    void orphanTmp;

    const result = await sweepStagingOrphans({
      now: Date.now(),
      stagingRoot: TMP_ROOT,
    });

    expect(result.removedSessionDirs).toBe(1);
    expect(result.inspectedDirs).toBe(2);
    expect(nodeFs.existsSync(liveDir)).toBe(true);
    expect(nodeFs.existsSync(orphanDir)).toBe(false);
  });

  it('returns zero counters and does not throw when the staging root does not exist', async () => {
    const missingRoot = nodePath.join(TMP_ROOT, 'does-not-exist-yet');
    const result = await sweepStagingOrphans({
      now: Date.now(),
      stagingRoot: missingRoot,
    });
    expect(result.removedTmp).toBe(0);
    expect(result.removedSessionDirs).toBe(0);
    expect(result.inspectedDirs).toBe(0);
  });
});
