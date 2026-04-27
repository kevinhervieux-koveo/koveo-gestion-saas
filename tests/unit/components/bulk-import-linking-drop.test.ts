/**
 * Task #1242 — Unit tests for the pure drop-computation helpers behind
 * the Linking step's drag-and-drop:
 *   - `computeLinkingDropChanges` (reorder within group, join group,
 *     cross-chain move, no-op detection)
 *   - `computeLinkingMakeStandaloneChanges` (detach from middle / head /
 *     tail of chain, no-op when already standalone)
 *
 * The helpers are pure (no React state, no network) so they can be
 * exercised directly with a fixture-backed `getEffective` function.
 */
import { describe, it, expect } from '@jest/globals';
import {
  computeLinkingDropChanges,
  computeLinkingMakeStandaloneChanges,
  computeLinkingBreakGroupChanges,
  type LinkingChange,
  type LinkingEffective,
} from '@/pages/admin/bulk-import-linking-groups';

/**
 * Build a `getEffective` lookup from a simple chain map of
 * `{ itemId -> { before, after } }`.  Items not in the map are treated
 * as standalone (before = null, after = null).
 */
function makeGetEffective(
  map: Record<string, Partial<LinkingEffective>>,
): (id: string) => LinkingEffective {
  return (id: string) => ({
    before: map[id]?.before ?? null,
    after: map[id]?.after ?? null,
  });
}

/** Index a change list by itemId for easy assertions. */
function byId(changes: LinkingChange[]): Record<string, LinkingChange> {
  const out: Record<string, LinkingChange> = {};
  for (const c of changes) out[c.itemId] = c;
  return out;
}

describe('computeLinkingDropChanges — drop-on-self / no-op', () => {
  it('returns no changes when dragId === targetId', () => {
    const get = makeGetEffective({ a: { after: 'b' }, b: { before: 'a' } });
    expect(computeLinkingDropChanges('a', 'a', 'before', get)).toEqual([]);
    expect(computeLinkingDropChanges('a', 'a', 'after', get)).toEqual([]);
  });

  it('returns no changes when the resulting topology equals the current one (intra-chain)', () => {
    // chain: a → b → c.  Dropping b "after" a is identical to current.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });
    expect(computeLinkingDropChanges('b', 'a', 'after', get)).toEqual([]);
  });

  it('returns no changes when dropping an item before its current successor (no move)', () => {
    // chain: a → b → c.  Dropping b "before" c keeps b between a and c.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });
    expect(computeLinkingDropChanges('b', 'c', 'before', get)).toEqual([]);
  });
});

describe('computeLinkingDropChanges — reorder within a group', () => {
  it('moves the tail of a 3-chain to the head (c before a)', () => {
    // chain: a → b → c.  Drop c BEFORE a → expected: c → a → b.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });
    const changes = byId(computeLinkingDropChanges('c', 'a', 'before', get));
    expect(changes['c']).toEqual({ itemId: 'c', beforeItemId: null, afterItemId: 'a' });
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: 'c', afterItemId: 'b' });
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: 'a', afterItemId: null });
  });

  it('moves the head of a 3-chain to the tail (a after c)', () => {
    // chain: a → b → c.  Drop a AFTER c → expected: b → c → a.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });
    const changes = byId(computeLinkingDropChanges('a', 'c', 'after', get));
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: 'c' });
    expect(changes['c']).toEqual({ itemId: 'c', beforeItemId: 'b', afterItemId: 'a' });
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: 'c', afterItemId: null });
  });

  it('swaps the only two members of a 2-chain by dropping b before a', () => {
    // chain: a → b.  Drop b BEFORE a → expected: b → a.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a' },
    });
    const changes = byId(computeLinkingDropChanges('b', 'a', 'before', get));
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: 'a' });
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: 'b', afterItemId: null });
  });

  it('moves a middle item past the tail in a 4-chain (b after d)', () => {
    // chain: a → b → c → d.  Drop b AFTER d → expected: a → c → d → b.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b', after: 'd' },
      d: { before: 'c' },
    });
    const changes = byId(computeLinkingDropChanges('b', 'd', 'after', get));
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: 'c' });
    expect(changes['c']).toEqual({ itemId: 'c', beforeItemId: 'a', afterItemId: 'd' });
    expect(changes['d']).toEqual({ itemId: 'd', beforeItemId: 'c', afterItemId: 'b' });
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: 'd', afterItemId: null });
  });
});

