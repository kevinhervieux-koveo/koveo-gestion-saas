#!/usr/bin/env tsx
/**
 * One-time sweep: cancel pending invitations that reference deleted buildings
 * or residences.
 *
 * Task #383 added a soft-cancel cascade to delete_building and delete_residence
 * in the MCP server (server/mcp/server.ts), so newly deleted parents no longer
 * leave invitations dangling. But rows that were orphaned BEFORE that fix
 * shipped are still in the database with status='pending' and dangling
 * buildingId/residenceId. Those rows produce 500s when the user tries to
 * accept the invitation because the accept flow dereferences the missing
 * parent.
 *
 * This script mirrors the cascade behavior:
 *   - For every pending invitation whose buildingId no longer resolves in
 *     the `buildings` table, set status='cancelled' and null buildingId.
 *   - For every pending invitation whose residenceId no longer resolves in
 *     the `residences` table, set status='cancelled' and null residenceId.
 *   - A single invitation may have both columns dangling — both are nulled
 *     in the same UPDATE so we never leave a half-cleaned row behind.
 *   - Already-terminal invitations (accepted/cancelled/expired) are left
 *     alone so the audit trail is preserved.
 *
 * Writes an `invitation_audit_log` entry per swept invitation so operators
 * can later trace why these rows changed.
 *
 * Usage:
 *   npx tsx scripts/sweep-orphaned-invitations.ts             # apply the sweep
 *   npx tsx scripts/sweep-orphaned-invitations.ts --dry-run   # report counts only
 *
 * Exit codes:
 *   0 — success (including the no-orphans-found case)
 *   1 — query or update failed (transaction rolled back)
 */
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { invitationAuditLog } from '../shared/schemas/core';

interface OrphanRow {
  id: string;
  prior_building_id: string | null;
  prior_residence_id: string | null;
  building_dangling: boolean;
  residence_dangling: boolean;
}

/**
 * Result returned by `sweepOrphanedInvitations`. Lets callers (e.g. the
 * integration test in tests/integration/sweep-orphaned-invitations.test.ts)
 * assert exactly what the sweep observed and wrote without scraping
 * console output.
 */
