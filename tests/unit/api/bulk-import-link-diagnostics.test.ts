/**
 * Task #1269 — Unit tests for the bidirectional linking-chain
 * diagnostic and the audit-script driver.
 *
 * The pure-function tests cover both halves of the "Done looks like"
 * checklist:
 *   - A clean session reports zero issues.
 *   - A corrupt session reports every offending row, names the
 *     neighbor, and survives every shape of corruption documented on
 *     Task #1254 (afterItemId pointing at a row that doesn't point
 *     back, beforeItemId pointing at a row that doesn't point back,
 *     pointer to a row that left the session, self-link).
 *
 * The script-driver tests round-trip the same diagnoses through
 * `auditBulkImportLinkChains` against an in-memory mock of the Drizzle
 * `db` so we exercise the actual reporting / repair control flow
 * without spinning up Postgres.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import {
  findBidirectionalLinkInconsistencies,
  buildRepairPatchForItem,
  type LinkChainItem,
} from '../../../server/api/bulk-import-link-diagnostics';

describe('findBidirectionalLinkInconsistencies (Task #1269)', () => {
  it('reports zero issues for an empty session', () => {
    expect(findBidirectionalLinkInconsistencies([])).toEqual([]);
  });

  it('reports zero issues for a fully-consistent chain a -> b -> c', () => {
    const items: LinkChainItem[] = [
      { id: 'a', linkDecisions: { beforeItemId: null, afterItemId: 'b', manualOverride: true } },
      { id: 'b', linkDecisions: { beforeItemId: 'a', afterItemId: 'c', manualOverride: true } },
      { id: 'c', linkDecisions: { beforeItemId: 'b', afterItemId: null, manualOverride: true } },
    ];
    expect(findBidirectionalLinkInconsistencies(items)).toEqual([]);
  });

  it('reports zero issues for items with no linkDecisions at all', () => {
    const items: LinkChainItem[] = [
      { id: 'a', linkDecisions: null },
      { id: 'b', linkDecisions: null },
      { id: 'c', linkDecisions: {} },
    ];
    expect(findBidirectionalLinkInconsistencies(items)).toEqual([]);
  });

  it('detects an unmirrored afterItemId and names the neighbor', () => {
    // a.after = b but b.before is null — the original Task #1254 shape.
    const items: LinkChainItem[] = [
      { id: 'a', linkDecisions: { beforeItemId: null, afterItemId: 'b' } },
      { id: 'b', linkDecisions: { beforeItemId: null, afterItemId: null } },
    ];
    const result = findBidirectionalLinkInconsistencies(items);
    expect(result).toHaveLength(1);
    const v = result[0];
    expect(v.kind).toBe('after_not_mirrored');
    expect(v.itemId).toBe('a');
    expect(v.field).toBe('after');
    expect(v.neighborId).toBe('b');
    expect(v.neighborMissing).toBe(false);
    if (v.kind === 'after_not_mirrored') {
      expect(v.neighborMirror).toBeNull();
    }
    expect(v.message).toMatch(/a/);
    expect(v.message).toMatch(/b/);
  });

  it('detects an unmirrored beforeItemId and names the neighbor', () => {
    // b.before = a but a.after is null.
    const items: LinkChainItem[] = [
      { id: 'a', linkDecisions: { beforeItemId: null, afterItemId: null } },
      { id: 'b', linkDecisions: { beforeItemId: 'a', afterItemId: null } },
    ];
    const result = findBidirectionalLinkInconsistencies(items);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('before_not_mirrored');
    expect(result[0].itemId).toBe('b');
    expect(result[0].neighborId).toBe('a');
  });

  it('detects a half-cleared middle item that orphans its former neighbors', () => {
    // Original chain a -> b -> c. Someone NULLed b's pointers without
    // re-wiring a and c. The diagnostic should report two violations
    // pointing at the dangling neighbors of the gap.
    const items: LinkChainItem[] = [
      { id: 'a', linkDecisions: { beforeItemId: null, afterItemId: 'b' } },
      { id: 'b', linkDecisions: { beforeItemId: null, afterItemId: null } },
      { id: 'c', linkDecisions: { beforeItemId: 'b', afterItemId: null } },
    ];
    const result = findBidirectionalLinkInconsistencies(items);
    const itemIds = result.map((v) => v.itemId).sort();
    expect(itemIds).toEqual(['a', 'c']);
    const fields = result.map((v) => `${v.itemId}.${v.field}`).sort();
    expect(fields).toEqual(['a.after', 'c.before']);
  });

  it('detects pointers at neighbors that are no longer in the session', () => {
    // a.after = ghost; ghost is gone. Likewise for b.before.
    const items: LinkChainItem[] = [
      { id: 'a', linkDecisions: { beforeItemId: null, afterItemId: 'ghost-1' } },
      { id: 'b', linkDecisions: { beforeItemId: 'ghost-2', afterItemId: null } },
    ];
    const result = findBidirectionalLinkInconsistencies(items);
    expect(result).toHaveLength(2);
    const byKind = Object.fromEntries(result.map((v) => [v.kind, v]));
    expect(byKind.after_neighbor_missing.itemId).toBe('a');
    expect(byKind.after_neighbor_missing.neighborId).toBe('ghost-1');
    expect(byKind.after_neighbor_missing.neighborMissing).toBe(true);
    expect(byKind.before_neighbor_missing.itemId).toBe('b');
    expect(byKind.before_neighbor_missing.neighborId).toBe('ghost-2');
    expect(byKind.before_neighbor_missing.neighborMissing).toBe(true);
  });

  it('detects self-links on either field', () => {
    const items: LinkChainItem[] = [
      { id: 'a', linkDecisions: { beforeItemId: null, afterItemId: 'a' } },
      { id: 'b', linkDecisions: { beforeItemId: 'b', afterItemId: null } },
    ];
    const result = findBidirectionalLinkInconsistencies(items);
    expect(result).toHaveLength(2);
    const fields = result.map((v) => `${v.itemId}.${v.field}`).sort();
    expect(fields).toEqual(['a.after', 'b.before']);
    for (const v of result) expect(v.kind).toBe('self_link');
  });

  it('does not flag a reference inside a fork (b.before = a, c.before = a, a.after = c)', () => {
    // Two rows both claim `a` as their `before`, but `a.after` only
    // mirrors one of them. The non-mirrored one must be reported.
    const items: LinkChainItem[] = [
      { id: 'a', linkDecisions: { beforeItemId: null, afterItemId: 'c' } },
      { id: 'b', linkDecisions: { beforeItemId: 'a', afterItemId: null } },
      { id: 'c', linkDecisions: { beforeItemId: 'a', afterItemId: null } },
    ];
    const result = findBidirectionalLinkInconsistencies(items);
    // a.after = c is mirrored by c.before = a, so a/c are clean.
    // b.before = a is NOT mirrored by a.after (which points at c), so
    // b is the only offending row.
    const offending = result.map((v) => `${v.itemId}.${v.field}`).sort();
    expect(offending).toEqual(['b.before']);
    expect(result[0].kind).toBe('before_not_mirrored');
  });
});

describe('buildRepairPatchForItem (Task #1269)', () => {
  it('returns null when the item has no violations', () => {
    expect(buildRepairPatchForItem('a', [])).toBeNull();
  });

  it('clears only the offending field on the item', () => {
    const items: LinkChainItem[] = [
      { id: 'a', linkDecisions: { beforeItemId: null, afterItemId: 'b' } },
      { id: 'b', linkDecisions: { beforeItemId: null, afterItemId: null } },
    ];
    const violations = findBidirectionalLinkInconsistencies(items);
    const patch = buildRepairPatchForItem('a', violations);
    expect(patch).toEqual({ afterItemId: null });
  });

  it('clears both fields when both pointers are flagged on the same item', () => {
    const items: LinkChainItem[] = [
      // a.before = ghost AND a.after = ghost2 (both missing).
      { id: 'a', linkDecisions: { beforeItemId: 'ghost-1', afterItemId: 'ghost-2' } },
    ];
    const violations = findBidirectionalLinkInconsistencies(items);
    const patch = buildRepairPatchForItem('a', violations);
    expect(patch).toEqual({ beforeItemId: null, afterItemId: null });
  });
});

/**
 * --------------------------------------------------------------------
 * Audit-script driver: runs the same flow against an in-memory mock of
 * the Drizzle `db` (so we exercise reporting + repair without Postgres)
 * and asserts both the clean and corrupt cases.
 * --------------------------------------------------------------------
 */

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

