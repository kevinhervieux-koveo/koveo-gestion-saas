/**
 * @jest-environment node
 *
 * Task #1164 — Lock in the behaviour of `scripts/clean-orphan-fk-rows.ts`
 * (added in Task #1155) against a real Postgres database.
 *
 * The cleanup script runs in `jest.global-setup.cjs` before every
 * `drizzle-kit push --force`. Without it, a single newly-added or
 * tightened cascade FK that already has stale orphan rows in the
 * integration DB silently bricks the entire integration suite for
 * every developer (the original failure mode that motivated #1155).
 *
 * The cleanup logic itself was verified manually against the live
 * integration DB during #1155 but had no automated coverage. This file
 * fixes that with real-Postgres cases driven through scoped fixture
 * tables so we never have to mutate the actual application schema to
 * exercise the logic:
 *
 *   1. CASCADE FK orphan: the script must DELETE the orphan and the
 *      previously-`NOT VALID` FK constraint must then `VALIDATE`
 *      cleanly (this is the exact path drizzle-kit push needs to
 *      succeed after a schema tightening).
 *
 *   2. NO ACTION FK orphan: the script must REFUSE to guess and the
 *      thrown error must name the offending table, columns, and at
 *      least one sample row id so a developer can fix it by hand.
 *
 *   3. `SKIP_ORPHAN_FK_CLEANUP=1` opt-out: the env var is the
 *      single switch documented in
 *      `docs/INTEGRATION_DB_ORPHAN_CLEANUP.md` for triaging the
 *      cleanup itself. With it set, the script must short-circuit
 *      and leave seeded orphans untouched.
 *
 *   4. SET NULL FK orphan (Task #1184): the third branch of
 *      `cleanOrphans` runs in production every time a real `set null`
 *      FK has orphans, but had no automated coverage. The fixture
 *      seeds an orphan behind a `set null` FK, drives the cleanup,
 *      and asserts the row is preserved with its FK column NULLed,
 *      the result reports `action: 'nulled'`, and the previously
 *      `NOT VALID` constraint then `VALIDATE`s cleanly.
 *
 * Skipped cleanly when `_INTEGRATION_DB_URL` is not set so unit-tier
 * runs stay lightweight, mirroring the convention used by the other
 * real-DB integration tests in this directory.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import crypto from 'crypto';
import pg from 'pg';

import {
  runCleanup,
  collectForeignKeys,
  main,
  type FkInfo,
} from '../../scripts/clean-orphan-fk-rows';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL || process.env.DATABASE_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

// Stable, namespaced table names so a crashed run still cleans up
// deterministically and the fixtures never collide with application
// tables in the shared integration DB.
const TAG = `_t1164_${crypto.randomBytes(3).toString('hex')}`;
const PARENT = `${TAG}_parent`;
const CHILD_CASCADE = `${TAG}_child_cascade`;
const CHILD_NOACTION = `${TAG}_child_noaction`;
const CHILD_SETNULL = `${TAG}_child_setnull`;
// Composite-FK fixture (Task #1195): a parent with a 2-column primary
// key and a child with the matching 2 FK columns, so the test exercises
// the loop over `childColumns` / `parentColumns` in `findOrphans` /
// `cleanOrphans`. Single-column fixtures above only ever iterate that
// loop once, so a regression that broke the join/notNullClause
// construction for composite FKs (e.g. swapped column order, missing
// `AND`, off-by-one) would slip through the existing suite even though
// composite FKs do exist in production schemas.
const PARENT_COMPOSITE = `${TAG}_parent_composite`;
const CHILD_COMPOSITE = `${TAG}_child_composite`;

describeIfDb('orphan FK cleanup script — real Postgres (Task #1164)', () => {
  let client: pg.Client;

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    client = new pg.Client({ connectionString: REAL_DB_URL });
    await client.connect();

    // Drop any leftovers from a previously-crashed run, then create
    // the fixture tables. The cascade child gets the FK enforced from
    // the start; we'll temporarily disable the constraint when seeding
    // the orphan so the planted row survives. The no-action child
    // mirrors the production failure mode where a strict FK already
    // exists but contains orphans, so we mark its FK NOT VALID and
    // assert the cleanup refuses to clear it.
    await client.query(`DROP TABLE IF EXISTS "${CHILD_CASCADE}" CASCADE`);
    await client.query(`DROP TABLE IF EXISTS "${CHILD_NOACTION}" CASCADE`);
    await client.query(`DROP TABLE IF EXISTS "${CHILD_SETNULL}" CASCADE`);
    await client.query(`DROP TABLE IF EXISTS "${CHILD_COMPOSITE}" CASCADE`);
    await client.query(`DROP TABLE IF EXISTS "${PARENT}" CASCADE`);
    await client.query(`DROP TABLE IF EXISTS "${PARENT_COMPOSITE}" CASCADE`);

    await client.query(`
      CREATE TABLE "${PARENT}" (
        id uuid PRIMARY KEY
      )
    `);
    await client.query(`
      CREATE TABLE "${CHILD_CASCADE}" (
        id uuid PRIMARY KEY,
        parent_id uuid NOT NULL,
        CONSTRAINT "${CHILD_CASCADE}_parent_fk"
          FOREIGN KEY (parent_id) REFERENCES "${PARENT}"(id) ON DELETE CASCADE
      )
    `);
    await client.query(`
      CREATE TABLE "${CHILD_NOACTION}" (
        id uuid PRIMARY KEY,
        parent_id uuid NOT NULL,
        CONSTRAINT "${CHILD_NOACTION}_parent_fk"
          FOREIGN KEY (parent_id) REFERENCES "${PARENT}"(id) NOT VALID
      )
    `);
    // The set-null fixture deliberately keeps `parent_id` nullable —
    // a `set null` FK is illegal on a NOT NULL column, since the
    // declared cleanup action would itself violate the NOT NULL
    // constraint. Modelling it nullable here matches what production
    // schemas with `onDelete: 'set null'` actually look like.
    await client.query(`
      CREATE TABLE "${CHILD_SETNULL}" (
        id uuid PRIMARY KEY,
        parent_id uuid,
        CONSTRAINT "${CHILD_SETNULL}_parent_fk"
          FOREIGN KEY (parent_id) REFERENCES "${PARENT}"(id) ON DELETE SET NULL
      )
    `);
    // Composite-FK fixture: 2-column primary key on the parent, two
    // matching FK columns on the child. The composite child gets the FK
    // enforced from the start, just like the cascade single-column
    // fixture above; the planting helper drops + re-adds NOT VALID so
    // the orphan slips past the up-front check.
    await client.query(`
      CREATE TABLE "${PARENT_COMPOSITE}" (
        org_id uuid NOT NULL,
        item_id uuid NOT NULL,
        PRIMARY KEY (org_id, item_id)
      )
    `);
    await client.query(`
      CREATE TABLE "${CHILD_COMPOSITE}" (
        id uuid PRIMARY KEY,
        org_id uuid NOT NULL,
        item_id uuid NOT NULL,
        CONSTRAINT "${CHILD_COMPOSITE}_parent_fk"
          FOREIGN KEY (org_id, item_id)
          REFERENCES "${PARENT_COMPOSITE}"(org_id, item_id)
          ON DELETE CASCADE
      )
    `);
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !client) return;
    try {
      await client.query(`DROP TABLE IF EXISTS "${CHILD_CASCADE}" CASCADE`);
      await client.query(`DROP TABLE IF EXISTS "${CHILD_NOACTION}" CASCADE`);
      await client.query(`DROP TABLE IF EXISTS "${CHILD_SETNULL}" CASCADE`);
      await client.query(`DROP TABLE IF EXISTS "${CHILD_COMPOSITE}" CASCADE`);
      await client.query(`DROP TABLE IF EXISTS "${PARENT}" CASCADE`);
      await client.query(`DROP TABLE IF EXISTS "${PARENT_COMPOSITE}" CASCADE`);
    } finally {
      await client.end().catch(() => undefined);
    }
  }, 60000);

  beforeEach(async () => {
    if (!REAL_DB_URL) return;
    // Truncate (rather than drop+recreate) so each test starts from
    // an empty fixture without paying the DDL roundtrip cost.
    await client.query(
      `TRUNCATE TABLE "${CHILD_CASCADE}", "${CHILD_NOACTION}", "${CHILD_SETNULL}", "${PARENT}" RESTART IDENTITY`,
    );
    await client.query(
      `TRUNCATE TABLE "${CHILD_COMPOSITE}", "${PARENT_COMPOSITE}" RESTART IDENTITY`,
    );
  });

  /**
   * Seed an orphan row in the cascade child by temporarily dropping
   * the FK constraint, inserting the row, and re-adding the FK as
   * `NOT VALID` so it matches the real-world shape the cleanup is
   * designed to fix: a constraint that was relaxed/added later and
   * inherited stale rows from before it existed.
   */
  async function plantOrphanWithCascadeFk(): Promise<string> {
    const orphanId = crypto.randomUUID();
    const ghostParentId = crypto.randomUUID();
    await client.query(
      `ALTER TABLE "${CHILD_CASCADE}" DROP CONSTRAINT "${CHILD_CASCADE}_parent_fk"`,
    );
    await client.query(
      `INSERT INTO "${CHILD_CASCADE}" (id, parent_id) VALUES ($1, $2)`,
      [orphanId, ghostParentId],
    );
    await client.query(`
      ALTER TABLE "${CHILD_CASCADE}"
        ADD CONSTRAINT "${CHILD_CASCADE}_parent_fk"
        FOREIGN KEY (parent_id) REFERENCES "${PARENT}"(id)
        ON DELETE CASCADE
        NOT VALID
    `);
    return orphanId;
  }

  async function plantOrphanWithNoActionFk(): Promise<string> {
    const orphanId = crypto.randomUUID();
    const ghostParentId = crypto.randomUUID();
    // `NOT VALID` only opts out of the up-front existing-rows check at
    // constraint-creation time; Postgres still rejects new inserts that
    // violate the constraint. Drop, insert, re-add NOT VALID — the same
    // dance as the cascade fixture and the same shape as the real-world
    // failure the cleanup is supposed to fix.
    await client.query(
      `ALTER TABLE "${CHILD_NOACTION}" DROP CONSTRAINT "${CHILD_NOACTION}_parent_fk"`,
    );
    await client.query(
      `INSERT INTO "${CHILD_NOACTION}" (id, parent_id) VALUES ($1, $2)`,
      [orphanId, ghostParentId],
    );
    await client.query(`
      ALTER TABLE "${CHILD_NOACTION}"
        ADD CONSTRAINT "${CHILD_NOACTION}_parent_fk"
        FOREIGN KEY (parent_id) REFERENCES "${PARENT}"(id)
        NOT VALID
    `);
    return orphanId;
  }

  /**
   * Same dance as the cascade fixture, but for a `set null` FK on a
   * nullable column. We drop the FK, plant a row pointing at a
   * non-existent parent, then re-add the FK as `NOT VALID` so the
   * orphan slips past the up-front check — the exact production shape
   * the cleanup is supposed to NULL out.
   */
  async function plantOrphanWithSetNullFk(): Promise<string> {
    const orphanId = crypto.randomUUID();
    const ghostParentId = crypto.randomUUID();
    await client.query(
      `ALTER TABLE "${CHILD_SETNULL}" DROP CONSTRAINT "${CHILD_SETNULL}_parent_fk"`,
    );
    await client.query(
      `INSERT INTO "${CHILD_SETNULL}" (id, parent_id) VALUES ($1, $2)`,
      [orphanId, ghostParentId],
    );
    await client.query(`
      ALTER TABLE "${CHILD_SETNULL}"
        ADD CONSTRAINT "${CHILD_SETNULL}_parent_fk"
        FOREIGN KEY (parent_id) REFERENCES "${PARENT}"(id)
        ON DELETE SET NULL
        NOT VALID
    `);
    return orphanId;
  }

  function cascadeFk(): FkInfo {
    return {
      childTable: CHILD_CASCADE,
      childColumns: ['parent_id'],
      parentTable: PARENT,
      parentColumns: ['id'],
      onDelete: 'cascade',
    };
  }

  function noActionFk(): FkInfo {
    return {
      childTable: CHILD_NOACTION,
      childColumns: ['parent_id'],
      parentTable: PARENT,
      parentColumns: ['id'],
      onDelete: 'no action',
    };
  }

  function setNullFk(): FkInfo {
    return {
      childTable: CHILD_SETNULL,
      childColumns: ['parent_id'],
      parentTable: PARENT,
      parentColumns: ['id'],
      onDelete: 'set null',
    };
  }

  /**
   * Composite-FK fixture (Task #1195). Inserts:
   *  - one legitimate parent row `(orgA, itemB)` and a matching child
   *    `(orgA, itemB)` so we can prove the cleanup leaves real rows
   *    untouched (a swapped-column-order regression in the join would
   *    fail to find a parent for this row and incorrectly classify it
   *    as an orphan, deleting it);
   *  - one orphan child `(orgA, itemX)` whose `(org_id, item_id)` pair
   *    does NOT exist in the parent (a missing-`AND` regression in the
   *    join would join purely on `org_id`, find the legitimate parent
   *    row, and miss this orphan entirely).
   * The FK is dropped before planting and re-added NOT VALID afterwards
   * so the orphan slips past the constraint, mirroring the production
   * shape the cleanup is supposed to fix.
   */
  async function plantCompositeFixture(): Promise<{
    orphanId: string;
    legitimateId: string;
  }> {
    const orgA = crypto.randomUUID();
    const itemB = crypto.randomUUID();
    const itemX = crypto.randomUUID();
    const legitimateId = crypto.randomUUID();
    const orphanId = crypto.randomUUID();

    await client.query(
      `INSERT INTO "${PARENT_COMPOSITE}" (org_id, item_id) VALUES ($1, $2)`,
      [orgA, itemB],
    );
    await client.query(
      `INSERT INTO "${CHILD_COMPOSITE}" (id, org_id, item_id) VALUES ($1, $2, $3)`,
      [legitimateId, orgA, itemB],
    );
    await client.query(
      `ALTER TABLE "${CHILD_COMPOSITE}" DROP CONSTRAINT "${CHILD_COMPOSITE}_parent_fk"`,
    );
    await client.query(
      `INSERT INTO "${CHILD_COMPOSITE}" (id, org_id, item_id) VALUES ($1, $2, $3)`,
      [orphanId, orgA, itemX],
    );
    await client.query(`
      ALTER TABLE "${CHILD_COMPOSITE}"
        ADD CONSTRAINT "${CHILD_COMPOSITE}_parent_fk"
        FOREIGN KEY (org_id, item_id)
        REFERENCES "${PARENT_COMPOSITE}"(org_id, item_id)
        ON DELETE CASCADE
        NOT VALID
    `);
    return { orphanId, legitimateId };
  }

  function compositeCascadeFk(): FkInfo {
    return {
      childTable: CHILD_COMPOSITE,
      childColumns: ['org_id', 'item_id'],
      parentTable: PARENT_COMPOSITE,
      parentColumns: ['org_id', 'item_id'],
      onDelete: 'cascade',
    };
  }

  it('deletes orphan rows behind a CASCADE FK and lets the constraint validate afterwards', async () => {
    const orphanId = await plantOrphanWithCascadeFk();

    // Sanity: the orphan really is there before the cleanup runs.
    const before = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "${CHILD_CASCADE}" WHERE id = $1`,
      [orphanId],
    );
    expect(before.rows[0].n).toBe(1);

    // The FK is currently NOT VALID — validating it right now must
    // fail with a foreign_key_violation, otherwise the test isn't
    // actually exercising the failure mode the cleanup is supposed to
    // unblock.
    await expect(
      client.query(
        `ALTER TABLE "${CHILD_CASCADE}" VALIDATE CONSTRAINT "${CHILD_CASCADE}_parent_fk"`,
      ),
    ).rejects.toMatchObject({ code: '23503' });

    const result = await runCleanup({
      client,
      fks: [cascadeFk()],
      log: () => undefined,
    });

    expect(result.fatalReports).toEqual([]);
    expect(result.cleanedTotal).toBe(1);
    expect(result.perFk).toHaveLength(1);
    expect(result.perFk[0]).toMatchObject({
      action: 'deleted',
      rows: 1,
    });

    const after = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "${CHILD_CASCADE}" WHERE id = $1`,
      [orphanId],
    );
    expect(after.rows[0].n).toBe(0);

    // Now that the orphan is gone, the FK must validate cleanly —
    // this is the exact precondition `drizzle-kit push --force`
    // needs in CI.
    await expect(
      client.query(
        `ALTER TABLE "${CHILD_CASCADE}" VALIDATE CONSTRAINT "${CHILD_CASCADE}_parent_fk"`,
      ),
    ).resolves.toBeDefined();
  }, 60000);

  it('refuses to auto-clean orphans behind a NO ACTION FK and reports table, columns, and a sample id', async () => {
    const orphanId = await plantOrphanWithNoActionFk();

    const result = await runCleanup({
      client,
      fks: [noActionFk()],
      log: () => undefined,
    });

    // Must surface the orphan as fatal — that is the contract the
    // failing CI run is supposed to lean on instead of letting
    // drizzle-kit push die mysteriously.
    expect(result.cleanedTotal).toBe(0);
    expect(result.fatalReports).toHaveLength(1);
    const report = result.fatalReports[0];
    expect(report.fk.childTable).toBe(CHILD_NOACTION);
    expect(report.fk.childColumns).toEqual(['parent_id']);
    expect(report.fk.parentTable).toBe(PARENT);
    expect(report.fk.parentColumns).toEqual(['id']);
    expect(report.orphanCount).toBe(1);
    expect(report.sampleIds).toContain(orphanId);

    // The script's `main()` wraps the same report list in a fatal
    // error; `buildFatalMessage` is the function it uses to do so.
    // Importing it directly lets us assert the operator-facing
    // message shape without coupling to the CLI exit path.
    const { buildFatalMessage } = await import('../../scripts/clean-orphan-fk-rows');
    const msg = buildFatalMessage(result.fatalReports);
    expect(msg).toContain(CHILD_NOACTION);
    expect(msg).toContain('parent_id');
    expect(msg).toContain(PARENT);
    expect(msg).toContain(orphanId);
    expect(msg).toContain('orphan row(s)');
    expect(msg).toContain('docs/INTEGRATION_DB_ORPHAN_CLEANUP.md');

    // The orphan must still be in place — refusing to act is a hard
    // stop, not a partial fix.
    const stillThere = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "${CHILD_NOACTION}" WHERE id = $1`,
      [orphanId],
    );
    expect(stillThere.rows[0].n).toBe(1);
  }, 60000);

  it('main() rejects (driving a non-zero CLI exit) when a NO ACTION FK has orphans', async () => {
    // Repro the same fatal shape, but this time drive the CLI
    // entrypoint itself. The CLI guard at the bottom of the script
    // does `main().catch(() => process.exit(1))`, so locking in that
    // `main()` rejects with the operator-facing message is what
    // guarantees CI fails loudly rather than continuing silently
    // when an unsafe orphan is present. Code-review feedback on the
    // first pass of this suite specifically called for this layer.
    const orphanId = await plantOrphanWithNoActionFk();

    // Silence the informational `console.log` calls inside `main()`
    // so the test output stays focused on the failure assertion.
    const origLog = console.log;
    console.log = () => undefined;
    let rejection: Error | undefined;
    try {
      await main({ client, fks: [noActionFk()] }).catch((err: unknown) => {
        rejection = err as Error;
      });
    } finally {
      console.log = origLog;
    }

    expect(rejection).toBeInstanceOf(Error);
    const msg = rejection!.message;
    expect(msg).toContain('Refusing to auto-clean');
    expect(msg).toContain(CHILD_NOACTION);
    expect(msg).toContain('parent_id');
    expect(msg).toContain(PARENT);
    expect(msg).toContain(orphanId);
    expect(msg).toContain('docs/INTEGRATION_DB_ORPHAN_CLEANUP.md');

    // And — same as the lower-level test — the orphan must still be
    // in place. The CLI throwing must NOT also half-clean the row.
    const stillThere = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "${CHILD_NOACTION}" WHERE id = $1`,
      [orphanId],
    );
    expect(stillThere.rows[0].n).toBe(1);
  }, 60000);

  it('honours SKIP_ORPHAN_FK_CLEANUP=1 and leaves a seeded orphan untouched', async () => {
    const orphanId = await plantOrphanWithCascadeFk();

    const previous = process.env.SKIP_ORPHAN_FK_CLEANUP;
    process.env.SKIP_ORPHAN_FK_CLEANUP = '1';
    try {
      // Re-import the module fresh so the SKIP gate inside `main()` is
      // re-evaluated. We deliberately go through `main()` (the
      // entrypoint that actually reads the env) rather than
      // `runCleanup` directly, because the documented opt-out lives
      // at the entrypoint layer.
      jest.resetModules();
      const mod = await import('../../scripts/clean-orphan-fk-rows');
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (msg: unknown, ...rest: unknown[]) => {
        logs.push([msg, ...rest].map(String).join(' '));
      };
      try {
        await mod.main();
      } finally {
        console.log = origLog;
      }
      expect(logs.some((l) => l.includes('skip: SKIP_ORPHAN_FK_CLEANUP=1'))).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.SKIP_ORPHAN_FK_CLEANUP;
      } else {
        process.env.SKIP_ORPHAN_FK_CLEANUP = previous;
      }
    }

    // Orphan still present — proof the SKIP path actually short-
    // circuited instead of silently running the cleanup anyway.
    const stillThere = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "${CHILD_CASCADE}" WHERE id = $1`,
      [orphanId],
    );
    expect(stillThere.rows[0].n).toBe(1);
  }, 60000);

  it('NULLs the FK column behind a SET NULL FK, preserves the row, and lets the constraint validate afterwards (Task #1184)', async () => {
    const orphanId = await plantOrphanWithSetNullFk();

    // Sanity: the orphan really is there with a non-NULL ghost parent
    // before the cleanup runs. Otherwise the test would pass trivially
    // even if `cleanOrphans` never touched the row.
    const before = await client.query<{ n: number; parent_id: string | null }>(
      `SELECT count(*)::int AS n, max(parent_id::text) AS parent_id
         FROM "${CHILD_SETNULL}" WHERE id = $1`,
      [orphanId],
    );
    expect(before.rows[0].n).toBe(1);
    expect(before.rows[0].parent_id).not.toBeNull();

    // The FK is currently NOT VALID — validating it right now must
    // fail with foreign_key_violation, otherwise the test isn't
    // actually exercising the failure mode the cleanup is supposed to
    // unblock for `set null` constraints.
    await expect(
      client.query(
        `ALTER TABLE "${CHILD_SETNULL}" VALIDATE CONSTRAINT "${CHILD_SETNULL}_parent_fk"`,
      ),
    ).rejects.toMatchObject({ code: '23503' });

    const result = await runCleanup({
      client,
      fks: [setNullFk()],
      log: () => undefined,
    });

    expect(result.fatalReports).toEqual([]);
    expect(result.cleanedTotal).toBe(1);
    expect(result.perFk).toHaveLength(1);
    expect(result.perFk[0]).toMatchObject({
      action: 'nulled',
      rows: 1,
    });

    // Row preserved (NOT deleted), FK column NULL — the contract of
    // the `set null` branch.
    const after = await client.query<{ n: number; parent_id: string | null }>(
      `SELECT count(*)::int AS n, max(parent_id::text) AS parent_id
         FROM "${CHILD_SETNULL}" WHERE id = $1`,
      [orphanId],
    );
    expect(after.rows[0].n).toBe(1);
    expect(after.rows[0].parent_id).toBeNull();

    // And the previously-NOT VALID FK now validates cleanly — the
    // exact precondition `drizzle-kit push --force` needs in CI for
    // `set null` constraints, mirroring the cascade case above.
    await expect(
      client.query(
        `ALTER TABLE "${CHILD_SETNULL}" VALIDATE CONSTRAINT "${CHILD_SETNULL}_parent_fk"`,
      ),
    ).resolves.toBeDefined();
  }, 60000);

  it('handles composite (multi-column) CASCADE FKs: deletes only the orphan, preserves the matching child, and validates afterwards (Task #1195)', async () => {
    // The cleanup script builds its join + IS NOT NULL clauses by
    // iterating over `fk.childColumns` / `fk.parentColumns`, so it
    // already supports composite FKs in production. The other tests in
    // this file only ever exercise that loop once (single-column FKs),
    // which means a regression in the multi-column construction
    // (swapped column order, missing `AND` between conditions, off-by-
    // one indexing into `parentColumns`) would slip through. This test
    // closes that gap by:
    //   * planting one legitimate (matching) child row, so a wrong-
    //     ordering or missing-`AND` bug that mis-identifies it as an
    //     orphan would be caught by the surviving-row assertion below;
    //   * planting one true orphan whose `(org_id, item_id)` pair
    //     does NOT exist in the parent, so a join that drops the
    //     second condition would erroneously match it against the
    //     legitimate parent and miss the orphan entirely.
    const { orphanId, legitimateId } = await plantCompositeFixture();

    // Sanity: both rows present (legitimate + orphan) before cleanup.
    const before = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "${CHILD_COMPOSITE}"`,
    );
    expect(before.rows[0].n).toBe(2);

    // The composite FK is currently NOT VALID — validating it right now
    // must fail with foreign_key_violation, otherwise the test isn't
    // actually exercising the failure mode the cleanup is supposed to
    // unblock for composite constraints.
    await expect(
      client.query(
        `ALTER TABLE "${CHILD_COMPOSITE}" VALIDATE CONSTRAINT "${CHILD_COMPOSITE}_parent_fk"`,
      ),
    ).rejects.toMatchObject({ code: '23503' });

    const result = await runCleanup({
      client,
      fks: [compositeCascadeFk()],
      log: () => undefined,
    });

    expect(result.fatalReports).toEqual([]);
    expect(result.cleanedTotal).toBe(1);
    expect(result.perFk).toHaveLength(1);
    expect(result.perFk[0]).toMatchObject({
      action: 'deleted',
      rows: 1,
    });

    // Orphan deleted, legitimate row preserved — the surviving-row
    // assertion is the regression catch for a swapped-column-order or
    // missing-`AND` bug in the join construction.
    const orphanGone = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "${CHILD_COMPOSITE}" WHERE id = $1`,
      [orphanId],
    );
    expect(orphanGone.rows[0].n).toBe(0);
    const legitimateStill = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "${CHILD_COMPOSITE}" WHERE id = $1`,
      [legitimateId],
    );
    expect(legitimateStill.rows[0].n).toBe(1);

    // And the previously-NOT VALID composite FK now validates cleanly,
    // mirroring the single-column cascade case above. This is the
    // exact precondition `drizzle-kit push --force` needs in CI for
    // composite constraints.
    await expect(
      client.query(
        `ALTER TABLE "${CHILD_COMPOSITE}" VALIDATE CONSTRAINT "${CHILD_COMPOSITE}_parent_fk"`,
      ),
    ).resolves.toBeDefined();
  }, 60000);

  it('reportOnly: true never writes — counts orphans behind cascade AND set-null FKs but leaves both rows untouched (Task #1203)', async () => {
    // `--report-only` (and the `ORPHAN_CLEANUP_REPORT_ONLY=1` env var)
    // is one of the script's documented safety knobs: operators flip
    // it on in CI to see what *would* be cleaned before letting the
    // script actually mutate data. A regression that let `reportOnly`
    // fall through to the DELETE / UPDATE branch in `cleanOrphans`
    // would silently destroy data the next time someone reached for
    // the "safe" mode, so we lock in the contract here against both
    // auto-cleanable branches at once: the cascade DELETE path and
    // the set-null UPDATE path. If either branch ever started writing
    // in report-only mode, the surviving-row assertion below would
    // catch it.
    const cascadeOrphanId = await plantOrphanWithCascadeFk();
    const setNullOrphanId = await plantOrphanWithSetNullFk();

    // Capture the set-null orphan's pre-cleanup `parent_id` so we can
    // assert it's still pointing at the same ghost parent afterwards
    // (i.e. the UPDATE ... SET parent_id = NULL branch never ran).
    const setNullBefore = await client.query<{ parent_id: string | null }>(
      `SELECT parent_id::text AS parent_id FROM "${CHILD_SETNULL}" WHERE id = $1`,
      [setNullOrphanId],
    );
    expect(setNullBefore.rows[0].parent_id).not.toBeNull();
    const ghostParentBefore = setNullBefore.rows[0].parent_id;

    const result = await runCleanup({
      client,
      fks: [cascadeFk(), setNullFk()],
      reportOnly: true,
      log: () => undefined,
    });

    // No fatals (both FKs are auto-cleanable shapes), nothing cleaned,
    // and BOTH per-FK entries report `action: 'reported'` with the
    // orphan count surfaced for triage.
    expect(result.fatalReports).toEqual([]);
    expect(result.cleanedTotal).toBe(0);
    expect(result.perFk).toHaveLength(2);
    for (const entry of result.perFk) {
      expect(entry.action).toBe('reported');
      expect(entry.rows).toBe(1);
    }

    // The cascade orphan must still be in place — proof the DELETE
    // branch never ran.
    const cascadeStill = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "${CHILD_CASCADE}" WHERE id = $1`,
      [cascadeOrphanId],
    );
    expect(cascadeStill.rows[0].n).toBe(1);

    // The set-null orphan must still be in place AND its FK column
    // must still point at the same ghost parent — proof the UPDATE
    // branch never ran. Asserting the value (not just non-NULL) catches
    // a regression where report-only somehow re-NULLed and re-set the
    // column to a different value.
    const setNullStill = await client.query<{ n: number; parent_id: string | null }>(
      `SELECT count(*)::int AS n, max(parent_id::text) AS parent_id
         FROM "${CHILD_SETNULL}" WHERE id = $1`,
      [setNullOrphanId],
    );
    expect(setNullStill.rows[0].n).toBe(1);
    expect(setNullStill.rows[0].parent_id).toBe(ghostParentBefore);
  }, 60000);

  it('collectForeignKeys discovers at least one Drizzle-modeled FK so the introspection step still works', () => {
    // Lightweight regression guard: if a future schema refactor breaks
    // the introspection (e.g. a tables export change drops the FK
    // metadata), the rest of the cleanup is silently a no-op. Catching
    // that here is much cheaper than waiting for the next FK-bearing
    // schema change to fail in CI.
    const fks = collectForeignKeys();
    expect(fks.length).toBeGreaterThan(0);
    for (const fk of fks) {
      expect(fk.childTable).toBeTruthy();
      expect(fk.childColumns.length).toBeGreaterThan(0);
      expect(fk.parentTable).toBeTruthy();
      expect(fk.parentColumns.length).toBe(fk.childColumns.length);
    }
  });
});
