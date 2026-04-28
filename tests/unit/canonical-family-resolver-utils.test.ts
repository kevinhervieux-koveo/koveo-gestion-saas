/**
 * @jest-environment node
 *
 * Task #1644 — Unit tests for the canonical-family resolver primitives.
 *
 * These tests pin the deduplication contract exposed by
 * `server/services/canonical-family-resolver.ts`:
 *
 *   - `normalizeFamilyName` collapses the comparable form (trim + casefold).
 *   - `buildCanonicalResult` deduplicates a list of families by normalised
 *     name and returns a `duplicateToCanonical` map plus a lookup helper.
 *   - The internal `pickWinner` rules are exercised through
 *     `buildCanonicalResult` (system > org, older createdAt > newer,
 *     lexicographic id tie-break) so a regression in any branch is caught.
 *
 * No DB calls are made — these are pure-logic tests.
 */

import { describe, it, expect, jest } from '@jest/globals';

jest.mock('drizzle-orm', () => require('../manual-mocks/drizzle-orm'));

// The resolver imports `db` at module load time. We don't use any DB-touching
// function here, but the import has to succeed, so stub it to a no-op object.
jest.mock('../../server/db', () => ({ db: {} }));

import {
  buildCanonicalResult,
  normalizeFamilyName,
} from '../../server/services/canonical-family-resolver';
import type { DocumentLinkFamily } from '../../shared/schemas/documents';

type FamilyOverrides = Partial<DocumentLinkFamily> & { id: string; name: string };

function makeFamily(overrides: FamilyOverrides): DocumentLinkFamily {
  return {
    id: overrides.id,
    organizationId: overrides.organizationId ?? null,
    name: overrides.name,
    description: overrides.description ?? null,
    isSystem: overrides.isSystem ?? false,
    source: overrides.source ?? null,
    createdAt: overrides.createdAt ?? new Date('2025-01-01T00:00:00Z'),
    updatedAt: overrides.updatedAt ?? new Date('2025-01-01T00:00:00Z'),
  };
}

// ---------------------------------------------------------------------------
// normalizeFamilyName
// ---------------------------------------------------------------------------

