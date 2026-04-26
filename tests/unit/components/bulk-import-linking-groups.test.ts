/**
 * Task #1233 — Unit tests for resolveLinkingGroups.
 *
 * Covers: empty list, single chain, multiple chains, cycle detection,
 * optimistic override application, standalone detection, cross-item linking.
 */
import { describe, it, expect } from '@jest/globals';
import { resolveLinkingGroups } from '@/pages/admin/bulk-import-linking-groups';
import type { LinkingItemShape } from '@/pages/admin/bulk-import-linking-groups';

function item(
  id: string,
  afterId: string | null = null,
  manual = false,
): LinkingItemShape {
  return { id, linkingAfterItemId: afterId, linkingManualOverride: manual };
}

describe('resolveLinkingGroups', () => {
  describe('empty list', () => {
    it('returns empty groups and empty standalones', () => {
      const { groups, standaloneIds } = resolveLinkingGroups([]);
      expect(groups).toHaveLength(0);
      expect(standaloneIds.size).toBe(0);
    });
  });

  describe('all standalone items', () => {
    it('puts every unlinked item into standaloneIds', () => {
      const items = [item('a'), item('b'), item('c')];
      const { groups, standaloneIds } = resolveLinkingGroups(items);
      expect(groups).toHaveLength(0);
      expect(standaloneIds).toEqual(new Set(['a', 'b', 'c']));
    });
  });

  describe('single 2-item chain', () => {
    it('forms one group with correct head and tail', () => {
      const items = [item('a', 'b'), item('b')];
      const { groups, standaloneIds } = resolveLinkingGroups(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('a');
      expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
      expect(standaloneIds.size).toBe(0);
    });
  });

  describe('3-item chain', () => {
    it('orders items head → mid → tail', () => {
      const items = [item('a', 'b'), item('b', 'c'), item('c')];
      const { groups } = resolveLinkingGroups(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('multiple chains', () => {
    it('resolves two independent 2-item chains', () => {
      const items = [item('a', 'b'), item('b'), item('x', 'y'), item('y')];
      const { groups, standaloneIds } = resolveLinkingGroups(items);
      expect(groups).toHaveLength(2);
      expect(standaloneIds.size).toBe(0);
      const groupIds = groups.map((g) => g.id).sort();
      expect(groupIds).toEqual(['a', 'x']);
    });

    it('separates a chain from a standalone item', () => {
      const items = [item('a', 'b'), item('b'), item('c')];
      const { groups, standaloneIds } = resolveLinkingGroups(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('a');
      expect(standaloneIds).toEqual(new Set(['c']));
    });
  });

  describe('cycle detection', () => {
    it('does not hang or crash on a 2-item cycle', () => {
      const items = [item('a', 'b'), item('b', 'a')];
      const { groups, standaloneIds } = resolveLinkingGroups(items);
      // Both items participate in a mutual-reference cycle.
      // The algorithm should treat both as standalone (cycle = no valid head).
      expect(groups).toHaveLength(0);
      expect(standaloneIds).toEqual(new Set(['a', 'b']));
    });

    it('does not hang on a 3-item cycle', () => {
      const items = [item('a', 'b'), item('b', 'c'), item('c', 'a')];
      const { groups, standaloneIds } = resolveLinkingGroups(items);
      expect(groups).toHaveLength(0);
      expect(standaloneIds).toEqual(new Set(['a', 'b', 'c']));
    });
  });

  describe('isManual flag', () => {
    it('is false when no item in the chain is manual', () => {
      const items = [item('a', 'b'), item('b')];
      const { groups } = resolveLinkingGroups(items);
      expect(groups[0].isManual).toBe(false);
    });

    it('is true when any item has linkingManualOverride = true', () => {
      const items = [item('a', 'b'), item('b', null, true)];
      const { groups } = resolveLinkingGroups(items);
      expect(groups[0].isManual).toBe(true);
    });
  });

  describe('optimistic overrides', () => {
    it('applies an afterItemId override over the server value', () => {
      const items = [item('a'), item('b')];
      const overrides = new Map([
        ['a', { beforeItemId: null, afterItemId: 'b' }],
      ]);
      const { groups, standaloneIds } = resolveLinkingGroups(items, overrides);
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('a');
      expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
      expect(standaloneIds.size).toBe(0);
    });

    it('marks group as manual when any item has an override', () => {
      const items = [item('a', 'b'), item('b')];
      const overrides = new Map([['b', { beforeItemId: 'a', afterItemId: null }]]);
      const { groups } = resolveLinkingGroups(items, overrides);
      expect(groups[0].isManual).toBe(true);
    });

    it('breaks a chain when an override sets afterItemId to null', () => {
      const items = [item('a', 'b'), item('b')];
      const overrides = new Map([['a', { beforeItemId: null, afterItemId: null }]]);
      const { groups, standaloneIds } = resolveLinkingGroups(items, overrides);
      expect(groups).toHaveLength(0);
      expect(standaloneIds).toEqual(new Set(['a', 'b']));
    });

    it('joins two standalone items via an override', () => {
      const items = [item('a'), item('b')];
      const overrides = new Map([['a', { beforeItemId: null, afterItemId: 'b' }]]);
      const { groups } = resolveLinkingGroups(items, overrides);
      expect(groups).toHaveLength(1);
      expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
    });
  });

  describe('items listed in reverse order', () => {
    it('still resolves the chain correctly when tail is listed before head', () => {
      const items = [item('b'), item('a', 'b')];
      const { groups } = resolveLinkingGroups(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('a');
      expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
    });
  });

  describe('reference to unknown item', () => {
    it('treats an item as standalone if its afterItemId points to a non-existent item', () => {
      const items = [item('a', 'nonexistent')];
      const { groups, standaloneIds } = resolveLinkingGroups(items);
      expect(groups).toHaveLength(0);
      expect(standaloneIds).toEqual(new Set(['a']));
    });
  });

  describe('headless cycles (all members are pointed-to, so no valid head exists)', () => {
    it('2-item headless cycle: both items become standalone', () => {
      const items = [item('a', 'b'), item('b', 'a')];
      const { groups, standaloneIds } = resolveLinkingGroups(items);
      expect(groups).toHaveLength(0);
      expect(standaloneIds).toEqual(new Set(['a', 'b']));
    });

    it('3-item headless cycle: all three items become standalone', () => {
      const items = [item('a', 'b'), item('b', 'c'), item('c', 'a')];
      const { groups, standaloneIds } = resolveLinkingGroups(items);
      expect(groups).toHaveLength(0);
      expect(standaloneIds).toEqual(new Set(['a', 'b', 'c']));
    });

    it('headless cycle plus a valid chain do not interfere with each other', () => {
      const items = [
        item('x', 'y'),
        item('y'),
        item('a', 'b'),
        item('b', 'a'),
      ];
      const { groups, standaloneIds } = resolveLinkingGroups(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('x');
      expect(groups[0].items.map((i) => i.id)).toEqual(['x', 'y']);
      expect(standaloneIds).toEqual(new Set(['a', 'b']));
    });
  });
});
