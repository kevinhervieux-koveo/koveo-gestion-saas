/**
 * Task #1534 — Linking candidate-summary gate logic (backend unit tests).
 *
 * The `runAllForStep` function for the linking step populates a
 * `candidateSummary` object on the progress record that drives the
 * explanatory banner rendered by the wizard when zero items end up linked.
 *
 * Five gate conditions control which reason is surfaced, in priority order:
 *
 *   1. no-families     — no document-link families exist for the organisation.
 *   2. no-anchor-docs  — families exist but none have documents attached in
 *                        this building.
 *   3. no-open-chains  — anchor docs exist but every chain is already full
 *                        (has neighbours on both sides) — `openChainCount === 0`.
 *   4. all-out-of-scope — open chains exist but no candidate's residenceId
 *                        matches any eligible item — `maxInScopeCount === 0`.
 *   5. low-confidence  — in-scope candidates exist (`maxInScopeCount > 0`)
 *                        but the AI chose not to link any item.
 *
 * These tests mirror the production computation using standalone helper
 * functions (no real DB, no server import) following the same pattern
 * as `bulk-import-run-all-concurrency.test.ts` and
 * `bulk-import-linking-crash-safe.test.ts`.
 */

import { describe, it, expect } from '@jest/globals';

// ─── Types (mirror RunAllProgress['candidateSummary'] shape) ─────────────

interface CandidateSummary {
  familyCount: number;
  anchorDocCount: number;
  openChainCount: number;
  maxInScopeCount: number;
}

type LinkingEmptyReason =
  | 'no-families'
  | 'no-anchor-docs'
  | 'no-open-chains'
  | 'all-out-of-scope'
  | 'low-confidence';

// ─── Production-mirroring helpers ────────────────────────────────────────

/**
 * Mirrors `getLinkingEmptyReason` from the frontend and the priority logic
 * from `candidateSummary` computation in `runAllForStep`. The reason is the
 * first gate that triggered.
 */
function getLinkingEmptyReason(
  candidateSummary: CandidateSummary | undefined,
): LinkingEmptyReason {
  if (!candidateSummary || candidateSummary.familyCount === 0) return 'no-families';
  if (candidateSummary.anchorDocCount === 0) return 'no-anchor-docs';
  if (candidateSummary.openChainCount === 0) return 'no-open-chains';
  if (candidateSummary.maxInScopeCount === 0) return 'all-out-of-scope';
  return 'low-confidence';
}

interface FakeFamily {
  id: string;
  name: string;
}

interface FakeAnchorDoc {
  id: string;
  residenceId: string | null;
  canLinkBefore: boolean;
  canLinkAfter: boolean;
}

interface FakeItem {
  id: string;
  status: string;
  residenceId: string | null;
}

/**
 * Mirrors the `candidateSummary` computation from `runAllForStep`. Given
 * - the families visible to the session
 * - allAnchorDocs: ALL docs that appear in any family link in this building
 *   (regardless of whether they still have an open slot). Maps to
 *   `_linkAnchorDocCount` in the backend.
 * - eligibleItems: the import-session items eligible for the linking step.
 *
 * `anchorDocCount` = total docs in any link (whether or not they have open
 * slots). `openChainCount` = subset that has at least one open slot (the
 * candidates actually offered to the AI). These are distinct because a doc
 * fully surrounded on both sides still contributes to `anchorDocCount` but
 * not `openChainCount`, which is what gate 3 (no-open-chains) tests.
 *
 * Returns the summary that would be written to the progress record.
 */
