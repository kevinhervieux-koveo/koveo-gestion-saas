/**
 * @jest-environment node
 */

/**
 * Integration regression test — Task #1451
 *
 * Real-database sibling of `ensure-trigger-migrations-non-fatal.test.ts`.
 *
 * Background
 * ----------
 * Task #1443 fixed the 5:11 AM boot crash by serializing the boot-time
 * trigger re-application across containers using a Postgres advisory
 * lock (see the CROSS-CONTAINER SERIALIZATION block in
 * `server/ensure-trigger-migrations.ts`). The unit tests that ship
 * alongside that change inject a mock pool, which proves the wrapper
 * USES `pg_advisory_lock(...)` but cannot prove that the lock actually
 * prevents the demands-table contention end-to-end.
 *
 * What this test proves
 * ---------------------
 * 1. WITHOUT the fix (`advisoryLockKey` omitted): two concurrent
 *    boot-style passes that both touch the `demands` table reproduce
 *    the original failure mode — a peer container's `DROP/CREATE
 *    TRIGGER` (AccessExclusiveLock) hits the bounded `lock_timeout`
 *    waiting behind the other container's UPDATE-on-demands
 *    transaction (RowExclusiveLock) → SQLSTATE 55P03.
 * 2. WITH the fix (`advisoryLockKey` supplied with the same key on
 *    both passes): the two boots serialize behind the advisory lock
 *    and both finish cleanly with a `trigger-only re-application:
 *    N ok, 0 failed` summary line. No 55P03 anywhere.
 *
 * Skip behaviour
 * --------------
 * The test deliberately does NOT import the shared `pool` from
 * `server/db.ts`. The default `jest.setup.simple.ts` overrides
 * `process.env.DATABASE_URL` to a localhost stub for unit isolation,
 * which means the shared pool would point at nothing real. Instead
 * we look up the original URL from `_INTEGRATION_DB_URL` (the same
 * env var `jest.global-setup.cjs` uses to find the integration
 * database) and fall back to `DATABASE_URL` only if it does NOT look
 * like the localhost stub. This way the test:
 *   - runs end-to-end against the real Neon DB when invoked with
 *     `_INTEGRATION_DB_URL=$DATABASE_URL npx jest …` (the standard
 *     incantation for integration-flavoured server/tests);
 *   - skips silently in pure-unit jest runs (no real DB available);
 *   - never accidentally collides with the shared application pool
 *     (it builds and tears down its own dedicated `Pool`).
 *
 * Idempotency
 * -----------
 * The test inserts ONE org / building / residence / demand row in
 * `beforeAll` so 0015's UPDATE has something to scan, and removes
 * them in `afterAll`. The migration files themselves (0010 / 0012 /
 * 0015) are idempotent (CREATE OR REPLACE FUNCTION, DROP/CREATE
 * TRIGGER, idempotent UPDATE), so re-running them on a live DB does
 * not change observable schema.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { join } from 'path';
import { readFileSync } from 'fs';
import {
  Pool,
  neonConfig,
  type WebSocketConstructor,
} from '@neondatabase/serverless';
import ws from 'ws';

import { ensureTriggerOnlyMigrations } from '../ensure-trigger-migrations';

if (!neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws as unknown as WebSocketConstructor;
}

/**
 * The exact connection string `jest.setup.simple.ts` hard-codes when
 * it overrides `process.env.DATABASE_URL` for unit isolation. Any URL
 * matching this string is the unit stub and means "no real DB
 * available" — but other localhost URLs (CI Postgres service
 * containers, testcontainers, dev databases) are perfectly valid
 * targets for this integration test, so we must NOT reject them.
 */
const UNIT_TEST_DATABASE_URL_STUB =
  'postgresql://test:test@localhost:5432/test_db';

/**
 * Resolves the real-DB URL the test should connect to without going
 * through `server/db.ts` — see the file-level comment for why.
 *
 * Resolution order:
 *   1. `_INTEGRATION_DB_URL` is authoritative when set. We honour it
 *      even if it points at localhost so that CI service-container
 *      and testcontainer setups (which routinely use localhost) work
 *      out of the box.
 *   2. Otherwise fall back to `DATABASE_URL`, but only if it isn't
 *      the unit-test stub the simple setup writes in.
 *   3. Returns `null` when neither yields a usable URL — the suite
 *      skips silently in that case.
 */
