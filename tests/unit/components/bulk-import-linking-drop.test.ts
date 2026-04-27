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
