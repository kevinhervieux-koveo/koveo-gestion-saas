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
 *
 * Task #948 — additionally pins the `unknown-applied` ghost-row
 * detection: a `schema_migrations` row whose filename is not in the
 * bundle on disk must trip drift even when it sorts BELOW the bundle's
 * highest expected file (i.e. `highestApplied === highestExpected`).
 * Without this coverage the simple "highest matches highest" check
 * would silently report `inSync: true` while the live DB carries
 * leftover enforcement triggers / tables from a parallel branch.
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
    unknownApplied: [],
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
    unknownApplied: [],
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
    expect(line).not.toContain('unknown=');
  });

  it('renders a DRIFT line that exposes the gap between expected and applied', () => {
    const line = formatVerification(drift());
    expect(line).toContain('DRIFT');
    expect(line).toContain('expected=0013_residences_demand_assignation_check.sql');
    expect(line).toContain('applied=0010_demands_residence_building_check.sql');
    expect(line).toContain('pending=4');
    expect(line).toContain('0011_residences_demand_building_check.sql');
    expect(line).toContain('0013_residences_demand_assignation_check.sql');
    // Even when there are no ghost rows, the unknown=[] segment is
    // always present so log scrapers / grep rules can pin a stable
    // line shape across drift kinds.
    expect(line).toContain('unknown=[<none>]');
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
        unknownApplied: ['9999_unknown.sql'],
        highestExpected: '0013_residences_demand_assignation_check.sql',
      }),
    ).toContain('DRIFT [ahead]');
    // Task #948: the new ghost-row case gets its own grep-able tag.
    expect(
      formatVerification({
        ...drift(),
        driftKind: 'unknown-applied',
        missing: [],
        pendingCount: 0,
        highestApplied: '0013_residences_demand_assignation_check.sql',
        unknownApplied: ['0009_invitations_fk_constraints.sql'],
      }),
    ).toContain('DRIFT [unknown-applied]');
  });

  it('exposes ghost-row filenames in an unknown=[...] segment with the same preview rules as missing=[...]', () => {
    // Single ghost row: appears verbatim.
    const single = formatVerification({
      ...drift(),
      driftKind: 'unknown-applied',
      missing: [],
      pendingCount: 0,
      highestApplied: '0013_residences_demand_assignation_check.sql',
      unknownApplied: ['0009_invitations_fk_constraints.sql'],
    });
    expect(single).toContain('unknown=[0009_invitations_fk_constraints.sql]');

    // Many ghost rows: cap at five with a +N more suffix, mirroring
    // the missing=[...] truncation so the line stays bounded even
    // when a parallel branch leaked a dozen rows at once.
    const ghosts = [
      '0009_invitations_fk_constraints.sql',
      '0011_documents_residence_building_check.sql',
      '0012_invoices_residence_building_check.sql',
      '0013_building_elements_residence_building_check.sql',
      '0015_extra_one.sql',
      '0016_extra_two.sql',
      '0017_extra_three.sql',
    ];
    const many = formatVerification({
      ...drift(),
      driftKind: 'unknown-applied',
      missing: [],
      pendingCount: 0,
      highestApplied: '0014_some_head.sql',
      highestExpected: '0014_some_head.sql',
      unknownApplied: ghosts,
    });
    for (const f of ghosts.slice(0, 5)) {
      expect(many).toContain(f);
    }
    for (const f of ghosts.slice(5)) {
      expect(many).not.toContain(f);
    }
    expect(many).toContain('(+2 more)');
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
      unknownApplied: ['9999_unknown.sql'],
    })!;
    expect(msg).toMatch(/older than the database|rollback/i);
    // Must not tell the operator to re-run the migrator — that would not
    // help when the bundle simply lacks the file.
    expect(msg).not.toContain('Re-run `npm run migrate`');
  });

  it('explains the "unknown-applied" ghost-row case (task #948)', () => {
    const msg = describeDrift({
      ...drift(),
      driftKind: 'unknown-applied',
      missing: [],
      pendingCount: 0,
      highestApplied: '0014_some_head.sql',
      highestExpected: '0014_some_head.sql',
      unknownApplied: ['0009_invitations_fk_constraints.sql'],
    })!;
    // The remediation must call out that the simple "highest matches"
    // check looked green so the operator understands why the previous
    // verifier missed this.
    expect(msg).toMatch(/highest/i);
    expect(msg).toMatch(/ghost|leftover|parallel branch/i);
    // Operator needs both remediations spelled out: commit the file
    // OR remove the stale row after reverting the underlying change.
    expect(msg).toMatch(/commit/i);
    expect(msg).toMatch(/schema_migrations/);
    // Re-running `npm run migrate` would do nothing here (the row is
    // already recorded) so we must NOT suggest it.
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
        unknownApplied: [],
      }),
    ).toEqual({ inSync: true, driftKind: 'in-sync' });
  });

  it('treats `unknownApplied` as optional for backward compatibility', () => {
    // Pre-task-#948 callers omit `unknownApplied`; the classifier must
    // still treat that as "no ghost rows detected" so existing
    // importers do not spuriously flip to drift.
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
        unknownApplied: [],
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
        unknownApplied: ['0014_unknown.sql'],
      }),
    ).toEqual({ inSync: false, driftKind: 'ahead' });
  });

  it('returns "unknown-applied" when a ghost row sorts BELOW the bundle head (task #948)', () => {
    // This is the exact scenario task #948 exists for: the live DB
    // carries `0009_invitations_fk_constraints.sql` (and friends),
    // none of which ship in the bundle on disk, but the bundle's head
    // (0014) also happens to be the highest applied row. Pre-#948 the
    // classifier saw `missing=[]` and `highestExpected===highestApplied`
    // and reported in-sync; now it must trip drift.
    expect(
      classifyDrift({
        highestExpected: '0014_drift_anomaly.sql',
        highestApplied: '0014_drift_anomaly.sql',
        missing: [],
        unknownApplied: [
          '0009_invitations_fk_constraints.sql',
          '0011_documents_residence_building_check.sql',
          '0012_invoices_residence_building_check.sql',
          '0013_building_elements_residence_building_check.sql',
        ],
      }),
    ).toEqual({ inSync: false, driftKind: 'unknown-applied' });
  });

  it('returns "unknown-applied" even when the only ghost row sorts BELOW a strictly-equal head', () => {
    // Single ghost row, highestApplied still equals highestExpected.
    // Confirms the new check does not require multiple rows.
    expect(
      classifyDrift({
        highestExpected: '0013_x.sql',
        highestApplied: '0013_x.sql',
        missing: [],
        unknownApplied: ['0010_ghost.sql'],
      }),
    ).toEqual({ inSync: false, driftKind: 'unknown-applied' });
  });

  it('prefers "behind" over "unknown-applied" when both signals fire', () => {
    // If the bundle is also missing a file, that is the more dangerous
    // direction (the deploy hook silently swallowed a failure) and
    // wins the kind tiebreak. The unknown rows are still reported via
    // `unknownApplied` for the operator, but the message points at the
    // higher-priority `behind` remediation first.
    expect(
      classifyDrift({
        highestExpected: '0013_x.sql',
        highestApplied: '0012_y.sql',
        missing: ['0013_x.sql'],
        unknownApplied: ['0010_ghost.sql'],
      }),
    ).toEqual({ inSync: false, driftKind: 'behind' });
  });

  it('prefers "ahead" over "unknown-applied" when the unknown row is also above the bundle head', () => {
    // `ahead` is a special-case of unknown-applied (the unknown row IS
    // the highest applied), but the operator remediation differs
    // (redeploy a matching bundle vs. backfill a ghost row), so it
    // keeps its own kind even when other ghost rows sit below.
    expect(
      classifyDrift({
        highestExpected: '0013_x.sql',
        highestApplied: '0015_unknown_top.sql',
        missing: [],
        unknownApplied: ['0010_ghost.sql', '0015_unknown_top.sql'],
      }),
    ).toEqual({ inSync: false, driftKind: 'ahead' });
  });

  it('returns "verifier-empty" when bundle ships zero migration files', () => {
    expect(
      classifyDrift({
        highestExpected: null,
        highestApplied: '0001_old.sql',
        missing: [],
        unknownApplied: ['0001_old.sql'],
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
        unknownApplied: [],
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
        unknownApplied: [],
      }),
    ).toEqual({ inSync: false, driftKind: 'behind' });
  });
});
