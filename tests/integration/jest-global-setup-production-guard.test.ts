/**
 * @jest-environment node
 *
 * Task #1210 — Lock in the production-URL safety gate inside
 * `jest.global-setup.cjs`.
 *
 * The global setup refuses to run `drizzle-kit push --force` against a
 * URL whose hostname/path matches the `prod` / `production` / `live`
 * tokens unless `ALLOW_DB_PUSH_IN_TESTS=1` is set. This is the *first*
 * line of defence against an operator pointing the integration suite
 * at production — it fires before the orphan-cleanup script (whose
 * sibling guard is locked in by Task #1204) is even invoked.
 *
 * Same shape, same failure mode if it regresses, but until now no
 * automated coverage: a regex regression or accidental short-circuit
 * refactor would silently disable the gate without any test failing.
 *
 * This file mirrors the structure of
 * `tests/integration/orphan-fk-cleanup-production-guard.test.ts`:
 * env-var snapshot/restore in a `finally`, a rejection path that
 * pins the masked URL + `ALLOW_DB_PUSH_IN_TESTS` token in the
 * operator-facing message, and a bypass path that proves
 * `ALLOW_DB_PUSH_IN_TESTS=1` actually proceeds past the guard.
 *
 * The bypass case stubs `child_process.spawn` (so no real
 * `drizzle-kit push` runs) and `pg.Client` (so the trigger-only
 * migration step never opens a Postgres connection). The guard fires
 * before any of those are touched, so the rejection cases need no
 * mocks at all — the URL string itself is the trigger.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { EventEmitter } from 'events';

// Override the moduleNameMapper'd `__mocks__/child_process.js` (whose
// fake child only emits `close`, never `exit`, and has no `stdin`)
// with a spawn that emits the exact `exit` event `runDrizzleKitPush`
// awaits and exposes the `stdin` API it pokes. Without this the
// bypass test below would hang at the 3s test timeout.
jest.mock('child_process', () => ({
  spawn: jest.fn(() => {
    const child: EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      stdin: { destroyed: boolean; write: () => void; end: () => void };
      kill: () => void;
    } = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      stdin: {
        destroyed: true,
        write: () => undefined,
        end: () => undefined,
      },
      kill: () => undefined,
    });
    setImmediate(() => child.emit('exit', 0));
    return child;
  }),
}));

// Stub `pg.Client` so `applyTriggerOnlyMigrations` never opens a real
// Postgres connection in the bypass test. The migration files
// referenced by the global setup do exist on disk, so `fs.readFileSync`
// still succeeds — it's just `client.query(sql)` that becomes a no-op.
jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: async () => undefined,
    query: async () => undefined,
    end: async () => undefined,
  })),
}));

// Lazy-require AFTER `jest.mock` registrations above so the mocks are
// in effect when the global-setup file pulls in `child_process`/`pg`.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const globalSetup: () => Promise<void> = require('../../jest.global-setup.cjs');

// A URL whose hostname contains the literal `production` token — the
// `looksLikeProductionUrl` regex matches `(^|[._-])(prod|production|
// live)([._-]|$)`, so `db.production.example` is the canonical
// production-shape we want to lock the guard against.
const PROD_URL = 'postgres://u:p@db.production.example/app';
// Matching masked form `maskDbUrl` produces — asserting on this
// directly proves the operator-facing error names the offending host
// (without leaking credentials) instead of just saying "production"
// generically.
const PROD_URL_MASKED = 'postgres://***@db.production.example/app';

/**
 * Snapshot + restore the env vars the guard reads. Mirrors the
 * `finally`-block restoration pattern used by
 * `orphan-fk-cleanup-production-guard.test.ts`, so a crashed assertion
 * never bleeds prod-shape URLs into other tests in the same worker.
 */
function snapshotEnv() {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    _INTEGRATION_DB_URL: process.env._INTEGRATION_DB_URL,
    ALLOW_DB_PUSH_IN_TESTS: process.env.ALLOW_DB_PUSH_IN_TESTS,
    SKIP_INTEGRATION_DB_SYNC: process.env.SKIP_INTEGRATION_DB_SYNC,
    SKIP_ORPHAN_FK_CLEANUP: process.env.SKIP_ORPHAN_FK_CLEANUP,
    TEST_TYPE: process.env.TEST_TYPE,
    REQUIRE_INTEGRATION_DB_URL: process.env.REQUIRE_INTEGRATION_DB_URL,
  };
}

