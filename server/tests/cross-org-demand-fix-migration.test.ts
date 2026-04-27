import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../db';
import { organizations, buildings, residences, demands } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Regression tests for migration 0015_fix_cross_org_demand_residence_ids.sql
 * and the /api/health `crossOrgDemands` drift healthcheck query.
 *
 * These tests write to a real Postgres database and are skipped when only
 * a stub DATABASE_URL is present (e.g. localhost-only Jest runs).
 */

const REAL_DB_AVAILABLE =
  typeof process.env.DATABASE_URL === 'string' &&
  !process.env.DATABASE_URL.includes('localhost');

const describeOrSkip = REAL_DB_AVAILABLE ? describe : describe.skip;

/** Inline SQL that mirrors migration 0015 exactly. */
const MIGRATION_UPDATE_SQL = sql`
  UPDATE demands
  SET    residence_id = NULL
  WHERE  residence_id IS NOT NULL
    AND  building_id <> (
           SELECT r.building_id
           FROM   residences r
           WHERE  r.id = demands.residence_id
         )
`;

/** The same post-condition query used by the migration DO block. */
const CROSS_ORG_COUNT_SQL = sql`
  SELECT count(*)::int AS cross_org_demands
  FROM demands d
  JOIN residences r ON r.id = d.residence_id
  WHERE r.building_id <> d.building_id
`;

function getCrossOrgCount(rows: unknown[]): number {
  return (rows[0] as { cross_org_demands: number }).cross_org_demands;
}

