/**
 * @jest-environment node
 *
 * Task #939 — `verifyMigrationsApplied()` is the single point that the
 * post-deploy verifier endpoint and the `--verify` CLI both call to
 * decide whether the live database matches the deployed bundle.
 *
 * The DB-touching path is exercised end-to-end by the staging deploy
 * (and by hitting `/api/admin/migration-status`); the unit test layer
 * pins the pure formatter that both surfaces use to render the result
 * so a refactor of the message wording can never silently change what
 * shows up in the deploy log / 503 response.
 */
import { describe, expect, it } from '@jest/globals';
// Import from the pure verifier helper module rather than the
// `run-migrations.ts` entry point: the latter has top-level
// `import.meta.url` usage that the Jest CJS loader cannot parse, and
// the helper exports the exact same symbols that `run-migrations.ts`
// re-exports for the boot-time verifier and the HTTP probe.
import {
  classifyDrift,
  describeDrift,
  formatVerification,
  type MigrationVerification,
} from '../../scripts/run-migrations-verifier-format';

function inSync(): MigrationVerification {
  return {
    inSync: true,
    driftKind: 'in-sync',
    highestExpected: '0013_residences_demand_assignation_check.sql',
    highestApplied: '0013_residences_demand_assignation_check.sql',
    missing: [],
    pendingCount: 0,
    source: 'DATABASE_URL_KOVEO',
    maskedDb: 'prod-koveo.example.com:5432/koveo',
  };
}

function drift(extra?: Partial<MigrationVerification>): MigrationVerification {
  return {
    inSync: false,
    driftKind: 'behind',
    highestExpected: '0013_residences_demand_assignation_check.sql',
    highestApplied: '0010_demands_residence_building_check.sql',
    missing: [
      '0011_residences_demand_building_check.sql',
      '0012_building_elements_residence_id_fk.sql',
      '0012_demands_assignation_check.sql',
      '0013_residences_demand_assignation_check.sql',
    ],
    pendingCount: 4,
    source: 'DATABASE_URL_KOVEO',
    maskedDb: 'prod-koveo.example.com:5432/koveo',
    ...extra,
  };
}

describe('formatVerification', () => {
  it('renders an OK line that names the masked db, source, and highest applied', () => {
    const line = formatVerification(inSync());
    expect(line).toContain('OK');
    expect(line).toContain('prod-koveo.example.com:5432/koveo');
    expect(line).toContain('via DATABASE_URL_KOVEO');
    expect(line).toContain('highest=0013_residences_demand_assignation_check.sql');
    // Drift wording must not appear when in-sync.
    expect(line).not.toContain('DRIFT');
    expect(line).not.toContain('missing=');
  });

  it('renders a DRIFT line that exposes the gap between expected and applied', () => {
    const line = formatVerification(drift());
    expect(line).toContain('DRIFT');
    expect(line).toContain('expected=0013_residences_demand_assignation_check.sql');
    expect(line).toContain('applied=0010_demands_residence_building_check.sql');
    expect(line).toContain('pending=4');
    expect(line).toContain('0011_residences_demand_building_check.sql');
    expect(line).toContain('0013_residences_demand_assignation_check.sql');
  });

  it('caps the missing-files preview at 5 entries with a "+N more" suffix', () => {
    const lots = Array.from({ length: 9 }, (_, i) => `00${20 + i}_extra.sql`);
    const line = formatVerification(
      drift({ missing: lots, pendingCount: lots.length }),
    );
    // First five must appear verbatim.
    for (const f of lots.slice(0, 5)) {
      expect(line).toContain(f);
    }
    // Anything past five must NOT be inlined.
    for (const f of lots.slice(5)) {
      expect(line).not.toContain(f);
    }
    expect(line).toContain('(+4 more)');
  });

  it('handles a fresh database with no migrations applied yet', () => {
    const line = formatVerification(
      drift({
        highestApplied: null,
        missing: ['0000_sparkling_korg.sql'],
        pendingCount: 1,
      }),
    );
    expect(line).toContain('applied=<none>');
    expect(line).toContain('pending=1');
  });

  it('handles a bundle with zero numbered migrations', () => {
    const line = formatVerification({
      ...inSync(),
      highestExpected: null,
      highestApplied: null,
    });
    expect(line).toContain('OK');
    expect(line).toContain('highest=<none>');
  });

  it('reports the source env var so an alias mix-up is grep-able', () => {
    const line = formatVerification({
      ...inSync(),
      source: 'PRODUCTION_DATABASE_URL',
    });
    expect(line).toContain('via PRODUCTION_DATABASE_URL');
    expect(line).not.toContain('via DATABASE_URL_KOVEO');
  });

  it('tags the drift line with the drift kind so grep can target each case', () => {
    expect(formatVerification(drift())).toContain('DRIFT [behind]');
    expect(
      formatVerification({
        ...drift(),
        driftKind: 'ahead',
        missing: [],
        pendingCount: 0,
        highestApplied: '9999_unknown.sql',
        highestExpected: '0013_residences_demand_assignation_check.sql',
      }),
    ).toContain('DRIFT [ahead]');
  });
});