function resolveRealDbUrl(): string | null {
  const integrationUrl = process.env._INTEGRATION_DB_URL;
  if (typeof integrationUrl === 'string' && integrationUrl.length > 0) {
    return integrationUrl;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    return null;
  }
  if (databaseUrl === UNIT_TEST_DATABASE_URL_STUB) {
    return null;
  }
  return databaseUrl;
}

const REAL_DB_URL = resolveRealDbUrl();
const describeOrSkip = REAL_DB_URL ? describe : describe.skip;

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');

const TRIGGER_FILES = [
  '0010_demands_residence_building_check.sql',
  '0012_demands_assignation_check.sql',
  '0015_fix_cross_org_demand_residence_ids.sql',
] as const;

interface CapturedLog {
  msg: string;
  level: 'info' | 'error';
}

function captureLogs(): {
  logger: (m: string, l?: 'info' | 'error') => void;
  logs: CapturedLog[];
} {
  const logs: CapturedLog[] = [];
  const logger = (m: string, l?: 'info' | 'error') => {
    logs.push({ msg: m, level: l ?? 'info' });
  };
  return { logger, logs };
}

/**
 * Per-test advisory-lock key. We deliberately do NOT use the real
 * `MIGRATION_LOCK_KEY` from `scripts/run-migrations.ts` — a live
 * production boot could be holding it, and the test should never wait
 * on (or interfere with) production work. A negative bigint sits in a
 * disjoint namespace from the real key.
 */
const TEST_ADVISORY_LOCK_KEY = '-7426891234500001';