describe('computeLinkingDropChanges — join a group', () => {
  it('joins a standalone item to the end of an existing chain', () => {
    // chain: a → b ; standalone: x.  Drop x AFTER b → expected: a → b → x.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a' },
      x: {},
    });
    const changes = byId(computeLinkingDropChanges('x', 'b', 'after', get));
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: 'a', afterItemId: 'x' });
    expect(changes['x']).toEqual({ itemId: 'x', beforeItemId: 'b', afterItemId: null });
    // `a` is unchanged → no entry in the minimal change set.
    expect(changes['a']).toBeUndefined();
  });

  it('joins a standalone item to the head of an existing chain', () => {
    // chain: a → b ; standalone: x.  Drop x BEFORE a → expected: x → a → b.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a' },
      x: {},
    });
    const changes = byId(computeLinkingDropChanges('x', 'a', 'before', get));
    expect(changes['x']).toEqual({ itemId: 'x', beforeItemId: null, afterItemId: 'a' });
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: 'x', afterItemId: 'b' });
    expect(changes['b']).toBeUndefined();
  });

  it('joins two standalone items (creates a new group)', () => {
    // standalone: a, b.  Drop a BEFORE b → expected: a → b.
    const get = makeGetEffective({ a: {}, b: {} });
    const changes = byId(computeLinkingDropChanges('a', 'b', 'before', get));
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: 'b' });
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: 'a', afterItemId: null });
  });

  it('moves an item from one chain to another, healing the source chain', () => {
    // chain1: a → b → c ; chain2: x → y.  Drop b AFTER y →
    //   expected source: a → c    expected target: x → y → b.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
      x: { after: 'y' },
      y: { before: 'x' },
    });
    const changes = byId(computeLinkingDropChanges('b', 'y', 'after', get));
    // Source chain healed:
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: 'c' });
    expect(changes['c']).toEqual({ itemId: 'c', beforeItemId: 'a', afterItemId: null });
    // Target chain extended:
    expect(changes['y']).toEqual({ itemId: 'y', beforeItemId: 'x', afterItemId: 'b' });
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: 'y', afterItemId: null });
    // `x` is unchanged.
    expect(changes['x']).toBeUndefined();
  });

  it('joins a standalone item between two members of an existing chain', () => {
    // chain: a → b ; standalone: x.  Drop x AFTER a → expected: a → x → b.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a' },
      x: {},
    });
    const changes = byId(computeLinkingDropChanges('x', 'a', 'after', get));
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: 'x' });
    expect(changes['x']).toEqual({ itemId: 'x', beforeItemId: 'a', afterItemId: 'b' });
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: 'x', afterItemId: null });
  });
});

describe('computeLinkingMakeStandaloneChanges', () => {
  it('returns no changes when the item is already standalone', () => {
    const get = makeGetEffective({ a: {} });
    expect(computeLinkingMakeStandaloneChanges('a', get)).toEqual([]);
  });

  it('detaches the middle of a 3-chain and reconnects the neighbors', () => {
    // chain: a → b → c.  Make b standalone → expected: a → c, b standalone.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });
    const changes = byId(computeLinkingMakeStandaloneChanges('b', get));
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: null });
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: 'c' });
    expect(changes['c']).toEqual({ itemId: 'c', beforeItemId: 'a', afterItemId: null });
  });

  it('detaches the head of a 2-chain', () => {
    // chain: a → b.  Make a standalone → expected: a standalone, b standalone.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a' },
    });
    const changes = byId(computeLinkingMakeStandaloneChanges('a', get));
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: null });
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: null });
  });

  it('detaches the tail of a 2-chain', () => {
    // chain: a → b.  Make b standalone → expected: a standalone, b standalone.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a' },
    });
    const changes = byId(computeLinkingMakeStandaloneChanges('b', get));
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: null });
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: null });
  });

  it('detaches the head of a 3-chain', () => {
    // chain: a → b → c.  Make a standalone → expected: a standalone, b → c.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });
    const changes = byId(computeLinkingMakeStandaloneChanges('a', get));
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: null });
    // `b` becomes the new head.
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: 'c' });
    // `c` is untouched, so it may or may not appear in the change list.
  });

  it('detaches the tail of a 3-chain', () => {
    // chain: a → b → c.  Make c standalone → expected: a → b, c standalone.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });
    const changes = byId(computeLinkingMakeStandaloneChanges('c', get));
    expect(changes['c']).toEqual({ itemId: 'c', beforeItemId: null, afterItemId: null });
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: 'a', afterItemId: null });
  });
});

