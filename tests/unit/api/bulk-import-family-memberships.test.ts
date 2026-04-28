/**
 * Task #1425 — Unit tests for resolveFamilyGroups
 *
 * Tests the pure family-group resolver function introduced in Task #1425.
 * Verifies many-to-many bucketing, alphabetical sort, and Unassigned handling.
 */

import { describe, it, expect } from '@jest/globals';
import {
  resolveFamilyGroups,
} from '../../../client/src/pages/admin/bulk-import-linking-groups';
import type { FamilyMembership, FamilyGroupItemShape } from '../../../client/src/pages/admin/bulk-import-linking-groups';

function makeMembership(overrides: Partial<FamilyMembership> = {}): FamilyMembership {
  return {
    id: 'id' in overrides ? (overrides.id as string) : `m-${Math.random()}`,
    itemId: 'itemId' in overrides ? (overrides.itemId as string) : 'item-1',
    familyId: 'familyId' in overrides ? (overrides.familyId as string | null) : 'fam-a',
    familyName: 'familyName' in overrides ? (overrides.familyName as string | null) : 'Family A',
    neighborDocumentId:
      'neighborDocumentId' in overrides ? (overrides.neighborDocumentId as string | null) : 'doc-1',
    position: 'position' in overrides ? (overrides.position as FamilyMembership['position']) : 'after',
    source: overrides.source ?? 'ai',
    manualOverride: overrides.manualOverride ?? false,
    aiConfidence: 'aiConfidence' in overrides ? (overrides.aiConfidence as number | null) : 0.9,
    reason: 'reason' in overrides ? (overrides.reason as string | null) : null,
    // Task #1589: sequence position (optional — null/undefined means unordered).
    ...(('sequence' in overrides) ? { sequence: overrides.sequence } : {}),
  };
}

function makeItem(
  id: string,
  memberships: FamilyMembership[] = [],
): FamilyGroupItemShape {
  return { id, memberships };
}

describe('resolveFamilyGroups — Task #1425', () => {
  it('returns empty groups and empty unassigned for no items', () => {
    const { groups, unassignedItems } = resolveFamilyGroups([]);
    expect(groups).toHaveLength(0);
    expect(unassignedItems).toHaveLength(0);
  });

  it('puts items with no memberships into unassigned', () => {
    const items = [makeItem('i1'), makeItem('i2')];
    const { groups, unassignedItems } = resolveFamilyGroups(items);
    expect(groups).toHaveLength(0);
    expect(unassignedItems).toHaveLength(2);
    expect(unassignedItems.map((i) => i.id)).toEqual(['i1', 'i2']);
  });

  it('groups items by familyId', () => {
    const items = [
      makeItem('i1', [makeMembership({ itemId: 'i1', familyId: 'fam-a', familyName: 'Alpha' })]),
      makeItem('i2', [makeMembership({ itemId: 'i2', familyId: 'fam-b', familyName: 'Beta' })]),
    ];
    const { groups, unassignedItems } = resolveFamilyGroups(items);
    expect(groups).toHaveLength(2);
    expect(unassignedItems).toHaveLength(0);
    // Groups are sorted alphabetically
    expect(groups[0].familyName).toBe('Alpha');
    expect(groups[1].familyName).toBe('Beta');
    expect(groups[0].items[0].id).toBe('i1');
    expect(groups[1].items[0].id).toBe('i2');
  });

  it('sorts groups alphabetically by familyName, case-insensitive', () => {
    const items = [
      makeItem('i1', [makeMembership({ familyId: 'fam-z', familyName: 'Zulu' })]),
      makeItem('i2', [makeMembership({ familyId: 'fam-a', familyName: 'alpha' })]),
      makeItem('i3', [makeMembership({ familyId: 'fam-m', familyName: 'Mike' })]),
    ];
    const { groups } = resolveFamilyGroups(items);
    expect(groups.map((g) => g.familyName)).toEqual(['alpha', 'Mike', 'Zulu']);
  });

  it('supports many-to-many: one item in two families', () => {
    const items = [
      makeItem('i1', [
        makeMembership({ id: 'm1', itemId: 'i1', familyId: 'fam-a', familyName: 'Alpha' }),
        makeMembership({ id: 'm2', itemId: 'i1', familyId: 'fam-b', familyName: 'Beta' }),
      ]),
    ];
    const { groups, unassignedItems } = resolveFamilyGroups(items);
    expect(groups).toHaveLength(2);
    expect(unassignedItems).toHaveLength(0);
    // item i1 appears in both groups
    expect(groups[0].items[0].id).toBe('i1');
    expect(groups[1].items[0].id).toBe('i1');
  });

  it('populates membershipByItemId correctly', () => {
    const m = makeMembership({ id: 'm1', itemId: 'i1', familyId: 'fam-a', familyName: 'Alpha', position: 'before' });
    const items = [makeItem('i1', [m])];
    const { groups } = resolveFamilyGroups(items);
    expect(groups).toHaveLength(1);
    const resolved = groups[0].membershipByItemId.get('i1');
    expect(resolved?.id).toBe('m1');
    expect(resolved?.position).toBe('before');
  });

  it('handles mix of assigned and unassigned items', () => {
    const items = [
      makeItem('assigned', [makeMembership({ familyId: 'fam-a', familyName: 'Foo' })]),
      makeItem('unassigned1'),
      makeItem('unassigned2'),
    ];
    const { groups, unassignedItems } = resolveFamilyGroups(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].items[0].id).toBe('assigned');
    expect(unassignedItems.map((i) => i.id)).toEqual(['unassigned1', 'unassigned2']);
  });

  it('does not add item twice to the same group even with duplicate memberships', () => {
    const items = [
      makeItem('i1', [
        makeMembership({ id: 'm1', itemId: 'i1', familyId: 'fam-a', familyName: 'Alpha' }),
        makeMembership({ id: 'm2', itemId: 'i1', familyId: 'fam-a', familyName: 'Alpha', position: 'before' }),
      ]),
    ];
    const { groups } = resolveFamilyGroups(items);
    expect(groups).toHaveLength(1);
    // Item should appear only once in the group
    expect(groups[0].items).toHaveLength(1);
  });

  it('skips memberships with null familyId', () => {
    const items = [
      makeItem('i1', [
        makeMembership({ familyId: null as unknown as string, familyName: null }),
      ]),
    ];
    const { groups, unassignedItems } = resolveFamilyGroups(items);
    expect(groups).toHaveLength(0);
    expect(unassignedItems).toHaveLength(1);
    expect(unassignedItems[0].id).toBe('i1');
  });

  it('uses familyId as fallback familyName when familyName is null', () => {
    const items = [
      makeItem('i1', [
        makeMembership({ familyId: 'fam-x', familyName: null }),
      ]),
    ];
    const { groups } = resolveFamilyGroups(items);
    expect(groups[0].familyName).toBe('fam-x');
  });
});

