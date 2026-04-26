/**
 * @jest-environment node
 *
 * Task #1204 — Lock in the production-URL safety gate inside
 * `scripts/clean-orphan-fk-rows.ts`.
 *
 * `main()` refuses to run when the configured `DATABASE_URL` /
 * `_INTEGRATION_DB_URL` looks like a production database (hostname or
 * path matching `prod` / `production` / `live`) unless
 * `ALLOW_DB_PUSH_IN_TESTS=1` is set. This is the script's last line of
 * defence against an operator pointing it at the production database
 * and silently DELETE-ing rows.
 *
 * The guard had no automated coverage — a regex regression or an
 * accidental short-circuit refactor would disable it without any test
 * failing. This file fixes that with a unit-tier test that drives
 * `main()` purely through env vars: the guard rejects before any DB
 * connection is attempted (the URL string itself is the trigger), so
 * no real Postgres is needed and the test is safe to run in any tier.
 *
 * Same shape as Task #1195 / #1184 / #1164: a small, focused assertion
 * that locks in a critical safety behaviour. Lives as a sibling unit-
 * tier file next to `orphan-fk-cleanup.test.ts` rather than inside it
 * so it runs unconditionally (the integration file is gated on
 * `_INTEGRATION_DB_URL`).
 */

import { describe, it, expect } from '@jest/globals';
import type pg from 'pg';

import { main } from '../../scripts/clean-orphan-fk-rows';

// A URL whose hostname contains the literal `production` token — the
// `looksLikeProductionUrl` regex matches `(^|[._-])(prod|production|
// live)([._-]|$)`, so `db.production.example` is the canonical
// production-shape we want to lock the guard against.
const PROD_URL = 'postgres://u:p@db.production.example/app';
// And the matching masked form `maskDbUrl` produces — asserting on
// this directly proves the operator-facing error names the offending
// host (without leaking credentials) instead of just saying
// "production" generically.
const PROD_URL_MASKED = 'postgres://***@db.production.example/app';

/**
 * Snapshot + restore the env vars the guard reads. Mirrors the
 * `finally`-block restoration the existing `SKIP_ORPHAN_FK_CLEANUP`
 * test in `orphan-fk-cleanup.test.ts` uses, so a crashed assertion
 * never bleeds prod-shape URLs into other tests in the same worker.
 */
function snapshotEnv() {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    _INTEGRATION_DB_URL: process.env._INTEGRATION_DB_URL,
    ALLOW_DB_PUSH_IN_TESTS: process.env.ALLOW_DB_PUSH_IN_TESTS,
    SKIP_ORPHAN_FK_CLEANUP: process.env.SKIP_ORPHAN_FK_CLEANUP,
  };
}