type LinkDecisions = {
  beforeItemId?: string | null;
  afterItemId?: string | null;
  manualOverride?: boolean;
};

type Row = { id: string; sessionId: string; linkDecisions: LinkDecisions | null };

const itemStore = new Map<string, Row>();
const sessionIds = new Set<string>();

function condValue(cond: any): unknown {
  if (!cond) return undefined;
  if ('value' in cond) return cond.value;
  return undefined;
}

function condColumnName(cond: any): string | undefined {
  return cond?.column?.name ?? cond?.column?.sqlName;
}

function buildSelectChain(projection?: any) {
  return {
    from: (table: any) => {
      const tableName = table?.[Symbol.for?.('drizzle:Name')] ?? table?._?.name ?? '';
      // Distinguish bulkImportSessions vs bulkImportItems by which
      // columns the projection asked for: only the items projection
      // includes `linkDecisions`. The fallback (no .where()) returns
      // every session id when the script is auditing all sessions.
      const isItemsTable = !!projection && 'linkDecisions' in projection;

      const builder: any = {
        where: (cond: any) => {
          const colName = condColumnName(cond);
          const value = condValue(cond) as string | undefined;
          if (isItemsTable) {
            if (colName === 'session_id') {
              return Promise.resolve(
                Array.from(itemStore.values()).filter((r) => r.sessionId === value),
              );
            }
            if (colName === 'id') {
              const r = value ? itemStore.get(value) : undefined;
              return Promise.resolve(r ? [r] : []);
            }
            return Promise.resolve([]);
          }
          // sessions table — only used when auditing a specific id,
          // which the script does without a where clause.
          return Promise.resolve([]);
        },
        // Awaitable: returns all rows from the relevant table.
        then: (resolve: any, reject: any) => {
          const rows = isItemsTable
            ? Array.from(itemStore.values())
            : Array.from(sessionIds).map((id) => ({ id }));
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

const mockDb: any = {
  select: jest.fn((projection?: any) => buildSelectChain(projection)),
  update: jest.fn(() => ({
    set: jest.fn((updates: Partial<Row>) => ({
      where: jest.fn((cond: any) => {
        const value = condValue(cond) as string | undefined;
        if (value && itemStore.has(value)) {
          const existing = itemStore.get(value)!;
          itemStore.set(value, { ...existing, ...updates });
        }
        const p: any = Promise.resolve();
        p.returning = () => Promise.resolve([]);
        return p;
      }),
    })),
  })),
  transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => {
    const tx: any = {
      select: (projection?: any) => buildSelectChain(projection),
      update: () => ({
        set: (updates: Partial<Row>) => ({
          where: (cond: any) => {
            const value = condValue(cond) as string | undefined;
            if (value && itemStore.has(value)) {
              const existing = itemStore.get(value)!;
              itemStore.set(value, { ...existing, ...updates });
            }
            const p: any = Promise.resolve();
            p.returning = () => Promise.resolve([]);
            return p;
          },
        }),
      }),
    };
    return fn(tx);
  }),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

// Imported AFTER the mocks above so the script wires up against the
// mocked db.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { auditBulkImportLinkChains } = require('../../../scripts/audit-bulk-import-link-chains');

function seed(sessionId: string, id: string, linkDecisions: LinkDecisions | null) {
  sessionIds.add(sessionId);
  itemStore.set(id, { id, sessionId, linkDecisions });
}

describe('auditBulkImportLinkChains (Task #1269)', () => {
  beforeEach(() => {
    itemStore.clear();
    sessionIds.clear();
    jest.clearAllMocks();
  });

  it('reports zero violations for a clean session and exits 0', async () => {
    seed('sess-1', 'a', { beforeItemId: null, afterItemId: 'b' });
    seed('sess-1', 'b', { beforeItemId: 'a', afterItemId: null });

    const lines: string[] = [];
    const result = await auditBulkImportLinkChains({ log: (l: string) => lines.push(l) });

    expect(result.exitCode).toBe(0);
    expect(result.sessionsScanned).toBe(1);
    expect(result.sessionsWithViolations).toBe(0);
    expect(result.totalViolations).toBe(0);
    expect(result.reports[0].violations).toEqual([]);
    expect(lines.join('\n')).toMatch(/0 had violations; 0 violation\(s\) total/);
  });

  it('detects pre-existing corruption, names the neighbor, and exits 2 in audit-only mode', async () => {
    // Pre-existing chain corruption (Task #1254 motivating case):
    // a.after = b but b.before is null — admin edits to *any* row in
    // this session would be rejected by the bidirectional guard.
    seed('sess-corrupt', 'a', { beforeItemId: null, afterItemId: 'b' });
    seed('sess-corrupt', 'b', { beforeItemId: null, afterItemId: null });

    const lines: string[] = [];
    const result = await auditBulkImportLinkChains({
      sessionId: 'sess-corrupt',
      log: (l: string) => lines.push(l),
    });

    expect(result.exitCode).toBe(2);
    expect(result.sessionsScanned).toBe(1);
    expect(result.sessionsWithViolations).toBe(1);
    expect(result.totalViolations).toBe(1);
    const report = result.reports[0];
    expect(report.sessionId).toBe('sess-corrupt');
    expect(report.violations[0].kind).toBe('after_not_mirrored');
    expect(report.violations[0].itemId).toBe('a');
    expect(report.violations[0].neighborId).toBe('b');
    expect(report.repaired).toBe(false);

    const out = lines.join('\n');
    expect(out).toMatch(/sess-corrupt/);
    expect(out).toMatch(/after_not_mirrored/);
    expect(out).toMatch(/item a has afterItemId = b/);
    // The store must not have been touched.
    expect(itemStore.get('a')!.linkDecisions).toEqual({
      beforeItemId: null,
      afterItemId: 'b',
    });
  });

  it('--repair --dry-run reports the planned repairs but writes nothing', async () => {
    seed('sess-corrupt', 'a', { beforeItemId: null, afterItemId: 'b' });
    seed('sess-corrupt', 'b', { beforeItemId: null, afterItemId: null });
    const beforeSnapshot = JSON.stringify(Array.from(itemStore.entries()));

    const lines: string[] = [];
    const result = await auditBulkImportLinkChains({
      sessionId: 'sess-corrupt',
      repair: true,
      dryRun: true,
      log: (l: string) => lines.push(l),
    });

    expect(result.exitCode).toBe(2);
    expect(result.reports[0].repaired).toBe(false);
    expect(lines.join('\n')).toMatch(/--dry-run: would NULL pointers on 1 item/);
    expect(JSON.stringify(Array.from(itemStore.entries()))).toBe(beforeSnapshot);
  });

  it('--repair clears the dangling pointer, preserves manualOverride, and exits 0', async () => {
    // The offending pointer is on `a`. After repair, a.afterItemId
    // should be null, but `manualOverride: true` must survive so the
    // wizard still shows the "Manual" badge.
    seed('sess-corrupt', 'a', { beforeItemId: null, afterItemId: 'b', manualOverride: true });
    seed('sess-corrupt', 'b', { beforeItemId: null, afterItemId: null });

    const lines: string[] = [];
    const result = await auditBulkImportLinkChains({
      sessionId: 'sess-corrupt',
      repair: true,
      log: (l: string) => lines.push(l),
    });

    expect(result.exitCode).toBe(0);
    expect(result.sessionsWithViolations).toBe(1);
    expect(result.reports[0].repaired).toBe(true);

    const repaired = itemStore.get('a')!.linkDecisions!;
    expect(repaired.afterItemId).toBeNull();
    expect(repaired.beforeItemId).toBeNull();
    expect(repaired.manualOverride).toBe(true);
    // Neighbor row was already clean — must not have been mutated.
    expect(itemStore.get('b')!.linkDecisions).toEqual({
      beforeItemId: null,
      afterItemId: null,
    });
    expect(lines.join('\n')).toMatch(/Repaired 1 item/);
  });
});