/**
 * Task #1589 — Sequence-based ordering within family groups.
 *
 * Items in a family group must be sorted by their membership sequence
 * value ascending, with null/undefined sequence values sorted last.
 */
describe('resolveFamilyGroups — Task #1589 sequence ordering', () => {
  it('sorts items by sequence ascending within a group', () => {
    const items = [
      makeItem('i3', [makeMembership({ id: 'm3', itemId: 'i3', familyId: 'fam-a', familyName: 'Alpha', sequence: 3 })]),
      makeItem('i1', [makeMembership({ id: 'm1', itemId: 'i1', familyId: 'fam-a', familyName: 'Alpha', sequence: 1 })]),
      makeItem('i2', [makeMembership({ id: 'm2', itemId: 'i2', familyId: 'fam-a', familyName: 'Alpha', sequence: 2 })]),
    ];
    const { groups } = resolveFamilyGroups(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.id)).toEqual(['i1', 'i2', 'i3']);
  });

  it('places items with null sequence after sequenced items', () => {
    const items = [
      makeItem('no-seq', [makeMembership({ id: 'm-ns', itemId: 'no-seq', familyId: 'fam-a', familyName: 'Alpha', sequence: null })]),
      makeItem('seq2',   [makeMembership({ id: 'm-s2', itemId: 'seq2',   familyId: 'fam-a', familyName: 'Alpha', sequence: 2 })]),
      makeItem('seq1',   [makeMembership({ id: 'm-s1', itemId: 'seq1',   familyId: 'fam-a', familyName: 'Alpha', sequence: 1 })]),
    ];
    const { groups } = resolveFamilyGroups(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.id)).toEqual(['seq1', 'seq2', 'no-seq']);
  });

  it('keeps relative input order when all sequences are null (stable nulls-last sort)', () => {
    const items = [
      makeItem('a', [makeMembership({ id: 'ma', itemId: 'a', familyId: 'fam-a', familyName: 'Alpha', sequence: null })]),
      makeItem('b', [makeMembership({ id: 'mb', itemId: 'b', familyId: 'fam-a', familyName: 'Alpha', sequence: null })]),
    ];
    const { groups } = resolveFamilyGroups(items);
    expect(groups).toHaveLength(1);
    const ids = groups[0].items.map((i) => i.id);
    expect(new Set(ids)).toEqual(new Set(['a', 'b']));
  });

  it('sorts independently per group (different families do not affect each other)', () => {
    const items = [
      makeItem('x2', [makeMembership({ id: 'mx2', itemId: 'x2', familyId: 'fam-x', familyName: 'X', sequence: 2 })]),
      makeItem('x1', [makeMembership({ id: 'mx1', itemId: 'x1', familyId: 'fam-x', familyName: 'X', sequence: 1 })]),
      makeItem('y2', [makeMembership({ id: 'my2', itemId: 'y2', familyId: 'fam-y', familyName: 'Y', sequence: 2 })]),
      makeItem('y1', [makeMembership({ id: 'my1', itemId: 'y1', familyId: 'fam-y', familyName: 'Y', sequence: 1 })]),
    ];
    const { groups } = resolveFamilyGroups(items);
    expect(groups).toHaveLength(2);
    const xGroup = groups.find((g) => g.familyId === 'fam-x')!;
    const yGroup = groups.find((g) => g.familyId === 'fam-y')!;
    expect(xGroup.items.map((i) => i.id)).toEqual(['x1', 'x2']);
    expect(yGroup.items.map((i) => i.id)).toEqual(['y1', 'y2']);
  });

  it('membershipByItemId carries the sequence value for each sorted item', () => {
    const items = [
      makeItem('i2', [makeMembership({ id: 'm2', itemId: 'i2', familyId: 'fam-a', familyName: 'Alpha', sequence: 2 })]),
      makeItem('i1', [makeMembership({ id: 'm1', itemId: 'i1', familyId: 'fam-a', familyName: 'Alpha', sequence: 1 })]),
    ];
    const { groups } = resolveFamilyGroups(items);
    const group = groups[0];
    expect(group.membershipByItemId.get('i1')?.sequence).toBe(1);
    expect(group.membershipByItemId.get('i2')?.sequence).toBe(2);
  });
});
