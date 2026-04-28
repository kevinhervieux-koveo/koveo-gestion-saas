/**
 * Task #1617 — unit coverage for the family-card collapse preference.
 *
 * The bulk-document-import page (Task #1608) renders one card per
 * existing-document family on the Linking step. Each card opens or
 * collapses based on:
 *   1. an auto-collapse default driven by the card's `newCount`, and
 *   2. an admin override (cards toggled AWAY from that default).
 *
 * Task #1617 persists (2) per session in localStorage so the admin's
 * dismissals survive page reloads. To keep the test fast and isolated
 * from the page's full Linking-step rendering pipeline, the underlying
 * logic was extracted into pure helpers exported from the page module:
 *
 *   - `familyCardAutoCollapsed(newCount)`
 *   - `isFamilyCardCollapsed(newCount, familyId, toggledIds)`
 *   - `toggleFamilyCardCollapsed(prev, familyId)`
 *   - `readPersistedCollapsedFamilyIds(sessionId)`
 *   - `writePersistedCollapsedFamilyIds(sessionId, ids)`
 *   - `collapsedFamiliesStorageKey(sessionId)`
 *
 * This suite covers:
 *   1. The auto-collapse rule (0 collapsed, 1 expanded, 2+ collapsed).
 *   2. Toggling inverts the apparent state and is reflected by
 *      `isFamilyCardCollapsed`.
 *   3. Persisted state round-trips through localStorage and is scoped
 *      per session.
 *   4. Untouched cards still follow the auto-default after a reload
 *      (no entry in the persisted set).
 *   5. Defensive parsing returns an empty set for missing/garbled data.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  COLLAPSED_FAMILIES_STORAGE_PREFIX,
  collapsedFamiliesStorageKey,
  familyCardAutoCollapsed,
  isFamilyCardCollapsed,
  readPersistedCollapsedFamilyIds,
  toggleFamilyCardCollapsed,
  writePersistedCollapsedFamilyIds,
} from '@/pages/admin/bulk-document-import';

beforeEach(() => {
  window.localStorage.clear();
});

// ---------------------------------------------------------------------------
// 1. Auto-collapse rule
// ---------------------------------------------------------------------------

describe('familyCardAutoCollapsed (Task #1617)', () => {
  it('auto-collapses cards with no new items (existing-only context cards)', () => {
    expect(familyCardAutoCollapsed(0)).toBe(true);
  });

  it('auto-expands cards with exactly one new item (single doc to review)', () => {
    expect(familyCardAutoCollapsed(1)).toBe(false);
  });

  it('auto-collapses cards with 2+ new items (avoid wall of rows)', () => {
    expect(familyCardAutoCollapsed(2)).toBe(true);
    expect(familyCardAutoCollapsed(5)).toBe(true);
    expect(familyCardAutoCollapsed(50)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Toggle inverts the apparent state
// ---------------------------------------------------------------------------

describe('isFamilyCardCollapsed + toggleFamilyCardCollapsed (Task #1617)', () => {
  it('returns the auto-default when the family ID is NOT in the toggled set', () => {
    const empty = new Set<string>();
    expect(isFamilyCardCollapsed(0, 'fam-A', empty)).toBe(true);
    expect(isFamilyCardCollapsed(1, 'fam-A', empty)).toBe(false);
    expect(isFamilyCardCollapsed(3, 'fam-A', empty)).toBe(true);
  });

  it('returns the OPPOSITE of the auto-default when the family ID IS toggled', () => {
    const toggled = new Set<string>(['fam-A']);
    // 0 new → auto collapsed → toggled → expanded.
    expect(isFamilyCardCollapsed(0, 'fam-A', toggled)).toBe(false);
    // 1 new → auto expanded → toggled → collapsed.
    expect(isFamilyCardCollapsed(1, 'fam-A', toggled)).toBe(true);
    // 3 new → auto collapsed → toggled → expanded.
    expect(isFamilyCardCollapsed(3, 'fam-A', toggled)).toBe(false);
  });

  it('toggleFamilyCardCollapsed flips an ID in/out without mutating the input', () => {
    const before = new Set<string>(['fam-A']);
    const afterAdd = toggleFamilyCardCollapsed(before, 'fam-B');
    expect(afterAdd.has('fam-A')).toBe(true);
    expect(afterAdd.has('fam-B')).toBe(true);
    // Input not mutated.
    expect(before.has('fam-B')).toBe(false);

    const afterRemove = toggleFamilyCardCollapsed(afterAdd, 'fam-A');
    expect(afterRemove.has('fam-A')).toBe(false);
    expect(afterRemove.has('fam-B')).toBe(true);
    // Previous step not mutated.
    expect(afterAdd.has('fam-A')).toBe(true);
  });

  it('two toggles on the same family return to the original state', () => {
    const start = new Set<string>();
    const once = toggleFamilyCardCollapsed(start, 'fam-A');
    const twice = toggleFamilyCardCollapsed(once, 'fam-A');
    expect(twice.size).toBe(0);
    expect(isFamilyCardCollapsed(2, 'fam-A', twice)).toBe(
      familyCardAutoCollapsed(2),
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Per-session storage key + round-trip
// ---------------------------------------------------------------------------

describe('collapsedFamiliesStorageKey (Task #1617)', () => {
  it('namespaces the key per session ID', () => {
    expect(collapsedFamiliesStorageKey('sess-A')).toBe(
      `${COLLAPSED_FAMILIES_STORAGE_PREFIX}sess-A`,
    );
    expect(collapsedFamiliesStorageKey('sess-B')).not.toBe(
      collapsedFamiliesStorageKey('sess-A'),
    );
  });
});

describe('readPersistedCollapsedFamilyIds / writePersistedCollapsedFamilyIds (Task #1617)', () => {
  it('round-trips the toggled-away set per session', () => {
    const sessionId = 'sess-1';
    const toToggle = new Set<string>(['fam-A', 'fam-C']);

    writePersistedCollapsedFamilyIds(sessionId, toToggle);

    // Bytes really landed in localStorage under the per-session key.
    const raw = window.localStorage.getItem(
      collapsedFamiliesStorageKey(sessionId),
    );
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).sort()).toEqual(['fam-A', 'fam-C']);

    // Reading them back rehydrates an equivalent Set.
    const restored = readPersistedCollapsedFamilyIds(sessionId);
    expect(restored.has('fam-A')).toBe(true);
    expect(restored.has('fam-C')).toBe(true);
    expect(restored.has('fam-B')).toBe(false);
    expect(restored.size).toBe(2);
  });

  it('keeps each session\'s preference isolated', () => {
    writePersistedCollapsedFamilyIds('sess-A', new Set(['fam-1']));
    writePersistedCollapsedFamilyIds('sess-B', new Set(['fam-2', 'fam-3']));

    const a = readPersistedCollapsedFamilyIds('sess-A');
    const b = readPersistedCollapsedFamilyIds('sess-B');

    expect(Array.from(a).sort()).toEqual(['fam-1']);
    expect(Array.from(b).sort()).toEqual(['fam-2', 'fam-3']);
  });

  it('returns an empty set when nothing has been persisted yet', () => {
    expect(readPersistedCollapsedFamilyIds('sess-fresh').size).toBe(0);
  });

  it('returns an empty set for malformed JSON (no throw)', () => {
    window.localStorage.setItem(
      collapsedFamiliesStorageKey('sess-bad'),
      '{not json',
    );
    expect(readPersistedCollapsedFamilyIds('sess-bad').size).toBe(0);
  });

  it('returns an empty set when the persisted value is not an array', () => {
    window.localStorage.setItem(
      collapsedFamiliesStorageKey('sess-obj'),
      JSON.stringify({ foo: 'bar' }),
    );
    expect(readPersistedCollapsedFamilyIds('sess-obj').size).toBe(0);
  });

  it('drops non-string entries from the persisted array', () => {
    window.localStorage.setItem(
      collapsedFamiliesStorageKey('sess-mixed'),
      JSON.stringify(['fam-A', 42, null, 'fam-B']),
    );
    const restored = readPersistedCollapsedFamilyIds('sess-mixed');
    expect(Array.from(restored).sort()).toEqual(['fam-A', 'fam-B']);
  });
});

// ---------------------------------------------------------------------------
// 4. End-to-end persistence semantics across a simulated reload
// ---------------------------------------------------------------------------

describe('Family-card collapse preference across simulated reloads (Task #1617)', () => {
  const SESSION_ID = 'sess-reload';

  /**
   * Helper: simulate a "page load" by hydrating from localStorage,
   * mirroring what the page's `useEffect([sessionId])` does.
   */
  function loadForSession(): Set<string> {
    return readPersistedCollapsedFamilyIds(SESSION_ID);
  }

  /**
   * Helper: simulate a click on a family card's collapse toggle —
   * mirrors the page's `toggleCollapse` handler (compute next set,
   * set state, write through to localStorage).
   */
  function userToggles(current: Set<string>, familyId: string): Set<string> {
    const next = toggleFamilyCardCollapsed(current, familyId);
    writePersistedCollapsedFamilyIds(SESSION_ID, next);
    return next;
  }

  it('keeps a manually-collapsed card collapsed after a reload', () => {
    // Card has 1 new item → auto-default is EXPANDED. Admin collapses it.
    let state = loadForSession();
    expect(isFamilyCardCollapsed(1, 'fam-X', state)).toBe(false); // auto-expanded
    state = userToggles(state, 'fam-X');
    expect(isFamilyCardCollapsed(1, 'fam-X', state)).toBe(true); // collapsed

    // Reload: in-memory state is gone, hydrate from localStorage.
    const afterReload = loadForSession();
    expect(isFamilyCardCollapsed(1, 'fam-X', afterReload)).toBe(true);
  });

  it('keeps a manually-expanded card expanded after a reload', () => {
    // Card has 4 new items → auto-default is COLLAPSED. Admin expands it.
    let state = loadForSession();
    expect(isFamilyCardCollapsed(4, 'fam-Y', state)).toBe(true); // auto-collapsed
    state = userToggles(state, 'fam-Y');
    expect(isFamilyCardCollapsed(4, 'fam-Y', state)).toBe(false); // expanded

    const afterReload = loadForSession();
    expect(isFamilyCardCollapsed(4, 'fam-Y', afterReload)).toBe(false);
  });

  it('untouched cards still follow the auto-collapse default after a reload', () => {
    // Admin only touched fam-X; fam-Z is brand new and untouched.
    let state = loadForSession();
    state = userToggles(state, 'fam-X'); // dismisses fam-X

    const afterReload = loadForSession();

    // fam-X: previously toggled → still in the set → opposite of default.
    // fam-Z: never touched → default rules apply.
    expect(isFamilyCardCollapsed(0, 'fam-Z', afterReload)).toBe(true); // 0 new → collapsed
    expect(isFamilyCardCollapsed(1, 'fam-Z', afterReload)).toBe(false); // 1 new → expanded
    expect(isFamilyCardCollapsed(3, 'fam-Z', afterReload)).toBe(true); // 3 new → collapsed
  });
});
