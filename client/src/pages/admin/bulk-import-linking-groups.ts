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
