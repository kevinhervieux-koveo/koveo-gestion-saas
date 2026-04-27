/**
 * Task #1233 — Utility: resolve bulk-import linking-step item chains.
 *
 * Extracted to a separate file so it can be unit-tested independently
 * of the large BulkDocumentImportPage component.
 */

/** Minimal shape required by resolveLinkingGroups (structural typing). */
export interface LinkingItemShape {
  id: string;
  linkingAfterItemId: string | null;
  linkingManualOverride: boolean;
}

/** A visual group of linked items in the Linking step. */
export interface LinkingGroup<T extends LinkingItemShape = LinkingItemShape> {
  /** The ID of the first item in the chain (used as the React key). */
  id: string;
  items: T[];
  isManual: boolean;
}

/**
 * Resolves the flat list of linking-step items into an ordered list of groups
 * (chains of 2+ linked items) plus a set of standalone item IDs.
 *
 * Algorithm:
 *  1. Build a map of item-id → item.
 *  2. Determine which items are pointed-to as "after" of some other item;
 *     those can never be chain heads.
 *  3. For each valid head, walk the chain via `linkingAfterItemId`, guarding
 *     against cycles by tracking visited nodes.
 *  4. Chains with length ≥ 2 become groups; single-node "chains" are standalone.
 *  5. Any unvisited items that still point somewhere (headless cycles) are
 *     detected, their offending edge is broken, and all members become
 *     standalone.
 *
 * `overrides` is an optional map of itemId → {afterItemId} that is merged
 * over the persisted values so optimistic drops are reflected immediately
 * in the UI without waiting for a server round-trip.
 */
export function resolveLinkingGroups<T extends LinkingItemShape>(
  items: T[],
  overrides?: Map<string, { beforeItemId: string | null; afterItemId: string | null }>,
): { groups: LinkingGroup<T>[]; standaloneIds: Set<string> } {
  const effectiveAfter = (item: T): string | null => {
    const ov = overrides?.get(item.id);
    return ov !== undefined ? ov.afterItemId : item.linkingAfterItemId;
  };

  const itemMap = new Map<string, T>(items.map((i) => [i.id, i]));

  const pointedToAsAfter = new Set<string>();
  for (const item of items) {
    const next = effectiveAfter(item);
    if (next && itemMap.has(next)) pointedToAsAfter.add(next);
  }

  const visited = new Set<string>();
  const groups: LinkingGroup<T>[] = [];

  for (const head of items) {
    if (visited.has(head.id)) continue;
    if (pointedToAsAfter.has(head.id)) continue;
    const nextId = effectiveAfter(head);
    if (!nextId || !itemMap.has(nextId)) continue;

    const chain: T[] = [];
    const chainVisited = new Set<string>();
    let cursor: T | undefined = head;
    while (cursor && !chainVisited.has(cursor.id)) {
      chainVisited.add(cursor.id);
      visited.add(cursor.id);
      chain.push(cursor);
      const nid = effectiveAfter(cursor);
      if (nid && chainVisited.has(nid)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[bulk-import] resolveLinkingGroups: cycle detected, breaking edge', cursor.id, '→', nid);
        }
        break;
      }
      cursor = nid ? itemMap.get(nid) : undefined;
    }

    if (chain.length >= 2) {
      const isManual = chain.some((i) => {
        const ov = overrides?.get(i.id);
        return ov !== undefined || i.linkingManualOverride;
      });
      groups.push({ id: chain[0].id, items: chain, isManual });
    } else {
      for (const item of chain) visited.delete(item.id);
    }
  }

  /**
   * Headless cycle detection: any item not yet visited but with a valid
   * afterItemId points into a ring where every member has a predecessor
   * and so was skipped as a potential head.  Walk each such component,
   * log the broken edge, and leave all members as standalone.
   */
  const unvisited = items.filter((i) => !visited.has(i.id));
  const unvisitedSet = new Set(unvisited.map((i) => i.id));

  const cycleProcessed = new Set<string>();
  for (const startItem of unvisited) {
    if (cycleProcessed.has(startItem.id)) continue;
    const next = effectiveAfter(startItem);
    if (!next || !unvisitedSet.has(next)) continue;

    const cyclePath: string[] = [];
    const pathSet = new Set<string>();
    let cur: string | undefined = startItem.id;
    while (cur && !cycleProcessed.has(cur)) {
      if (pathSet.has(cur)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[bulk-import] resolveLinkingGroups: headless cycle detected, breaking at', cur, '(members:', cyclePath.join(' → '), ')');
        }
        for (const id of cyclePath) cycleProcessed.add(id);
        break;
      }
      pathSet.add(cur);
      cyclePath.push(cur);
      const nid = effectiveAfter(itemMap.get(cur)!);
      cur = nid && unvisitedSet.has(nid) ? nid : undefined;
    }
    for (const id of cyclePath) cycleProcessed.add(id);
  }

  const standaloneIds = new Set<string>();
  for (const item of items) {
    if (!visited.has(item.id)) standaloneIds.add(item.id);
  }

  return { groups, standaloneIds };
}

/** Effective before/after pointers for a single item, after overrides. */
export interface LinkingEffective {
  before: string | null;
  after: string | null;
}

/** A persisted linking-chain edit for one item. */
export interface LinkingChange {
  itemId: string;
  beforeItemId: string | null;
  afterItemId: string | null;
}

/**
 * Walk backwards then forwards from `startId` using `getEffective` to
 * build the full ordered chain that contains `startId`.  Both walks are
 * cycle-guarded so a corrupt persisted/optimistic state can never cause
 * an infinite loop.
 */