describe('describeDrift', () => {
  it('returns null when in-sync (callers know there is nothing to do)', () => {
    expect(describeDrift(inSync())).toBeNull();
  });

  it('explains the "behind" case and points at `npm run migrate`', () => {
    const msg = describeDrift(drift())!;
    expect(msg).toContain('Re-run `npm run migrate`');
    expect(msg.toLowerCase()).toContain('live');
    // Must not falsely accuse the bundle of being older.
    expect(msg).not.toMatch(/older than the database/i);
  });

  it('explains the "ahead" case (DB has migrations the bundle does not)', () => {
    const msg = describeDrift({
      ...drift(),
      driftKind: 'ahead',
      missing: [],
      pendingCount: 0,
      highestApplied: '9999_unknown.sql',
    })!;
    expect(msg).toMatch(/older than the database|rollback/i);
    // Must not tell the operator to re-run the migrator — that would not
    // help when the bundle simply lacks the file.
    expect(msg).not.toContain('Re-run `npm run migrate`');
  });

  it('explains the "verifier-empty" packaging-bug case', () => {
    const msg = describeDrift({
      ...inSync(),
      inSync: false,
      driftKind: 'verifier-empty',
      highestExpected: null,
      highestApplied: null,
    })!;
    expect(msg).toMatch(/zero `migrations\/NNNN_\*\.sql` files/);
    expect(msg).toMatch(/packaging bug/i);
  });
});

describe('classifyDrift', () => {
  it('returns in-sync when bundle and DB match exactly', () => {
    expect(
      classifyDrift({
        highestExpected: '0013_x.sql',
        highestApplied: '0013_x.sql',
        missing: [],
      }),
    ).toEqual({ inSync: true, driftKind: 'in-sync' });
  });

  it('returns "behind" when disk has migrations the DB has not recorded', () => {
    expect(
      classifyDrift({
        highestExpected: '0013_x.sql',
        highestApplied: '0010_y.sql',
        missing: ['0011_a.sql', '0012_b.sql', '0013_x.sql'],
      }),
    ).toEqual({ inSync: false, driftKind: 'behind' });
  });

  it('returns "ahead" when DB has a migration that does not exist on disk', () => {
    // Mirrors the real anomaly we caught in dev: applied=0014 > expected=0013
    // with no missing files.
    expect(
      classifyDrift({
        highestExpected: '0013_x.sql',
        highestApplied: '0014_unknown.sql',
        missing: [],
      }),
    ).toEqual({ inSync: false, driftKind: 'ahead' });
  });

  it('returns "verifier-empty" when bundle ships zero migration files', () => {
    expect(
      classifyDrift({
        highestExpected: null,
        highestApplied: '0001_old.sql',
        missing: [],
      }),
    ).toEqual({ inSync: false, driftKind: 'verifier-empty' });
  });

  it('still flags "verifier-empty" when both bundle and DB are empty', () => {
    // Both listings empty would naively look "in sync", but in production
    // a deployed bundle with zero `migrations/NNNN_*.sql` files is almost
    // certainly a packaging bug (the build dropped the directory). We want
    // the operator to see drift, not a falsely-green check.
    expect(
      classifyDrift({
        highestExpected: null,
        highestApplied: null,
        missing: [],
      }),
    ).toEqual({ inSync: false, driftKind: 'verifier-empty' });
  });

  it('falls back to "behind" for a defensive non-strict mismatch', () => {
    // highestApplied < highestExpected but missing is empty (e.g. a hand-
    // edited schema_migrations row mismatch). Treat as "behind" so the
    // operator still gets a loud signal.
    expect(
      classifyDrift({
        highestExpected: '0013_x.sql',
        highestApplied: '0012_y.sql',
        missing: [],
      }),
    ).toEqual({ inSync: false, driftKind: 'behind' });
  });
});