function restoreEnv(snap: ReturnType<typeof snapshotEnv>): void {
  for (const [key, value] of Object.entries(snap)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('jest.global-setup production-URL safety gate (Task #1210)', () => {
  // `jest.setup.simple.ts` defaults `TEST_TYPE=unit`, which would short-
  // circuit the global setup entirely and silently mask the guard. Clear
  // both opt-out env vars before each case so the gate code path is
  // actually reached.
  beforeEach(() => {
    delete process.env.TEST_TYPE;
    delete process.env.SKIP_INTEGRATION_DB_SYNC;
  });

  it('rejects against a production-shaped DATABASE_URL with the masked URL and ALLOW_DB_PUSH_IN_TESTS in the message', async () => {
    const snap = snapshotEnv();
    try {
      // Force the prod-shape URL into both env vars the setup reads
      // so the test doesn't depend on which one the host happens to
      // have set. Clear the override so it can't mask the assertion.
      process.env.DATABASE_URL = PROD_URL;
      delete process.env._INTEGRATION_DB_URL;
      delete process.env.ALLOW_DB_PUSH_IN_TESTS;

      await expect(globalSetup()).rejects.toThrow(
        /Refusing drizzle-kit push against a production-shaped URL/,
      );

      // Re-run for the message-content assertions so we can grab the
      // rejection without relying on `.rejects.toThrow`'s regex doing
      // double duty. Asserting on the masked URL specifically is what
      // proves the operator sees the offending host (and that
      // credentials are NOT leaked into the error string).
      let rejection: Error | undefined;
      await globalSetup().catch((err: unknown) => {
        rejection = err as Error;
      });
      expect(rejection).toBeInstanceOf(Error);
      expect(rejection!.message).toContain(PROD_URL_MASKED);
      expect(rejection!.message).not.toContain('u:p@'); // creds must NOT leak
      expect(rejection!.message).toContain('ALLOW_DB_PUSH_IN_TESTS');
      expect(rejection!.message).toContain('[jest.global-setup]');
    } finally {
      restoreEnv(snap);
    }
  });

  it('also rejects when only _INTEGRATION_DB_URL is the production-shaped URL', async () => {
    // The setup reads `_INTEGRATION_DB_URL || DATABASE_URL`, so a
    // regression that only checked `DATABASE_URL` would pass the
    // single-env test above while still letting an unsafe
    // `_INTEGRATION_DB_URL` through. Cover both env vars explicitly.
    const snap = snapshotEnv();
    try {
      delete process.env.DATABASE_URL;
      process.env._INTEGRATION_DB_URL = PROD_URL;
      delete process.env.ALLOW_DB_PUSH_IN_TESTS;

      await expect(globalSetup()).rejects.toThrow(
        /Refusing drizzle-kit push against a production-shaped URL/,
      );
    } finally {
      restoreEnv(snap);
    }
  });

  it('proceeds past the guard when ALLOW_DB_PUSH_IN_TESTS=1 is set, even with a production-shaped URL', async () => {
    // The override path is just as critical as the rejection path:
    // the suite must still be runnable against a prod-shape URL when
    // an operator has explicitly opted in (the documented escape
    // hatch). A regression that always rejected would brick the
    // override workflow without failing any of the rejection tests.
    //
    // `child_process.spawn` and `pg.Client` are stubbed at the top of
    // this file so no real `drizzle-kit push` runs and no Postgres
    // connection is opened. We also set `SKIP_ORPHAN_FK_CLEANUP=1` to
    // skip the orphan-cleanup spawn (its production guard already has
    // dedicated coverage in Task #1204). If the guard incorrectly
    // fired, this assertion would fail with the "Refusing drizzle-kit
    // push" error instead of resolving cleanly.
    const snap = snapshotEnv();
    const origLog = console.log;
    console.log = () => undefined;
    try {
      process.env.DATABASE_URL = PROD_URL;
      delete process.env._INTEGRATION_DB_URL;
      process.env.ALLOW_DB_PUSH_IN_TESTS = '1';
      process.env.SKIP_ORPHAN_FK_CLEANUP = '1';

      await expect(globalSetup()).resolves.toBeUndefined();
    } finally {
      console.log = origLog;
      restoreEnv(snap);
    }
  });
});