describe('computeLinkingBreakGroupChanges (Task #1281)', () => {
  it('returns three null/null changes for a 3-item chain', () => {
    // chain: a → b → c.  Break-group on [a,b,c] → all three become standalone.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });
    const changes = byId(computeLinkingBreakGroupChanges(['a', 'b', 'c'], get));
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: null });
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: null });
    expect(changes['c']).toEqual({ itemId: 'c', beforeItemId: null, afterItemId: null });
  });

  it('returns two null/null changes for a 2-item chain', () => {
    // chain: a → b.  Break-group on [a,b] → both standalone.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a' },
    });
    const result = computeLinkingBreakGroupChanges(['a', 'b'], get);
    expect(result).toHaveLength(2);
    const changes = byId(result);
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: null });
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: null });
  });

  it('only emits diffs for still-linked members of a partially-broken chain', () => {
    // a is already standalone (broken from chain). b → c is still linked.
    // Break-group on [a, b, c] → only b and c are emitted.
    const get = makeGetEffective({
      a: {},
      b: { after: 'c' },
      c: { before: 'b' },
    });
    const result = computeLinkingBreakGroupChanges(['a', 'b', 'c'], get);
    expect(result).toHaveLength(2);
    const changes = byId(result);
    expect(changes['a']).toBeUndefined();
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: null });
    expect(changes['c']).toEqual({ itemId: 'c', beforeItemId: null, afterItemId: null });
  });

  it('returns an empty array when every member is already standalone', () => {
    // All standalone → no diffs at all.
    const get = makeGetEffective({ a: {}, b: {}, c: {} });
    expect(computeLinkingBreakGroupChanges(['a', 'b', 'c'], get)).toEqual([]);
  });

  it('returns an empty array for a non-existent chain (unknown ids)', () => {
    // Unknown ids resolve to before=null/after=null via the fallback in
    // makeGetEffective, so they're treated as standalone and skipped.
    const get = makeGetEffective({});
    expect(computeLinkingBreakGroupChanges(['nope1', 'nope2'], get)).toEqual([]);
  });

  it('returns an empty array for an empty input list', () => {
    const get = makeGetEffective({ a: { after: 'b' }, b: { before: 'a' } });
    expect(computeLinkingBreakGroupChanges([], get)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Task #1372 — Stale-neighbor sweep tests
//
// These tests simulate the root-cause scenario: the visible chain in the UI
// is smaller than the server's real chain because optimistic overrides or
// stale renders have diverged from server truth.  When the admin clicks
// "Break chain" (or makes standalone, or drops) the change computer must
// still emit decisions for every item whose persisted before/after points
// into the affected set, even if those items are invisible in the current UI.
// ---------------------------------------------------------------------------

/**
 * Build a persistedPointerMap from a chain map.
 * This is the full server-persisted state (no optimistic overrides).
 */
function makePersistedMap(
  map: Record<string, Partial<{ before: string | null; after: string | null }>>,
): Map<string, { before: string | null; after: string | null }> {
  const result = new Map<string, { before: string | null; after: string | null }>();
  for (const [id, v] of Object.entries(map)) {
    result.set(id, { before: v.before ?? null, after: v.after ?? null });
  }
  return result;
}

describe('Task #1372 — computeLinkingBreakGroupChanges stale-neighbor sweep', () => {
  it('emits a correction for an invisible item whose persisted before points into the break set', () => {
    // Server truth: a → b → c → d  (d is invisible in the UI; admin sees a → b → c only)
    // getEffective reflects the visible chain (a, b, c) — d is not visible via overrides.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
      // d is in the full items list but NOT passed to getEffective here —
      // simulating that it's not visible in the current optimistic chain.
    });
    const persisted = makePersistedMap({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b', after: 'd' },
      d: { before: 'c' },
    });

    const result = computeLinkingBreakGroupChanges(['a', 'b', 'c'], get, persisted);
    const changes = byId(result);

    // Primary changes: all visible chain members become standalone.
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: null });
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: null });
    expect(changes['c']).toEqual({ itemId: 'c', beforeItemId: null, afterItemId: null });
    // Stale-neighbor correction: d.before was c (now being nulled) → emit d with before = null.
    expect(changes['d']).toEqual({ itemId: 'd', beforeItemId: null, afterItemId: null });
  });

  it('emits a correction for an invisible item whose persisted after points into the break set', () => {
    // Server truth: z → a → b  (z is invisible; admin sees a → b only)
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a' },
    });
    const persisted = makePersistedMap({
      z: { after: 'a' },
      a: { before: 'z', after: 'b' },
      b: { before: 'a' },
    });

    const result = computeLinkingBreakGroupChanges(['a', 'b'], get, persisted);
    const changes = byId(result);

    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: null });
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: null });
    // z.after was a (now being nulled) → emit z with after = null.
    expect(changes['z']).toEqual({ itemId: 'z', beforeItemId: null, afterItemId: null });
  });

  it('corrects an invisible item sandwiched between broken items on both sides', () => {
    // Visible chain: a → c (with b invisible but persisted between them)
    // Server truth: a → b → c  (b is invisible due to stale override)
    const get = makeGetEffective({
      a: { after: 'c' },
      c: { before: 'a' },
    });
    const persisted = makePersistedMap({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });

    const result = computeLinkingBreakGroupChanges(['a', 'c'], get, persisted);
    const changes = byId(result);

    // a and c: currently linked via effective override, emit both.
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: null });
    expect(changes['c']).toEqual({ itemId: 'c', beforeItemId: null, afterItemId: null });
    // b: persisted before = a (in break set), persisted after = c (in break set) → both nulled.
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: null });
  });

  it('does not emit a correction when the persisted pointer does not reference a break-set item', () => {
    // Standalone item x has no pointer into the break set.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a' },
    });
    const persisted = makePersistedMap({
      a: { after: 'b' },
      b: { before: 'a' },
      x: { before: null, after: null },
    });

    const result = computeLinkingBreakGroupChanges(['a', 'b'], get, persisted);
    const changes = byId(result);

    expect(changes['x']).toBeUndefined();
  });

  it('behaves identically to no-persistedMap when the map is omitted', () => {
    // Regression guard: passing no persistedPointerMap must not change existing behaviour.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a' },
    });
    const result = computeLinkingBreakGroupChanges(['a', 'b'], get);
    const changes = byId(result);
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: null });
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: null });
    expect(result).toHaveLength(2);
  });
});