function restoreEnv(snap: ReturnType<typeof snapshotEnv>) {
  for (const [key, value] of Object.entries(snap)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('clean-orphan-fk-rows production-URL safety gate (Task #1204)', () => {
  it('main() rejects against a production-shaped DATABASE_URL with the masked URL and ALLOW_DB_PUSH_IN_TESTS in the message', async () => {
    const snap = snapshotEnv();
    try {
      // Force the prod-shape URL into both env vars the script reads
      // so the test doesn't depend on which one the host happens to
      // have set. Clear the override and the SKIP opt-out so neither
      // can mask the assertion.
      process.env.DATABASE_URL = PROD_URL;
      delete process.env._INTEGRATION_DB_URL;
      delete process.env.ALLOW_DB_PUSH_IN_TESTS;
      delete process.env.SKIP_ORPHAN_FK_CLEANUP;

      await expect(main()).rejects.toThrow(
        /Refusing to clean orphans against a production-shaped URL/,
      );

      // Re-run for the message-content assertions so we can grab the
      // rejection without relying on `.rejects.toThrow`'s regex doing
      // double duty. Asserting on the masked URL specifically is what
      // proves the operator sees the offending host (and that
      // credentials are NOT leaked into the error string).
      let rejection: Error | undefined;
      await main().catch((err: unknown) => {
        rejection = err as Error;
      });
      expect(rejection).toBeInstanceOf(Error);
      expect(rejection!.message).toContain(PROD_URL_MASKED);
      expect(rejection!.message).not.toContain('u:p@'); // no creds leak
      expect(rejection!.message).toContain('ALLOW_DB_PUSH_IN_TESTS');
      expect(rejection!.message).toContain('[clean-orphan-fk-rows]');
    } finally {
      restoreEnv(snap);
    }
  });

  it('main() also rejects when only _INTEGRATION_DB_URL is the production-shaped URL', async () => {
    // The guard reads `_INTEGRATION_DB_URL || DATABASE_URL`, so a
    // regression that only checked `DATABASE_URL` would pass the
    // single-env test above while still letting an unsafe
    // `_INTEGRATION_DB_URL` through. Cover both env vars explicitly.
    const snap = snapshotEnv();
    try {
      delete process.env.DATABASE_URL;
      process.env._INTEGRATION_DB_URL = PROD_URL;
      delete process.env.ALLOW_DB_PUSH_IN_TESTS;
      delete process.env.SKIP_ORPHAN_FK_CLEANUP;

      await expect(main()).rejects.toThrow(
        /Refusing to clean orphans against a production-shaped URL/,
      );
    } finally {
      restoreEnv(snap);
    }
  });

  it('main() proceeds past the guard when ALLOW_DB_PUSH_IN_TESTS=1 is set, even with a production-shaped URL', async () => {
    // The override path is just as critical as the rejection path:
    // the script must still be runnable against a prod-shape URL when
    // an operator has explicitly opted in (the documented escape
    // hatch). A regression that always rejected would brick the
    // override workflow without failing any of the rejection tests.
    //
    // Drive `main()` with an injected fake client + empty FK list so
    // it never attempts a real Postgres connection: the guard runs
    // first, then `runCleanup` iterates zero FKs and returns cleanly.
    // If the guard incorrectly fired, the assertion below would fail
    // with the "Refusing to clean orphans" error instead of resolving.
    const snap = snapshotEnv();
    const origLog = console.log;
    console.log = () => undefined;
    try {
      process.env.DATABASE_URL = PROD_URL;
      delete process.env._INTEGRATION_DB_URL;
      process.env.ALLOW_DB_PUSH_IN_TESTS = '1';
      delete process.env.SKIP_ORPHAN_FK_CLEANUP;

      const fakeClient = {
        query: async () => {
          throw new Error(
            'fakeClient.query should not be called when fks=[] — ' +
              'runCleanup must iterate zero times',
          );
        },
      } as unknown as pg.Client;

      await expect(
        main({ client: fakeClient, fks: [] }),
      ).resolves.toBeUndefined();
    } finally {
      console.log = origLog;
      restoreEnv(snap);
    }
  });

  it('main() does NOT trigger the production guard for a non-production URL (no false positives)', async () => {
    // Counter-example: a benign localhost URL must NOT be flagged.
    // Locks in that the regex stays scoped to the production tokens
    // and doesn't accidentally over-match (a regression that returned
    // `true` for everything would pass the rejection tests above but
    // would brick every developer's local integration run).
    const snap = snapshotEnv();
    const origLog = console.log;
    console.log = () => undefined;
    try {
      process.env.DATABASE_URL = 'postgres://u:p@localhost:5432/app_test';
      delete process.env._INTEGRATION_DB_URL;
      delete process.env.ALLOW_DB_PUSH_IN_TESTS;
      delete process.env.SKIP_ORPHAN_FK_CLEANUP;

      const fakeClient = {
        query: async () => {
          throw new Error('fakeClient.query should not be called when fks=[]');
        },
      } as unknown as pg.Client;

      await expect(
        main({ client: fakeClient, fks: [] }),
      ).resolves.toBeUndefined();
    } finally {
      console.log = origLog;
      restoreEnv(snap);
    }
  });
});