export interface SweepResult {
  exitCode: number;
  detected: number;
  cancelled: number;
  buildingDangling: number;
  residenceDangling: number;
  bothDangling: number;
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Runs the orphan-invitation sweep against the active drizzle `db`
 * connection. Exported so integration tests can drive the sweep
 * directly against a real Postgres instance — see Task #496.
 *
 * Pass `dryRun: true` to report counts without writing anything.
 */
export async function sweepOrphanedInvitations(
  opts: { dryRun?: boolean } = {}
): Promise<SweepResult> {
  const dryRun = opts.dryRun ?? false;

  // Identify orphans first so we can report counts BEFORE writing. The
  // detection predicate is intentionally identical to the one used in the
  // UPDATE below so the reported count matches the rows we touch.
  const findSql = sql`
    SELECT
      id,
      building_id AS prior_building_id,
      residence_id AS prior_residence_id,
      (building_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM buildings b WHERE b.id = invitations.building_id))
        AS building_dangling,
      (residence_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM residences r WHERE r.id = invitations.residence_id))
        AS residence_dangling
    FROM invitations
    WHERE status = 'pending'
      AND (
        (building_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM buildings b WHERE b.id = invitations.building_id))
        OR (residence_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM residences r WHERE r.id = invitations.residence_id))
      )
  `;

  let orphans: OrphanRow[];
  try {
    const result = await db.execute(findSql);
    orphans = result.rows as unknown as OrphanRow[];
  } catch (err) {
    console.error(`[sweep-invitations] Failed to query invitations: ${describeError(err)}`);
    return {
      exitCode: 1,
      detected: 0,
      cancelled: 0,
      buildingDangling: 0,
      residenceDangling: 0,
      bothDangling: 0,
    };
  }

  const total = orphans.length;
  const buildingDangling = orphans.filter((o) => o.building_dangling).length;
  const residenceDangling = orphans.filter((o) => o.residence_dangling).length;
  const bothDangling = orphans.filter((o) => o.building_dangling && o.residence_dangling).length;

  console.log(
    `[sweep-invitations] Found ${total} orphaned pending invitation(s): ` +
      `${buildingDangling} with dangling buildingId, ` +
      `${residenceDangling} with dangling residenceId, ` +
      `${bothDangling} with both.`
  );

  if (total === 0) {
    console.log('[sweep-invitations] Nothing to do.');
    return {
      exitCode: 0,
      detected: 0,
      cancelled: 0,
      buildingDangling,
      residenceDangling,
      bothDangling,
    };
  }

  if (dryRun) {
    console.log('[sweep-invitations] DRY RUN — no writes performed.');
    for (const o of orphans) {
      console.log(
        `  ${o.id} buildingId=${o.prior_building_id ?? 'null'}` +
          `${o.building_dangling ? '(MISSING)' : ''} ` +
          `residenceId=${o.prior_residence_id ?? 'null'}` +
          `${o.residence_dangling ? '(MISSING)' : ''}`
      );
    }
    return {
      exitCode: 0,
      detected: total,
      cancelled: 0,
      buildingDangling,
      residenceDangling,
      bothDangling,
    };
  }

  let cancelled = 0;
  try {
    cancelled = await db.transaction(async (tx) => {
      // Single UPDATE that mirrors the per-FK soft-cancel from
      // delete_building/delete_residence: cancel the row, null any FK
      // column whose target no longer exists, and bump updatedAt. The
      // CASE expressions ensure we never null a column that still points
      // at a live parent (e.g. residence-only orphans keep their valid
      // buildingId).
      const updateSql = sql`
        UPDATE invitations
        SET status = 'cancelled',
            building_id = CASE
              WHEN building_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM buildings b WHERE b.id = invitations.building_id)
              THEN NULL ELSE building_id END,
            residence_id = CASE
              WHEN residence_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM residences r WHERE r.id = invitations.residence_id)
              THEN NULL ELSE residence_id END,
            updated_at = NOW()
        WHERE status = 'pending'
          AND (
            (building_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM buildings b WHERE b.id = invitations.building_id))
            OR (residence_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM residences r WHERE r.id = invitations.residence_id))
          )
        RETURNING id
      `;
      const updateResult = await tx.execute(updateSql);
      const updatedRows = updateResult.rows as unknown as Array<{ id: string }>;

      // Audit-log every swept row so the cancellation is traceable later.
      // performedBy is left null because no specific user is performing
      // this maintenance operation; the action + details fields make the
      // origin obvious. invitation_audit_log.invitationId is ON DELETE
      // CASCADE, so these entries follow the invitation if it is ever
      // hard-deleted.
      if (updatedRows.length > 0) {
        await tx.insert(invitationAuditLog).values(
          updatedRows.map((row) => ({
            invitationId: row.id,
            action: 'cancelled',
            previousStatus: 'pending' as const,
            newStatus: 'cancelled' as const,
            details: {
              reason: 'swept orphaned invitation (post-task-383 cleanup)',
              source: 'scripts/sweep-orphaned-invitations.ts',
            },
          })),
        );
      }

      return updatedRows.length;
    });
  } catch (err) {
    console.error(`[sweep-invitations] Sweep failed (rolled back): ${describeError(err)}`);
    return {
      exitCode: 1,
      detected: total,
      cancelled: 0,
      buildingDangling,
      residenceDangling,
      bothDangling,
    };
  }

  console.log(`[sweep-invitations] Done. Cancelled ${cancelled} invitation(s).`);
  if (cancelled !== total) {
    console.warn(
      `[sweep-invitations] WARNING: detection found ${total} orphans but UPDATE touched ` +
        `${cancelled} rows. Concurrent writes may have shifted the result set; ` +
        `re-run the script to verify the database is clean.`
    );
  }
  return {
    exitCode: 0,
    detected: total,
    cancelled,
    buildingDangling,
    residenceDangling,
    bothDangling,
  };
}

async function main(): Promise<number> {
  const dryRun = process.argv.includes('--dry-run');
  const result = await sweepOrphanedInvitations({ dryRun });
  return result.exitCode;
}

// Only auto-run when invoked as a script (e.g. `tsx scripts/sweep-orphaned-invitations.ts`).
// The basename check works in both ESM (tsx — where `require.main` is unavailable)
// and CJS (Jest's transform — where `process.argv[1]` is the jest binary, not this
// module) without needing `import.meta`. When the test imports
// `sweepOrphanedInvitations` directly, the IIFE below is skipped and the test
// drives the function on its own terms.
const isMainScript =
  typeof process !== 'undefined' &&
  typeof process.argv[1] === 'string' &&
  /[/\\]sweep-orphaned-invitations\.(ts|js|mjs|cjs)$/.test(process.argv[1]);

if (isMainScript) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`[sweep-invitations] Unexpected error: ${describeError(err)}`);
      process.exit(1);
    }
  );
}