describe('normalizeFamilyName', () => {
  it('lowercases the input', () => {
    expect(normalizeFamilyName('Budget')).toBe('budget');
    expect(normalizeFamilyName('BUDGET')).toBe('budget');
    expect(normalizeFamilyName('bUdGeT')).toBe('budget');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeFamilyName('  Budget  ')).toBe('budget');
    expect(normalizeFamilyName('\tBudget\n')).toBe('budget');
  });

  it('treats names that differ only by case + whitespace as equal', () => {
    const a = normalizeFamilyName('  Annual Report ');
    const b = normalizeFamilyName('annual report');
    const c = normalizeFamilyName('ANNUAL REPORT');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('keeps interior whitespace and punctuation intact', () => {
    expect(normalizeFamilyName('Q1 / Q2  Report')).toBe('q1 / q2  report');
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeFamilyName('   ')).toBe('');
    expect(normalizeFamilyName('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildCanonicalResult — basic shape
// ---------------------------------------------------------------------------

describe('buildCanonicalResult', () => {
  it('returns an empty result for an empty input', () => {
    const result = buildCanonicalResult([]);
    expect(result.canonical).toEqual([]);
    expect(result.duplicateToCanonical.size).toBe(0);
    expect(result.canonicalIdForFamilyId('anything')).toBe('anything');
  });

  it('keeps unrelated families separate', () => {
    const a = makeFamily({ id: 'a', name: 'Budget', organizationId: 'org-1' });
    const b = makeFamily({ id: 'b', name: 'Minutes', organizationId: 'org-1' });
    const result = buildCanonicalResult([a, b]);
    expect(result.canonical).toHaveLength(2);
    expect(result.duplicateToCanonical.size).toBe(0);
    expect(result.canonicalIdForFamilyId('a')).toBe('a');
    expect(result.canonicalIdForFamilyId('b')).toBe('b');
  });

  it('canonicalIdForFamilyId returns the input when the id is unknown', () => {
    const a = makeFamily({ id: 'a', name: 'Budget', organizationId: 'org-1' });
    const result = buildCanonicalResult([a]);
    expect(result.canonicalIdForFamilyId('mystery-id')).toBe('mystery-id');
  });
});

// ---------------------------------------------------------------------------
// pickWinner rule 1 — system family always wins
// ---------------------------------------------------------------------------

describe('buildCanonicalResult — system vs org tie-break (pickWinner rule 1)', () => {
  it('system family wins regardless of input order (system first)', () => {
    const sys = makeFamily({
      id: 'sys',
      name: 'Budget',
      isSystem: true,
      organizationId: null,
      createdAt: new Date('2025-06-01'),
    });
    const org = makeFamily({
      id: 'org',
      name: 'budget',
      organizationId: 'org-1',
      createdAt: new Date('2024-01-01'), // older — would otherwise win on age
    });

    const result = buildCanonicalResult([sys, org]);
    expect(result.canonical).toHaveLength(1);
    expect(result.canonical[0].id).toBe('sys');
    expect(result.duplicateToCanonical.get('org')).toBe('sys');
    expect(result.canonicalIdForFamilyId('org')).toBe('sys');
    expect(result.canonicalIdForFamilyId('sys')).toBe('sys');
  });

  it('system family wins regardless of input order (org first)', () => {
    const org = makeFamily({
      id: 'org',
      name: 'Budget',
      organizationId: 'org-1',
      createdAt: new Date('2024-01-01'),
    });
    const sys = makeFamily({
      id: 'sys',
      name: 'BUDGET',
      isSystem: true,
      organizationId: null,
      createdAt: new Date('2025-06-01'),
    });

    const result = buildCanonicalResult([org, sys]);
    expect(result.canonical).toHaveLength(1);
    expect(result.canonical[0].id).toBe('sys');
    expect(result.duplicateToCanonical.get('org')).toBe('sys');
  });

  it('treats organizationId === null as system even when isSystem flag is false', () => {
    // Defensive case: legacy rows may have organizationId NULL without
    // isSystem set. The resolver still treats them as system-side winners.
    const legacyNullOrg = makeFamily({
      id: 'legacy',
      name: 'Budget',
      isSystem: false,
      organizationId: null,
      createdAt: new Date('2025-06-01'),
    });
    const org = makeFamily({
      id: 'org',
      name: 'budget',
      organizationId: 'org-1',
      createdAt: new Date('2020-01-01'),
    });
    const result = buildCanonicalResult([org, legacyNullOrg]);
    expect(result.canonical[0].id).toBe('legacy');
    expect(result.duplicateToCanonical.get('org')).toBe('legacy');
  });
});

// ---------------------------------------------------------------------------
// pickWinner rule 2 — older createdAt wins
// ---------------------------------------------------------------------------

describe('buildCanonicalResult — age tie-break (pickWinner rule 2)', () => {
  it('older org family wins when both are org-scoped', () => {
    const older = makeFamily({
      id: 'older',
      name: 'Budget',
      organizationId: 'org-1',
      createdAt: new Date('2024-01-01'),
    });
    const newer = makeFamily({
      id: 'newer',
      name: 'budget',
      organizationId: 'org-1',
      createdAt: new Date('2025-01-01'),
    });

    const result1 = buildCanonicalResult([older, newer]);
    expect(result1.canonical[0].id).toBe('older');
    expect(result1.duplicateToCanonical.get('newer')).toBe('older');

    const result2 = buildCanonicalResult([newer, older]);
    expect(result2.canonical[0].id).toBe('older');
    expect(result2.duplicateToCanonical.get('newer')).toBe('older');
  });

  it('older system family wins over newer system family', () => {
    const older = makeFamily({
      id: 'sys-older',
      name: 'Budget',
      isSystem: true,
      organizationId: null,
      createdAt: new Date('2023-01-01'),
    });
    const newer = makeFamily({
      id: 'sys-newer',
      name: 'budget',
      isSystem: true,
      organizationId: null,
      createdAt: new Date('2025-01-01'),
    });

    const result = buildCanonicalResult([newer, older]);
    expect(result.canonical[0].id).toBe('sys-older');
    expect(result.duplicateToCanonical.get('sys-newer')).toBe('sys-older');
  });
});

// ---------------------------------------------------------------------------
// pickWinner rule 3 — id lexicographic tie-break
// ---------------------------------------------------------------------------

describe('buildCanonicalResult — id tie-break (pickWinner rule 3)', () => {
  it('lexicographically smaller id wins when system flag and createdAt match', () => {
    const sameTs = new Date('2025-01-01T00:00:00Z');
    const aaa = makeFamily({
      id: 'aaa',
      name: 'Budget',
      organizationId: 'org-1',
      createdAt: sameTs,
    });
    const zzz = makeFamily({
      id: 'zzz',
      name: 'budget',
      organizationId: 'org-1',
      createdAt: sameTs,
    });

    const result1 = buildCanonicalResult([aaa, zzz]);
    expect(result1.canonical[0].id).toBe('aaa');
    expect(result1.duplicateToCanonical.get('zzz')).toBe('aaa');

    const result2 = buildCanonicalResult([zzz, aaa]);
    expect(result2.canonical[0].id).toBe('aaa');
    expect(result2.duplicateToCanonical.get('zzz')).toBe('aaa');
  });
});

// ---------------------------------------------------------------------------
// Three-way collisions — chained dup map should resolve to ultimate canonical
// ---------------------------------------------------------------------------

describe('buildCanonicalResult — chain resolution across three colliding rows', () => {
  it('collapses every duplicate to the eventual winner (system beats org chain)', () => {
    const orgA = makeFamily({
      id: 'org-a',
      name: 'Budget',
      organizationId: 'org-1',
      createdAt: new Date('2020-01-01'),
    });
    const orgB = makeFamily({
      id: 'org-b',
      name: 'budget',
      organizationId: 'org-1',
      createdAt: new Date('2021-01-01'),
    });
    const sys = makeFamily({
      id: 'sys',
      name: 'BUDGET',
      isSystem: true,
      organizationId: null,
      createdAt: new Date('2025-01-01'),
    });

    // Order chosen so the iteration produces a chain:
    //   step 1: orgA enters
    //   step 2: orgB collides with orgA → orgA wins (older), orgB → orgA in dup map
    //   step 3: sys collides with orgA → sys wins (system), orgA → sys in dup map
    // After the post-pass, orgB must point at sys (not at orgA).
    const result = buildCanonicalResult([orgA, orgB, sys]);
    expect(result.canonical).toHaveLength(1);
    expect(result.canonical[0].id).toBe('sys');
    expect(result.canonicalIdForFamilyId('org-a')).toBe('sys');
    expect(result.canonicalIdForFamilyId('org-b')).toBe('sys');
    expect(result.canonicalIdForFamilyId('sys')).toBe('sys');
  });
});