describe('Task #1372 — computeLinkingMakeStandaloneChanges stale-neighbor sweep', () => {
  it('emits a correction for an invisible item whose persisted before = dragId', () => {
    // Server truth: a → b → c → d  (d invisible; admin sees a → b → c)
    // Making c standalone should also null d.before (which persistently = c).
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });
    const persisted = makePersistedMap({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b', after: 'd' },
      d: { before: 'c' },
    });

    const result = computeLinkingMakeStandaloneChanges('c', get, persisted);
    const changes = byId(result);

    // c is made standalone.
    expect(changes['c']).toEqual({ itemId: 'c', beforeItemId: null, afterItemId: null });
    // b's after was c, now becomes null since c is being removed from the chain.
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: 'a', afterItemId: null });
    // d: persisted before = c (dragId being set to {before:null,after:null}) → correct.
    expect(changes['d']).toEqual({ itemId: 'd', beforeItemId: null, afterItemId: null });
  });

  it('does not emit unnecessary corrections when the sweep finds no stale neighbors', () => {
    // Closed chain a → b → c; no invisible items.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });
    const persisted = makePersistedMap({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });

    const result = computeLinkingMakeStandaloneChanges('b', get, persisted);
    const changes = byId(result);

    // Only the three items directly involved are emitted.
    expect(Object.keys(changes)).toHaveLength(3);
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: 'c' });
    expect(changes['c']).toEqual({ itemId: 'c', beforeItemId: 'a', afterItemId: null });
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: null });
  });
});

