/**
 * Task #1233 — Unit tests for resolveLinkingGroups.
 * Task #1635 — Unit tests for getLinkingDisplayName.
 *
 * Covers: empty list, single chain, multiple chains, cycle detection,
 * optimistic override application, standalone detection, cross-item linking,
 * and the three display-name precedence branches for Linking-step rows.
 */
import { describe, it, expect } from '@jest/globals';
import { resolveLinkingGroups, getLinkingDisplayName } from '@/pages/admin/bulk-import-linking-groups';
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

// ---------------------------------------------------------------------------
// Task #1635 — getLinkingDisplayName
// ---------------------------------------------------------------------------

describe('getLinkingDisplayName', () => {
  const ORIGINAL = 'Reglements_7_NoCentris_28525705.pdf';

  describe('branch 1 — admin override (finalFileName)', () => {
    it('returns finalFileName + original extension', () => {
      expect(
        getLinkingDisplayName({
          originalName: ORIGINAL,
          finalFileName: "Règlement de l'immeuble",
          branchSuggestedFinalFileName: 'Procès-verbal AGA 2024-09-12',
          branchSuggestedFinalFileNameIsFallback: false,
        }),
      ).toBe("Règlement de l'immeuble.pdf");
    });

    it('trims whitespace from finalFileName', () => {
      expect(
        getLinkingDisplayName({
          originalName: ORIGINAL,
          finalFileName: '  Police assurance 2024  ',
        }),
      ).toBe('Police assurance 2024.pdf');
    });

    it('ignores a real AI suggestion when finalFileName is also set', () => {
      expect(
        getLinkingDisplayName({
          originalName: ORIGINAL,
          finalFileName: 'Admin Override',
          branchSuggestedFinalFileName: 'AI Suggestion',
          branchSuggestedFinalFileNameIsFallback: false,
        }),
      ).toBe('Admin Override.pdf');
    });
  });

  describe('branch 2 — real AI suggestion (not a fallback)', () => {
    it('returns branchSuggestedFinalFileName + extension when not a fallback', () => {
      expect(
        getLinkingDisplayName({
          originalName: ORIGINAL,
          finalFileName: null,
          branchSuggestedFinalFileName: 'Procès-verbal AGA 2024-09-12',
          branchSuggestedFinalFileNameIsFallback: false,
        }),
      ).toBe('Procès-verbal AGA 2024-09-12.pdf');
    });

    it('falls through to originalName when branchSuggestedFinalFileNameIsFallback is true', () => {
      expect(
        getLinkingDisplayName({
          originalName: ORIGINAL,
          finalFileName: null,
          branchSuggestedFinalFileName: 'Reglements_7_NoCentris_28525705',
          branchSuggestedFinalFileNameIsFallback: true,
        }),
      ).toBe(ORIGINAL);
    });

    it('falls through when branchSuggestedFinalFileName is null', () => {
      expect(
        getLinkingDisplayName({
          originalName: ORIGINAL,
          finalFileName: null,
          branchSuggestedFinalFileName: null,
          branchSuggestedFinalFileNameIsFallback: false,
        }),
      ).toBe(ORIGINAL);
    });

    it('falls through when branchSuggestedFinalFileName is blank whitespace', () => {
      expect(
        getLinkingDisplayName({
          originalName: ORIGINAL,
          finalFileName: null,
          branchSuggestedFinalFileName: '   ',
          branchSuggestedFinalFileNameIsFallback: false,
        }),
      ).toBe(ORIGINAL);
    });

    it('falls through when branchSuggestedFinalFileNameIsFallback is undefined (absent flag)', () => {
      expect(
        getLinkingDisplayName({
          originalName: ORIGINAL,
          finalFileName: null,
          branchSuggestedFinalFileName: 'Procès-verbal AGA 2024-09-12',
          // flag absent — helper must NOT promote the suggestion
        }),
      ).toBe(ORIGINAL);
    });
  });

  describe('branch 3 — original filename verbatim', () => {
    it('returns originalName when no optional fields are provided', () => {
      expect(getLinkingDisplayName({ originalName: ORIGINAL })).toBe(ORIGINAL);
    });

    it('returns originalName when finalFileName is empty string', () => {
      expect(
        getLinkingDisplayName({ originalName: ORIGINAL, finalFileName: '' }),
      ).toBe(ORIGINAL);
    });

    it('returns originalName when both override and AI suggestion are null', () => {
      expect(
        getLinkingDisplayName({
          originalName: ORIGINAL,
          finalFileName: null,
          branchSuggestedFinalFileName: null,
        }),
      ).toBe(ORIGINAL);
    });
  });

  describe('extension handling', () => {
    it('preserves .jpg extension for admin override', () => {
      expect(
        getLinkingDisplayName({
          originalName: 'scan001.jpg',
          finalFileName: 'Police assurance 2024',
        }),
      ).toBe('Police assurance 2024.jpg');
    });

    it('preserves .pdf extension for AI suggestion', () => {
      expect(
        getLinkingDisplayName({
          originalName: 'IMG_20231204.pdf',
          branchSuggestedFinalFileName: 'Facture entretien janvier 2024',
          branchSuggestedFinalFileNameIsFallback: false,
        }),
      ).toBe('Facture entretien janvier 2024.pdf');
    });

    it('appends no extension when originalName has none', () => {
      expect(
        getLinkingDisplayName({
          originalName: 'noextfile',
          finalFileName: 'Override name',
        }),
      ).toBe('Override name');
    });
  });

  describe('originalName is never mutated', () => {
    it('the helper is pure and does not modify the item object', () => {
      const item2 = {
        originalName: ORIGINAL,
        finalFileName: "Règlement de l'immeuble",
        branchSuggestedFinalFileName: 'Procès-verbal',
        branchSuggestedFinalFileNameIsFallback: false,
      };
      getLinkingDisplayName(item2);
      expect(item2.originalName).toBe(ORIGINAL);
    });
  });
});
