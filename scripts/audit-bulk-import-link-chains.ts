#!/usr/bin/env tsx
/**
 * Task #1269 — One-shot audit (and optional repair) of bidirectional
 * linking-chain corruption in bulk-import sessions.
 *
 * Why this exists
 * ===============
 * Task #1254 added a server-side guard that refuses to persist a
 * `set-linking-decision` (or batch variant) write whose *resulting*
 * session graph would be bidirectionally inconsistent — i.e. some row
 * has `afterItemId = Y` while `Y.beforeItemId` is anything other than
 * that row's own id. The guard works on the entire proposed session
 * state, not just the rows the admin is editing.
 *
 * That defensive shape has a sharp edge: any session that was *already*
 * corrupt before the guard shipped (legacy data, half-finished writes
 * from before Task #1254, a crashed batch, etc.) cannot be edited any
 * more. Every admin save bounces with an error pointing at rows the
 * admin never touched, with no clear path to recovery.
 *
 * This script is the recovery path. It loads every active bulk-import
 * session, runs the same shape of check the API uses, and prints every
 * row whose persisted `linkDecisions` violates bidirectional
 * consistency, naming the offending neighbor.
 *
 * Usage
 * =====
 *   npx tsx scripts/audit-bulk-import-link-chains.ts
 *       Read-only audit. Prints every offending session/item pair and
 *       exits 0 (clean) or 2 (corruption found).
 *
 *   npx tsx scripts/audit-bulk-import-link-chains.ts --session <id>
 *       Restrict the audit to a single session id.
 *
 *   npx tsx scripts/audit-bulk-import-link-chains.ts --repair
 *       Apply repairs: for every offending pointer, NULL it out so the
 *       row stops violating bidirectional consistency. Other
 *       `linkDecisions` keys (e.g. `manualOverride`) are preserved.
 *       Repairs run inside a single per-session transaction so the
 *       session is either fully cleaned or untouched.
 *
 *   npx tsx scripts/audit-bulk-import-link-chains.ts --repair --dry-run
 *       Print the repairs that would be applied without writing
 *       anything to the database.
 *
 * Exit codes
 * ==========
 *   0 — audit ran and the database is (now) clean
 *   1 — script crashed (DB unavailable, query error, etc.)
 *   2 — audit-only run found violations (caller decides what to do)
 */

import { db } from '../server/db';
import { eq } from 'drizzle-orm';
import * as schema from '../shared/schema';
import {
  findBidirectionalLinkInconsistencies,
  buildRepairPatchForItem,
  type LinkChainViolation,
} from '../server/api/bulk-import-link-diagnostics';

export interface AuditOptions {
  /** When set, audit/repair only this one session id. */
  sessionId?: string;
  /** When true, NULL-out offending pointers; otherwise read-only. */
  repair?: boolean;
  /** When true with `repair`, log what would change without writing. */
  dryRun?: boolean;
  /** Sink for human-readable output (defaults to console.log). */
  log?: (line: string) => void;
}

export interface SessionReport {
  sessionId: string;
  itemCount: number;
  violations: LinkChainViolation[];
  repaired: boolean;
}

export interface AuditResult {
  exitCode: 0 | 1 | 2;
  sessionsScanned: number;
  sessionsWithViolations: number;
  totalViolations: number;
  reports: SessionReport[];
}

function formatViolation(v: LinkChainViolation): string {
  return `    [${v.kind}] ${v.message}`;
}

/**
 * Drives the audit. Exposed (rather than inlined into `main`) so the
 * Jest integration test in
 * `tests/unit/api/bulk-import-link-diagnostics-script.test.ts` can run
 * the same control flow against a mocked db without spawning a child
 * process.
 */