describe('Task #1372 — computeLinkingDropChanges stale-neighbor sweep', () => {
  it('corrects an item whose persisted before references a moved item that no longer points back', () => {
    // Server truth: a → b → c → d (d is invisible to the UI via stale effective state)
    // UI effective state: a → b → c (d is not reachable via getEffective)
    // Admin drags a to after c. Source chain without a = [b → c].
    // After drop: newSequence = [b → c → a], srcWithoutDrag = [b → c].
    // The change computer sees: b: {before:null,after:c}, c: {before:b,after:a}, a:{before:c,after:null}
    // d has persisted before = c, but c.after is now 'a' (not d) → stale, emit correction.
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });
    const persisted = makePersistedMap({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b', after: 'd' },
      d: { before: 'c' },
    });

    const result = computeLinkingDropChanges('a', 'c', 'after', get, persisted);
    const changes = byId(result);

    // Primary chain changes.
    expect(changes['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: 'c' });
    expect(changes['c']).toEqual({ itemId: 'c', beforeItemId: 'b', afterItemId: 'a' });
    expect(changes['a']).toEqual({ itemId: 'a', beforeItemId: 'c', afterItemId: null });
    // Stale-neighbor correction: d.before was c, but c.after is now 'a' → d gets before = null.
    expect(changes['d']).toEqual({ itemId: 'd', beforeItemId: null, afterItemId: null });
  });
});

// ---------------------------------------------------------------------------
// Task #1372 — E2E bidirectional consistency test
//
// This test replicates the exact production bug scenario end-to-end:
//
//   Server truth:   a → b → c → d     (d is invisible in the UI)
//   UI visible:     a → b → c         (d missing due to stale optimistic state)
//   Admin action:   "Break chain" on the visible chain [a, b, c]
//
// Pre-fix: the change computer only emitted decisions for a, b, c.  The
// server's bidirectional guard saw that d.before still pointed to c, but c's
// new decision said after:null — a violation → 409 toast.
//
// Post-fix: computeLinkingBreakGroupChanges emits a correction for d as well
// (d → {before:null, after:null}).  This test verifies two things:
//   1. All four items are covered in the decisions array.
//   2. The decisions are bidirectionally consistent — i.e. the server-side
//      guard would accept every individual decision without seeing any
//      pointer that isn't balanced by a matching decision in the same batch.
//
// "Bidirectionally consistent batch" definition used here (mirrors the
// server-side guard in `server/api/bulk-import.ts`):
//   For every decision D with D.beforeItemId = X (≠ null):
//     either X also has a decision in the batch whose afterItemId = D.itemId,
//     or the persisted state of X already has after = D.itemId.
//   Symmetrically for afterItemId / beforeItemId.
// ---------------------------------------------------------------------------

/**
 * Applies a batch of decisions against a persisted map and returns the
 * updated map (does not mutate the original).
 */
function applyDecisions(
  persisted: Map<string, { before: string | null; after: string | null }>,
  decisions: LinkingChange[],
): Map<string, { before: string | null; after: string | null }> {
  const result = new Map(persisted);
  for (const d of decisions) {
    result.set(d.itemId, { before: d.beforeItemId, after: d.afterItemId });
  }
  return result;
}

/**
 * Checks that a batch of decisions is bidirectionally consistent against the
 * given persisted state.  Returns a list of violation strings (empty = ok).
 *
 * This mirrors the logic in the server-side bidirectional guard so we can
 * prove the client-side fix produces a batch the server will accept.
 */