describeOrSkip('migration 0015 – fix cross-org demand residence_ids', () => {
  let org1Id: string;
  let org2Id: string;
  let building1Id: string;
  let building2Id: string;
  let residence2Id: string;
  let demandId: string;

  beforeAll(async () => {
    const [org1] = await db
      .insert(organizations)
      .values({
        name: 'Test Org 1 – 0015-migration',
        type: 'syndicate',
        address: '1 Migration Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A 1A1',
        isActive: true,
      })
      .returning();
    org1Id = org1.id;

    const [org2] = await db
      .insert(organizations)
      .values({
        name: 'Test Org 2 – 0015-migration',
        type: 'syndicate',
        address: '2 Migration Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1B 1B1',
        isActive: true,
      })
      .returning();
    org2Id = org2.id;

    const [building1] = await db
      .insert(buildings)
      .values({
        name: 'Migration Test Building 1',
        address: '1 Building St',
        city: 'Montreal',
        postalCode: 'H1A 1A1',
        organizationId: org1Id,
        totalUnits: 4,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building1Id = building1.id;

    const [building2] = await db
      .insert(buildings)
      .values({
        name: 'Migration Test Building 2',
        address: '2 Building St',
        city: 'Montreal',
        postalCode: 'H1B 1B1',
        organizationId: org2Id,
        totalUnits: 4,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building2Id = building2.id;

    // Residence belongs to building 2 (org 2).
    const [residence2] = await db
      .insert(residences)
      .values({
        buildingId: building2Id,
        unitNumber: 'M-201',
        floor: 2,
        monthlyFees: '1200.00',
        isActive: true,
      })
      .returning();
    residence2Id = residence2.id;

    // Cross-org demand: building_id → org 1, residence_id → org 2.
    // Disable the trigger to reproduce legacy data that pre-dates the
    // 0010 guard (the exact condition migration 0015 is designed to fix).
    await db.execute(
      sql`ALTER TABLE demands DISABLE TRIGGER demands_residence_building_check`,
    );
    try {
      const [demand] = await db
        .insert(demands)
        .values({
          buildingId: building1Id,
          residenceId: residence2Id,
          type: 'other',
          status: 'draft',
          description: 'Cross-org demand seeded for migration-0015 regression test',
        })
        .returning();
      demandId = demand.id;
    } finally {
      await db.execute(
        sql`ALTER TABLE demands ENABLE TRIGGER demands_residence_building_check`,
      );
    }
  }, 30_000);

  afterAll(async () => {
    if (demandId)
      await db.delete(demands).where(eq(demands.id, demandId)).catch(() => undefined);
    if (residence2Id)
      await db.delete(residences).where(eq(residences.id, residence2Id)).catch(() => undefined);
    if (building1Id)
      await db.delete(buildings).where(eq(buildings.id, building1Id)).catch(() => undefined);
    if (building2Id)
      await db.delete(buildings).where(eq(buildings.id, building2Id)).catch(() => undefined);
    if (org1Id)
      await db.delete(organizations).where(eq(organizations.id, org1Id)).catch(() => undefined);
    if (org2Id)
      await db.delete(organizations).where(eq(organizations.id, org2Id)).catch(() => undefined);
  }, 30_000);

  it('seeds a cross-org demand row (pre-condition)', async () => {
    // Confirm the violating row exists before we run the migration SQL.
    const result = await db.execute(CROSS_ORG_COUNT_SQL);
    const count = getCrossOrgCount(result.rows);
    expect(count).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('NULLs residence_id and preserves building_id on the offending demand', async () => {
    await db.execute(MIGRATION_UPDATE_SQL);

    const [row] = await db
      .select({
        id: demands.id,
        buildingId: demands.buildingId,
        residenceId: demands.residenceId,
      })
      .from(demands)
      .where(eq(demands.id, demandId));

    expect(row).toBeDefined();
    // building_id must be preserved — only the cross-org residence link is removed.
    expect(row.buildingId).toBe(building1Id);
    expect(row.residenceId).toBeNull();
  }, 30_000);

  it('post-condition: zero cross-org demand rows remain after the migration', async () => {
    const result = await db.execute(CROSS_ORG_COUNT_SQL);
    const count = getCrossOrgCount(result.rows);
    expect(count).toBe(0);
  }, 30_000);

  it('is idempotent: re-running the UPDATE on a clean table affects 0 rows', async () => {
    // Running the migration SQL again must not throw and must be a no-op.
    await expect(db.execute(MIGRATION_UPDATE_SQL)).resolves.not.toThrow();

    const result = await db.execute(CROSS_ORG_COUNT_SQL);
    const count = getCrossOrgCount(result.rows);
    expect(count).toBe(0);
  }, 30_000);
});

describeOrSkip('/api/health crossOrgDemands drift healthcheck query', () => {
  let org1Id: string;
  let org2Id: string;
  let building1Id: string;
  let building2Id: string;
  let residence2Id: string;
  let demandId: string;

  afterAll(async () => {
    // Re-enable trigger in case a test left it disabled after an error.
    await db
      .execute(sql`ALTER TABLE demands ENABLE TRIGGER demands_residence_building_check`)
      .catch(() => undefined);
    if (demandId)
      await db.delete(demands).where(eq(demands.id, demandId)).catch(() => undefined);
    if (residence2Id)
      await db.delete(residences).where(eq(residences.id, residence2Id)).catch(() => undefined);
    if (building1Id)
      await db.delete(buildings).where(eq(buildings.id, building1Id)).catch(() => undefined);
    if (building2Id)
      await db.delete(buildings).where(eq(buildings.id, building2Id)).catch(() => undefined);
    if (org1Id)
      await db.delete(organizations).where(eq(organizations.id, org1Id)).catch(() => undefined);
    if (org2Id)
      await db.delete(organizations).where(eq(organizations.id, org2Id)).catch(() => undefined);
  }, 30_000);

  it('returns 0 on a clean fixture (no cross-org rows)', async () => {
    const result = await db.execute(CROSS_ORG_COUNT_SQL);
    const count = getCrossOrgCount(result.rows);
    // There must be no cross-org rows in a correctly migrated database.
    expect(count).toBe(0);
  }, 30_000);

  it('returns a non-zero count when a cross-org demand row is force-inserted', async () => {
    // Build the minimum fixture needed for the violation.
    const [org1] = await db
      .insert(organizations)
      .values({
        name: 'HC Test Org 1 – healthcheck',
        type: 'syndicate',
        address: '10 HC Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2A 2A2',
        isActive: true,
      })
      .returning();
    org1Id = org1.id;

    const [org2] = await db
      .insert(organizations)
      .values({
        name: 'HC Test Org 2 – healthcheck',
        type: 'syndicate',
        address: '20 HC Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2B 2B2',
        isActive: true,
      })
      .returning();
    org2Id = org2.id;

    const [building1] = await db
      .insert(buildings)
      .values({
        name: 'HC Building 1',
        address: '10 Building Rd',
        city: 'Montreal',
        postalCode: 'H2A 2A2',
        organizationId: org1Id,
        totalUnits: 2,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building1Id = building1.id;

    const [building2] = await db
      .insert(buildings)
      .values({
        name: 'HC Building 2',
        address: '20 Building Rd',
        city: 'Montreal',
        postalCode: 'H2B 2B2',
        organizationId: org2Id,
        totalUnits: 2,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building2Id = building2.id;

    const [residence2] = await db
      .insert(residences)
      .values({
        buildingId: building2Id,
        unitNumber: 'HC-101',
        floor: 1,
        monthlyFees: '900.00',
        isActive: true,
      })
      .returning();
    residence2Id = residence2.id;

    await db.execute(
      sql`ALTER TABLE demands DISABLE TRIGGER demands_residence_building_check`,
    );
    try {
      const [demand] = await db
        .insert(demands)
        .values({
          buildingId: building1Id,
          residenceId: residence2Id,
          type: 'other',
          status: 'draft',
          description: 'HC cross-org demand for healthcheck query test',
        })
        .returning();
      demandId = demand.id;
    } finally {
      await db.execute(
        sql`ALTER TABLE demands ENABLE TRIGGER demands_residence_building_check`,
      );
    }

    const result = await db.execute(CROSS_ORG_COUNT_SQL);
    const count = getCrossOrgCount(result.rows);
    expect(count).toBeGreaterThanOrEqual(1);
  }, 30_000);
});

/**
 * Task #1453: 0015 must be a TRUE no-op against `demands` once the
 * structural triggers (0010 / 0011 / 0012) keep the table clean.
 *
 * The first sub-test is a static assertion that runs without a DB:
 * it loads the migration SQL from disk and verifies the EXISTS probe
 * gate is in place. This protects future edits from accidentally
 * stripping the gate and re-introducing the unconditional UPDATE that
 * collided with the trigger DDL during concurrent-container boots
 * (the 5:11 AM incident addressed by Task #1443).
 *
 * The second sub-test runs the actual file end-to-end against a real
 * DB and asserts that `pg_stat_user_tables.n_tup_upd` for `demands`
 * does not increase across a steady-state pass — i.e. zero rows were
 * updated.
 */
describe('migration 0015 – steady-state probe gate (Task #1453)', () => {
  const MIGRATION_PATH = join(
    process.cwd(),
    'migrations',
    '0015_fix_cross_org_demand_residence_ids.sql',
  );

  it('contains an EXISTS probe gate around the cleanup UPDATE', () => {
    const ddl = readFileSync(MIGRATION_PATH, 'utf8');

    // The gate must short-circuit the UPDATE behind a read-only EXISTS
    // probe. We assert on the structural shape rather than the exact
    // wording so harmless re-formatting does not break the test.
    expect(ddl).toMatch(/SELECT\s+EXISTS\s*\(/i);
    expect(ddl).toMatch(/IF\s+has_violations\s+THEN/i);

    // The UPDATE must appear AFTER the probe assignment, so a steady-
    // state boot reaches the gate before any write candidate.
    const probeIdx = ddl.search(/SELECT\s+EXISTS\s*\(/i);
    const updateIdx = ddl.search(/UPDATE\s+demands/i);
    expect(probeIdx).toBeGreaterThanOrEqual(0);
    expect(updateIdx).toBeGreaterThan(probeIdx);
  });

  if (REAL_DB_AVAILABLE) {
    it(
      'issues zero UPDATEs against `demands` on a clean table',
      async () => {
        const ddl = readFileSync(MIGRATION_PATH, 'utf8');

        // Pre-flight: make sure the table is in steady state (no
        // cross-org rows). If it is not, abort the assertion with a
        // helpful message rather than producing a misleading result.
        const preCount = await db.execute(CROSS_ORG_COUNT_SQL);
        if (getCrossOrgCount(preCount.rows) !== 0) {
          throw new Error(
            'Pre-condition for steady-state probe test failed: ' +
              'cross-org demand rows already exist. Run the cleanup ' +
              'and retry.',
          );
        }

        // Use the transaction-scoped statistics view
        // (`pg_stat_xact_user_tables`) instead of the global one. Its
        // counters are updated SYNCHRONOUSLY inside the current
        // transaction (no stats-collector lag) and reset at xact end,
        // so this assertion is not subject to the timing/flakiness
        // window the global `pg_stat_user_tables` would expose under
        // concurrent CI activity. Running everything inside a single
        // transaction also isolates the probe pass from any
        // unrelated writes happening on the same connection pool.
        await db.transaction(async (tx) => {
          await tx.execute(sql.raw(ddl));

          const rows = await tx.execute(sql`
            SELECT COALESCE(n_tup_upd, 0)::bigint AS n
            FROM pg_stat_xact_user_tables
            WHERE relname = 'demands' AND schemaname = 'public'
          `);
          // Empty result row is expected when the table is untouched
          // in this xact; treat that as 0 updates.
          const updates = BigInt(
            (rows.rows[0] as { n: string | number } | undefined)?.n ?? 0,
          );

          expect(updates).toBe(0n);
        });
      },
      30_000,
    );
  } else {
    it.skip('issues zero UPDATEs against `demands` on a clean table (skipped: no real DATABASE_URL)', () => {});
  }
});