function computeCandidateSummary(
  families: FakeFamily[],
  allAnchorDocs: FakeAnchorDoc[],
  eligibleItems: FakeItem[],
): CandidateSummary {
  const familyCount = families.length;
  const anchorDocCount = allAnchorDocs.length;
  const openChainCount = allAnchorDocs.filter((d) => d.canLinkBefore || d.canLinkAfter).length;

  let maxInScopeCount = 0;
  if (openChainCount > 0) {
    const openCandidates = allAnchorDocs.filter((d) => d.canLinkBefore || d.canLinkAfter);
    for (const item of eligibleItems) {
      const inScope = openCandidates.filter(
        (c) => c.residenceId === item.residenceId,
      ).length;
      if (inScope > maxInScopeCount) maxInScopeCount = inScope;
    }
  }

  return { familyCount, anchorDocCount, openChainCount, maxInScopeCount };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('linking candidate summary — gate priority (Task #1534)', () => {
  it('gate 1 — no families: summary has familyCount=0, reason=no-families', () => {
    const summary = computeCandidateSummary(
      [],
      [],
      [{ id: 'item-1', status: 'identified', residenceId: null }],
    );
    expect(summary.familyCount).toBe(0);
    expect(summary.anchorDocCount).toBe(0);
    expect(summary.openChainCount).toBe(0);
    expect(summary.maxInScopeCount).toBe(0);
    expect(getLinkingEmptyReason(summary)).toBe('no-families');
  });

  it('gate 2 — families exist but no anchor docs: reason=no-anchor-docs', () => {
    const families: FakeFamily[] = [{ id: 'fam-1', name: 'Rules' }];
    const summary = computeCandidateSummary(
      families,
      [],
      [{ id: 'item-1', status: 'identified', residenceId: null }],
    );
    expect(summary.familyCount).toBe(1);
    expect(summary.anchorDocCount).toBe(0);
    expect(summary.openChainCount).toBe(0);
    expect(getLinkingEmptyReason(summary)).toBe('no-anchor-docs');
  });

  it('gate 3 — anchor docs exist but all chains full: reason=no-open-chains', () => {
    const families: FakeFamily[] = [{ id: 'fam-1', name: 'Rules' }];
    const fullChainDocs: FakeAnchorDoc[] = [
      { id: 'doc-1', residenceId: null, canLinkBefore: false, canLinkAfter: false },
      { id: 'doc-2', residenceId: null, canLinkBefore: false, canLinkAfter: false },
    ];
    const summary = computeCandidateSummary(
      families,
      fullChainDocs,
      [{ id: 'item-1', status: 'identified', residenceId: null }],
    );
    expect(summary.familyCount).toBe(1);
    expect(summary.openChainCount).toBe(0);
    expect(getLinkingEmptyReason(summary)).toBe('no-open-chains');
  });

  it('gate 4 — open chains exist but none in scope for any item: reason=all-out-of-scope', () => {
    const families: FakeFamily[] = [{ id: 'fam-1', name: 'Rules' }];
    const openChainDocs: FakeAnchorDoc[] = [
      { id: 'doc-1', residenceId: 'res-A', canLinkBefore: true, canLinkAfter: false },
      { id: 'doc-2', residenceId: 'res-B', canLinkBefore: false, canLinkAfter: true },
    ];
    const items: FakeItem[] = [
      { id: 'item-1', status: 'identified', residenceId: 'res-X' },
      { id: 'item-2', status: 'identified', residenceId: 'res-Y' },
    ];
    const summary = computeCandidateSummary(families, openChainDocs, items);
    expect(summary.familyCount).toBe(1);
    expect(summary.openChainCount).toBe(2);
    expect(summary.maxInScopeCount).toBe(0);
    expect(getLinkingEmptyReason(summary)).toBe('all-out-of-scope');
  });

  it('gate 5 — in-scope candidates exist but no links produced: reason=low-confidence', () => {
    const families: FakeFamily[] = [{ id: 'fam-1', name: 'Rules' }];
    const openChainDocs: FakeAnchorDoc[] = [
      { id: 'doc-1', residenceId: 'res-A', canLinkBefore: true, canLinkAfter: true },
      { id: 'doc-2', residenceId: 'res-A', canLinkBefore: false, canLinkAfter: true },
    ];
    const items: FakeItem[] = [
      { id: 'item-1', status: 'identified', residenceId: 'res-A' },
    ];
    const summary = computeCandidateSummary(families, openChainDocs, items);
    expect(summary.familyCount).toBe(1);
    expect(summary.openChainCount).toBe(2);
    expect(summary.maxInScopeCount).toBe(2);
    expect(getLinkingEmptyReason(summary)).toBe('low-confidence');
  });
});

describe('getLinkingEmptyReason — edge cases', () => {
  it('undefined summary defaults to no-families', () => {
    expect(getLinkingEmptyReason(undefined)).toBe('no-families');
  });

  it('maxInScopeCount=0 with openChainCount=0 → no-open-chains wins over all-out-of-scope', () => {
    const summary: CandidateSummary = {
      familyCount: 2,
      anchorDocCount: 2,
      openChainCount: 0,
      maxInScopeCount: 0,
    };
    expect(getLinkingEmptyReason(summary)).toBe('no-open-chains');
  });
});