export async function auditBulkImportLinkChains(
  options: AuditOptions = {},
): Promise<AuditResult> {
  const log = options.log ?? ((line: string) => console.log(line));
  const repair = options.repair === true;
  const dryRun = options.dryRun === true;

  // 1. Resolve the set of session ids to audit.
  let sessionIds: string[];
  if (options.sessionId) {
    sessionIds = [options.sessionId];
  } else {
    const rows = await db
      .select({ id: schema.bulkImportSessions.id })
      .from(schema.bulkImportSessions);
    sessionIds = rows.map((r) => r.id);
  }

  log(
    `[audit-bulk-import-link-chains] Scanning ${sessionIds.length} session(s)` +
      (repair ? (dryRun ? ' (repair --dry-run)' : ' (repair)') : ' (read-only)'),
  );

  const reports: SessionReport[] = [];
  let totalViolations = 0;

  for (const sessionId of sessionIds) {
    const items = await db
      .select({
        id: schema.bulkImportItems.id,
        linkDecisions: schema.bulkImportItems.linkDecisions,
      })
      .from(schema.bulkImportItems)
      .where(eq(schema.bulkImportItems.sessionId, sessionId));

    const violations = findBidirectionalLinkInconsistencies(items);
    const report: SessionReport = {
      sessionId,
      itemCount: items.length,
      violations,
      repaired: false,
    };

    if (violations.length === 0) {
      reports.push(report);
      continue;
    }

    totalViolations += violations.length;
    log(
      `\n[audit-bulk-import-link-chains] Session ${sessionId}: ${violations.length} violation(s) across ${items.length} item(s)`,
    );
    for (const v of violations) log(formatViolation(v));

    if (repair) {
      // Build the set of items that need a patch. NULL-out only the
      // pointer(s) the diagnostic flagged so we never collateral-damage
      // an unrelated, valid pointer on the same row.
      const offendingItemIds = Array.from(new Set(violations.map((v) => v.itemId)));

      if (dryRun) {
        log(
          `  --dry-run: would NULL pointers on ${offendingItemIds.length} item(s) in this session`,
        );
        reports.push(report);
        continue;
      }

      // Re-fetch the offending items inside a transaction so the
      // patch we apply preserves any unrelated keys
      // (`manualOverride`, etc.) that the diagnostic does not look at.
      await db.transaction(async (tx) => {
        for (const itemId of offendingItemIds) {
          const [current] = await tx
            .select({
              id: schema.bulkImportItems.id,
              linkDecisions: schema.bulkImportItems.linkDecisions,
            })
            .from(schema.bulkImportItems)
            .where(eq(schema.bulkImportItems.id, itemId));
          if (!current) continue;
          const patch = buildRepairPatchForItem(itemId, violations);
          if (!patch) continue;
          const existing = (current.linkDecisions ?? {}) as Record<string, unknown>;
          const next: Record<string, unknown> = { ...existing, ...patch };
          await tx
            .update(schema.bulkImportItems)
            .set({ linkDecisions: next, updatedAt: new Date() })
            .where(eq(schema.bulkImportItems.id, itemId));
        }
      });
      report.repaired = true;
      log(`  Repaired ${offendingItemIds.length} item(s).`);
    }

    reports.push(report);
  }

  const sessionsWithViolations = reports.filter((r) => r.violations.length > 0).length;

  log(
    `\n[audit-bulk-import-link-chains] Done. Scanned ${reports.length} session(s); ` +
      `${sessionsWithViolations} had violations; ${totalViolations} violation(s) total.`,
  );

  // Exit-code policy:
  //  - clean run                                        -> 0
  //  - violations found, repair ran (not dry-run), no
  //    failures during repair                            -> 0
  //  - violations found, audit-only or repair --dry-run  -> 2
  let exitCode: 0 | 2 = 0;
  if (sessionsWithViolations > 0 && (!repair || dryRun)) exitCode = 2;

  return {
    exitCode,
    sessionsScanned: reports.length,
    sessionsWithViolations,
    totalViolations,
    reports,
  };
}

function parseArgs(argv: readonly string[]): AuditOptions {
  const opts: AuditOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repair') opts.repair = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--session') {
      opts.sessionId = argv[i + 1];
      i++;
    } else if (a.startsWith('--session=')) {
      opts.sessionId = a.slice('--session='.length);
    }
  }
  return opts;
}

async function main(): Promise<number> {
  try {
    const result = await auditBulkImportLinkChains(parseArgs(process.argv.slice(2)));
    return result.exitCode;
  } catch (err) {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    console.error(`[audit-bulk-import-link-chains] Unexpected error: ${msg}`);
    return 1;
  }
}

// Auto-run only when invoked directly. The basename check works under
// both tsx (ESM, no `require.main`) and Jest's CJS transform without
// needing `import.meta`. When tests import the function directly the
// IIFE below is skipped and the test drives the function on its own
// terms.
const isMainScript =
  typeof process !== 'undefined' &&
  typeof process.argv[1] === 'string' &&
  /[/\\]audit-bulk-import-link-chains\.(ts|js|mjs|cjs)$/.test(process.argv[1]);

if (isMainScript) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`[audit-bulk-import-link-chains] Unexpected error: ${err}`);
      process.exit(1);
    },
  );
}