function getChainOrder(
  startId: string,
  getEffective: (id: string) => LinkingEffective,
): string[] {
  const backSeen = new Set<string>();
  let headId = startId;
  while (true) {
    const eff = getEffective(headId);
    if (!eff.before || backSeen.has(eff.before)) break;
    backSeen.add(headId);
    headId = eff.before;
  }
  const chain: string[] = [];
  const fwdSeen = new Set<string>();
  let cur: string | null = headId;
  while (cur && !fwdSeen.has(cur)) {
    fwdSeen.add(cur);
    chain.push(cur);
    cur = getEffective(cur).after;
  }
  return chain;
}

function sequenceToChanges(
  seq: string[],
  out: Map<string, { beforeItemId: string | null; afterItemId: string | null }>,
) {
  for (let i = 0; i < seq.length; i++) {
    out.set(seq[i], {
      beforeItemId: i > 0 ? seq[i - 1] : null,
      afterItemId: i < seq.length - 1 ? seq[i + 1] : null,
    });
  }
}

/**
 * Pure computation behind `handleLinkingDrop`.
 *
 * Given a `dragId` being dropped onto `targetId` at `position`
 * ('before' | 'after'), returns the minimal set of `LinkingChange`s
 * (only items whose effective before/after actually changed) needed to
 * realize the drop.  Returns an empty array when the drop is a no-op
 * (e.g. dragging onto itself, or the resulting topology equals the
 * current one).
 *
 * Algorithm: collect both the source chain (the chain `dragId` is
 * leaving) and the target chain (the chain it's joining), splice
 * `dragId` into the target chain at the requested position, then
 * regenerate consistent before/after pairs for every member of both
 * chains.  Pure: no React state and no network calls.
 */
export function computeLinkingDropChanges(
  dragId: string,
  targetId: string,
  position: 'before' | 'after',
  getEffective: (id: string) => LinkingEffective,
): LinkingChange[] {
  if (dragId === targetId) return [];

  const dragChain = getChainOrder(dragId, getEffective);
  const targetChain = getChainOrder(targetId, getEffective);
  const dragChainSet = new Set(dragChain);

  const srcWithoutDrag = dragChain.filter((id) => id !== dragId);
  const isIntraChain = dragChainSet.has(targetId);

  let newSequence: string[];
  if (isIntraChain) {
    const idx = srcWithoutDrag.indexOf(targetId);
    const insertAt = position === 'before' ? idx : idx + 1;
    srcWithoutDrag.splice(insertAt, 0, dragId);
    newSequence = srcWithoutDrag;
  } else {
    const targetSeq = [...targetChain];
    const idx = targetSeq.indexOf(targetId);
    const insertAt = position === 'before' ? idx : idx + 1;
    targetSeq.splice(insertAt, 0, dragId);
    newSequence = targetSeq;
  }

  const changes = new Map<string, { beforeItemId: string | null; afterItemId: string | null }>();
  sequenceToChanges(newSequence, changes);
  if (!isIntraChain) {
    sequenceToChanges(srcWithoutDrag, changes);
  }

  const out: LinkingChange[] = [];
  for (const [id, v] of changes) {
    const eff = getEffective(id);
    if (eff.before !== v.beforeItemId || eff.after !== v.afterItemId) {
      out.push({ itemId: id, beforeItemId: v.beforeItemId, afterItemId: v.afterItemId });
    }
  }
  return out;
}

/**
 * Pure computation behind `handleLinkingMakeStandalone`.
 *
 * Detaches `dragId` from whatever chain it belongs to (sets its
 * before/after to null) and reconnects its former neighbors so the
 * remaining chain stays consistent.  Returns an empty array when the
 * item is already standalone.
 */
export function computeLinkingMakeStandaloneChanges(
  dragId: string,
  getEffective: (id: string) => LinkingEffective,
): LinkingChange[] {
  const eff = getEffective(dragId);
  if (!eff.before && !eff.after) return [];

  const changes = new Map<string, { beforeItemId: string | null; afterItemId: string | null }>();
  const set = (id: string, b: string | null, a: string | null) =>
    changes.set(id, { beforeItemId: b, afterItemId: a });
  const cur = (id: string) =>
    changes.get(id) ?? {
      beforeItemId: getEffective(id).before,
      afterItemId: getEffective(id).after,
    };

  if (eff.before) {
    const c = cur(eff.before);
    set(eff.before, c.beforeItemId, eff.after);
  }
  if (eff.after) {
    const c = cur(eff.after);
    set(eff.after, eff.before, c.afterItemId);
  }
  set(dragId, null, null);

  return Array.from(changes.entries()).map(([itemId, v]) => ({ itemId, ...v }));
}

/**
 * Pure computation behind "Break group" / `handleLinkingBreakGroup`.
 *
 * Detaches every member of a chain at once: each item ends up with
 * `beforeItemId: null, afterItemId: null`.  Items that are already
 * standalone (both pointers null) are skipped so the persisted batch
 * contains only real diffs.  Returns an empty array when no item in
 * `itemIds` is currently linked.
 */
export function computeLinkingBreakGroupChanges(
  itemIds: string[],
  getEffective: (id: string) => LinkingEffective,
): LinkingChange[] {
  const out: LinkingChange[] = [];
  for (const id of itemIds) {
    const eff = getEffective(id);
    if (eff.before === null && eff.after === null) continue;
    out.push({ itemId: id, beforeItemId: null, afterItemId: null });
  }
  return out;
}