function findBidirectionalViolations(
  persisted: Map<string, { before: string | null; after: string | null }>,
  decisions: LinkingChange[],
): string[] {
  const decisionMap = new Map<string, LinkingChange>(
    decisions.map((d) => [d.itemId, d]),
  );
  const effective = applyDecisions(persisted, decisions);

  const violations: string[] = [];

  for (const [id, state] of effective) {
    if (state.before !== null) {
      const neighborState = effective.get(state.before);
      if (neighborState && neighborState.after !== id) {
        violations.push(
          `${id}.before=${state.before} but ${state.before}.after=${neighborState.after} (expected ${id})`,
        );
      }
    }
    if (state.after !== null) {
      const neighborState = effective.get(state.after);
      if (neighborState && neighborState.before !== id) {
        violations.push(
          `${id}.after=${state.after} but ${state.after}.before=${neighborState.before} (expected ${id})`,
        );
      }
    }
  }

  return violations;
}

describe('Task #1372 — E2E bidirectional consistency: Break chain with invisible stale neighbor', () => {
  it('produces a bidirectionally consistent decision batch for the exact bug scenario (a→b→c→d, UI sees a→b→c)', () => {
    // Server truth persisted on the server.
    const persisted = makePersistedMap({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b', after: 'd' },
      d: { before: 'c' },
    });

    // UI effective state: d is invisible (optimistic override skipped it).
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });

    // Admin clicks "Break chain" on the visible chain [a, b, c].
    const decisions = computeLinkingBreakGroupChanges(['a', 'b', 'c'], get, persisted);
    const byDecisionId = byId(decisions);

    // 1. All four items must be covered.
    expect(Object.keys(byDecisionId)).toHaveLength(4);
    expect(byDecisionId['a']).toEqual({ itemId: 'a', beforeItemId: null, afterItemId: null });
    expect(byDecisionId['b']).toEqual({ itemId: 'b', beforeItemId: null, afterItemId: null });
    expect(byDecisionId['c']).toEqual({ itemId: 'c', beforeItemId: null, afterItemId: null });
    expect(byDecisionId['d']).toEqual({ itemId: 'd', beforeItemId: null, afterItemId: null });

    // 2. Applying all decisions to the persisted state must produce zero
    //    bidirectional violations — i.e. the server's guard would accept
    //    the batch.
    const violations = findBidirectionalViolations(persisted, decisions);
    expect(violations).toHaveLength(0);
  });

  it('pre-fix simulation — omitting the stale neighbor produces a bidirectional violation', () => {
    // This test documents the bug that was fixed: without the persisted map,
    // computeLinkingBreakGroupChanges only emits decisions for visible items.
    // When applied to the full persisted state, d still points to c, but c
    // now has after:null — a violation.
    const persisted = makePersistedMap({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b', after: 'd' },
      d: { before: 'c' },
    });
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });

    // Pre-fix: no persistedPointerMap → only a, b, c receive decisions.
    const decisionsWithoutSweep = computeLinkingBreakGroupChanges(['a', 'b', 'c'], get);
    expect(Object.keys(byId(decisionsWithoutSweep))).toHaveLength(3);
    expect(byId(decisionsWithoutSweep)['d']).toBeUndefined();

    // Applying only the 3-item batch: d.before=c (persisted) but c.after=null
    // → bidirectional violation that the server correctly rejects.
    const violations = findBidirectionalViolations(persisted, decisionsWithoutSweep);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toMatch(/d\.before=c.*c\.after=null/);
  });
});

describe('Task #1372 — E2E bidirectional consistency: Drop with invisible stale neighbor', () => {
  it('produces a bidirectionally consistent decision batch for a drop that exposes an invisible tail neighbor', () => {
    // Server truth: a→b→c→d (d invisible)
    // Admin drags a to after c (UI rearranges the visible chain).
    const persisted = makePersistedMap({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b', after: 'd' },
      d: { before: 'c' },
    });
    const get = makeGetEffective({
      a: { after: 'b' },
      b: { before: 'a', after: 'c' },
      c: { before: 'b' },
    });

    const decisions = computeLinkingDropChanges('a', 'c', 'after', get, persisted);
    const violations = findBidirectionalViolations(persisted, decisions);
    expect(violations).toHaveLength(0);

    // d must be included: c.after was 'd' (persisted) but c.after is now 'a'.
    const byDecisionId = byId(decisions);
    expect(byDecisionId['d']).toBeDefined();
    expect(byDecisionId['d']!.beforeItemId).toBeNull();
  });
});