describeOrSkip(
  'ensureTriggerOnlyMigrations — cross-boot advisory-lock integration (Task #1451)',
  () => {
    jest.setTimeout(60_000);

    let testPool: Pool;
    let orgId: string;
    let buildingId: string;
    let residenceId: string;
    let demandId: string;

    beforeAll(async () => {
      testPool = new Pool({
        connectionString: REAL_DB_URL!,
        max: 6,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      });

      // Create an org → building → residence → demand chain via raw
      // SQL on the dedicated test pool. We avoid drizzle here so the
      // test never depends on `server/db.ts` being usable in this
      // jest worker.
      const seed = await testPool.connect();
      try {
        const orgRows = await seed.query<{ id: string }>(
          `INSERT INTO organizations (name, type, address, city, province, postal_code, is_active)
           VALUES ($1, 'syndicate', '1451 Lock Ave', 'Montreal', 'QC', 'H1A 1A1', true)
           RETURNING id`,
          ['Adv-Lock Integ Org – task 1451'],
        );
        orgId = orgRows.rows[0].id;

        const buildingRows = await seed.query<{ id: string }>(
          `INSERT INTO buildings
             (name, address, city, postal_code, organization_id, total_units,
              total_floors, building_type, is_active)
           VALUES ($1, '1451 Lock Way', 'Montreal', 'H1A 1A1', $2, 4, 1,
             'apartment', true)
           RETURNING id`,
          ['Adv-Lock Building – task 1451', orgId],
        );
        buildingId = buildingRows.rows[0].id;

        const residenceRows = await seed.query<{ id: string }>(
          `INSERT INTO residences
             (building_id, unit_number, floor, monthly_fees, is_active)
           VALUES ($1, 'AL-1451', 1, '1000.00', true)
           RETURNING id`,
          [buildingId],
        );
        residenceId = residenceRows.rows[0].id;

        const demandRows = await seed.query<{ id: string }>(
          `INSERT INTO demands
             (building_id, residence_id, type, status, description)
           VALUES ($1, $2, 'other', 'draft', $3)
           RETURNING id`,
          [
            buildingId,
            residenceId,
            'Adv-lock integ smoke demand (task 1451)',
          ],
        );
        demandId = demandRows.rows[0].id;
      } finally {
        seed.release();
      }
    }, 30_000);

    afterAll(async () => {
      if (!testPool) return;
      const cleanup = await testPool.connect();
      try {
        if (demandId)
          await cleanup
            .query('DELETE FROM demands WHERE id = $1', [demandId])
            .catch(() => undefined);
        if (residenceId)
          await cleanup
            .query('DELETE FROM residences WHERE id = $1', [residenceId])
            .catch(() => undefined);
        if (buildingId)
          await cleanup
            .query('DELETE FROM buildings WHERE id = $1', [buildingId])
            .catch(() => undefined);
        if (orgId)
          await cleanup
            .query('DELETE FROM organizations WHERE id = $1', [orgId])
            .catch(() => undefined);
      } finally {
        cleanup.release();
        await testPool.end().catch(() => undefined);
      }
    }, 30_000);

    it('WITH the advisory-lock fix: two concurrent boots both finish "N ok, 0 failed" and emit no SQLSTATE 55P03', async () => {
      const bootA = captureLogs();
      const bootB = captureLogs();

      const fileList: string[] = [...TRIGGER_FILES];
      const [resA, resB] = await Promise.all([
        ensureTriggerOnlyMigrations(fileList, {
          pool: testPool,
          migrationsDir: MIGRATIONS_DIR,
          advisoryLockKey: TEST_ADVISORY_LOCK_KEY,
          logger: bootA.logger,
        }),
        ensureTriggerOnlyMigrations(fileList, {
          pool: testPool,
          migrationsDir: MIGRATIONS_DIR,
          advisoryLockKey: TEST_ADVISORY_LOCK_KEY,
          logger: bootB.logger,
        }),
      ]);

      // Both boots applied every file. Failed list is empty on each.
      expect(resA.failed).toEqual([]);
      expect(resB.failed).toEqual([]);
      expect(resA.ok).toEqual([...TRIGGER_FILES]);
      expect(resB.ok).toEqual([...TRIGGER_FILES]);

      // Each boot must emit the canonical summary line — this is the
      // exact string CI / log scrapers grep for.
      const expectedSummary = `trigger-only re-application: ${TRIGGER_FILES.length} ok, 0 failed`;
      const summaryA = bootA.logs.find((l) =>
        l.msg.includes('trigger-only re-application'),
      );
      const summaryB = bootB.logs.find((l) =>
        l.msg.includes('trigger-only re-application'),
      );
      expect(summaryA?.msg).toContain(expectedSummary);
      expect(summaryB?.msg).toContain(expectedSummary);

      // Both boots must have actually acquired the advisory lock.
      // (If one of them had skipped because the lock was unavailable
      // it would have logged "SKIPPED (advisory lock unavailable)"
      // and `ok` would be empty — already asserted above, this is
      // the positive-side proof.)
      expect(
        bootA.logs.some((l) => l.msg.includes('acquired advisory lock')),
      ).toBe(true);
      expect(
        bootB.logs.some((l) => l.msg.includes('acquired advisory lock')),
      ).toBe(true);

      // No SQLSTATE 55P03 (lock_timeout) anywhere. This is the
      // observable difference vs. the without-fix case below.
      const lockTimeouts = [...bootA.logs, ...bootB.logs].filter((l) =>
        l.msg.includes('55P03'),
      );
      expect(lockTimeouts).toEqual([]);
    });

    it('WITHOUT the advisory-lock fix: two concurrent boots collide on the demands table and reproduce SQLSTATE 55P03', async () => {
      // Reproducing the production race deterministically requires
      // pinning the interleaving — otherwise scheduling slop can
      // sometimes let the two boots finish back-to-back and hide the
      // bug. We do that with two staggered passes:
      //
      //   - Boot A runs ONLY 0015, but with a brief
      //     `LOCK TABLE demands IN ROW EXCLUSIVE MODE; pg_sleep(2);`
      //     injected into its DO block. This exactly mirrors the
      //     lock class 0015's real UPDATE-on-demands acquires
      //     (RowExclusiveLock) and holds it long enough to overlap
      //     with the peer boot's 0010 work.
      //
      //   - 200 ms later boot B runs ONLY 0010. Its DROP/CREATE
      //     TRIGGER on demands needs AccessExclusiveLock and so
      //     queues behind boot A's RowExclusive. With the bounded
      //     `lock_timeout` the wrapper sets per file, that wait
      //     aborts as SQLSTATE 55P03 — exactly the failure the
      //     5:11 AM production crash logged.
      //
      // RowExclusive vs. AccessExclusive is exactly the lock-class
      // collision the production failure exhibited.
      // Hold the lock for a generous 5 s so even with Neon's
      // serverless WebSocket round-trip variance the peer boot's
      // DROP TRIGGER reliably collides while the lock is held.
      const slowReadFile = (path: string): string => {
        const content = readFileSync(path, 'utf8');
        if (path.endsWith('0015_fix_cross_org_demand_residence_ids.sql')) {
          // 0015's real UPDATE only fires when `has_violations` is
          // true (steady-state: false), so injecting the slow LOCK
          // *inside* that branch is silent in tests with clean
          // fixtures. Instead we inject it BEFORE the EXISTS probe
          // so it always runs and reliably holds RowExclusiveLock
          // on `demands` for ~5 s.
          //
          // We anchor on the `SELECT EXISTS (` line at the top of the
          // probe block. If the wording of 0015 changes, the
          // sanity check below catches it loudly instead of silently
          // disarming the regression.
          const anchor = '  SELECT EXISTS (\n    SELECT 1\n      FROM demands d';
          if (!content.includes(anchor)) {
            throw new Error(
              `Test setup error: 0015 SQL no longer contains the expected ` +
                `EXISTS-probe anchor (wording changed). Update slowReadFile.`,
            );
          }
          return content.replace(
            anchor,
            '  LOCK TABLE demands IN ROW EXCLUSIVE MODE;\n' +
              '  PERFORM pg_sleep(5);\n' +
              anchor,
          );
        }
        return content;
      };

      // Tighten the per-file lock_timeout so the contended DROP
      // TRIGGER aborts quickly (well under our jest 60 s budget) and
      // the test stays fast. The default 5 s is correct in production
      // — we just don't want the test to spend it.
      const prevLockTimeout = process.env.TRIGGER_REAPPLY_LOCK_TIMEOUT_MS;
      process.env.TRIGGER_REAPPLY_LOCK_TIMEOUT_MS = '750';
      try {
        const bootA = captureLogs();
        const bootB = captureLogs();

        const bootAPromise = ensureTriggerOnlyMigrations(
          ['0015_fix_cross_org_demand_residence_ids.sql'],
          {
            pool: testPool,
            migrationsDir: MIGRATIONS_DIR,
            readFile: slowReadFile,
            logger: bootA.logger,
          },
        );

        // Give boot A ~600 ms of head-start so it has definitely
        // opened its connection, parsed the DDL, entered the DO
        // block, and is sitting inside pg_sleep(5) holding
        // RowExclusiveLock on demands before boot B starts the
        // DROP TRIGGER work. Neon's serverless round-trip can take
        // 100-300 ms even on warm pools, so the buffer matters.
        await new Promise((resolve) => setTimeout(resolve, 600));

        const bootBPromise = ensureTriggerOnlyMigrations(
          ['0010_demands_residence_building_check.sql'],
          {
            pool: testPool,
            migrationsDir: MIGRATIONS_DIR,
            logger: bootB.logger,
          },
        );

        const [resA, resB] = await Promise.all([bootAPromise, bootBPromise]);

        // Boot A still finishes (its own session holds the lock).
        expect(resA.failed).toEqual([]);

        // Boot B's 0010 must have failed with 55P03 lock contention.
        expect(resB.failed).toContain(
          '0010_demands_residence_building_check.sql',
        );

        const lockContentionLine = bootB.logs.find(
          (l) =>
            l.level === 'error' &&
            l.msg.includes('55P03') &&
            l.msg.includes('lock contention') &&
            l.msg.includes('0010_demands_residence_building_check.sql'),
        );
        expect(lockContentionLine).toBeDefined();
      } finally {
        if (prevLockTimeout === undefined) {
          delete process.env.TRIGGER_REAPPLY_LOCK_TIMEOUT_MS;
        } else {
          process.env.TRIGGER_REAPPLY_LOCK_TIMEOUT_MS = prevLockTimeout;
        }
      }

      // Self-heal: re-apply 0010 cleanly (no contention now) so any
      // partial trigger state from the race above is restored to a
      // known-good shape. This is best-effort — the wrapper is
      // non-fatal either way.
      const heal = captureLogs();
      await ensureTriggerOnlyMigrations(
        ['0010_demands_residence_building_check.sql'],
        {
          pool: testPool,
          migrationsDir: MIGRATIONS_DIR,
          logger: heal.logger,
        },
      );
    });
  },
);
