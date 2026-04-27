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
 * Stale-neighbor sweep (Task #1372).
 *
 * After computing the primary changes for a linking action, this helper
 * scans every item in `persistedPointerMap` that is NOT already covered by
 * `changes`.  If such an item has a persisted before/after pointer that
 * references an item in `changes`, and the changed item's proposed new
 * pointer no longer points back to this item, a correction entry is added
 * to `changes` so the server's bidirectional guard never sees a half-update.
 *
 * This is the root-cause fix for the "Bidirectional inconsistency" toast:
 * when the UI renders a stale chain (missing members that the server still
 * has chained) the primary change set only covers visible nodes; this sweep
 * catches the invisible neighbors and emits null-outs for their dangling
 * pointers.
 */
function sweepStaleNeighbors(
  changes: Map<string, { beforeItemId: string | null; afterItemId: string | null }>,
  persistedPointerMap: Map<string, LinkingEffective>,
  /** Optional: ids added by the sweep are recorded here so callers can
   *  bypass getEffective-based dedup for invisible items. */
  sweepIds?: Set<string>,
): void {
  for (const [id, persisted] of persistedPointerMap) {
    if (changes.has(id)) continue;

    let corrBefore = persisted.before;
    let corrAfter = persisted.after;
    let needsCorrection = false;

    if (persisted.before !== null && changes.has(persisted.before)) {
      const changedNeighbor = changes.get(persisted.before)!;
      if (changedNeighbor.afterItemId !== id) {
        corrBefore = null;
        needsCorrection = true;
      }
    }

    if (persisted.after !== null && changes.has(persisted.after)) {
      const changedNeighbor = changes.get(persisted.after)!;
      if (changedNeighbor.beforeItemId !== id) {
        corrAfter = null;
        needsCorrection = true;
      }
    }

    if (needsCorrection) {
      changes.set(id, { beforeItemId: corrBefore, afterItemId: corrAfter });
      sweepIds?.add(id);
    }
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
 *
 * `persistedPointerMap` (Task #1372): when provided, a stale-neighbor
 * sweep is run after the primary changes are computed, ensuring that any
 * item outside the visible chains whose persisted pointer still references
 * a mutated item also receives a nulling correction.
 */
export function computeLinkingDropChanges(
  dragId: string,
  targetId: string,
  position: 'before' | 'after',
  getEffective: (id: string) => LinkingEffective,
  persistedPointerMap?: Map<string, LinkingEffective>,
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

  // Task #1372: track ids added by the sweep so the output filter can bypass
  // getEffective() for invisible items (their effective fallback is null/null,
  // which would incorrectly match a {before:null,after:null} correction and
  // cause the correction to be silently dropped).
  const sweepIds = new Set<string>();
  if (persistedPointerMap) {
    sweepStaleNeighbors(changes, persistedPointerMap, sweepIds);
  }

  const out: LinkingChange[] = [];
  for (const [id, v] of changes) {
    // Sweep-added corrections are always emitted: the persisted server state
    // has a non-null pointer that must be nulled.  We cannot use getEffective
    // here because invisible items return the null/null fallback.
    if (sweepIds.has(id)) {
      out.push({ itemId: id, beforeItemId: v.beforeItemId, afterItemId: v.afterItemId });
      continue;
    }
    // Task #1422: When a persistedPointerMap is provided, compare against the
    // persisted server state rather than getEffective() to avoid silently
    // dropping a real persisted-state change for a chain member whose optimistic
    // override already reports the target value but the server has a different
    // pointer stored.
    if (persistedPointerMap) {
      const p = persistedPointerMap.get(id);
      if (!p || p.before !== v.beforeItemId || p.after !== v.afterItemId) {
        out.push({ itemId: id, beforeItemId: v.beforeItemId, afterItemId: v.afterItemId });
      }
    } else {
      const eff = getEffective(id);
      if (eff.before !== v.beforeItemId || eff.after !== v.afterItemId) {
        out.push({ itemId: id, beforeItemId: v.beforeItemId, afterItemId: v.afterItemId });
      }
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
 *
 * `persistedPointerMap` (Task #1372): when provided, a stale-neighbor
 * sweep nulls out dangling pointers on items outside the visible chain
 * that still reference `dragId` in their persisted state.
 */
export function computeLinkingMakeStandaloneChanges(
  dragId: string,
  getEffective: (id: string) => LinkingEffective,
  persistedPointerMap?: Map<string, LinkingEffective>,
): LinkingChange[] {
  const eff = getEffective(dragId);
  // Task #1422: Only short-circuit when the item is already standalone in
  // BOTH the effective (override-walked) view AND the persisted server state.
  // If the effective state says (null, null) but the server still has non-null
  // pointers (stale optimistic override), we must still emit a null/null
  // decision for dragId and let the sweep correct its persisted neighbors.
  if (!eff.before && !eff.after) {
    const persisted = persistedPointerMap?.get(dragId);
    if (!persisted || (!persisted.before && !persisted.after)) return [];
  }

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

  if (persistedPointerMap) {
    sweepStaleNeighbors(changes, persistedPointerMap);
  }

  return Array.from(changes.entries()).map(([itemId, v]) => ({ itemId, ...v }));
}

// ---------------------------------------------------------------------------
// Task #1425: Family-group resolver
// ---------------------------------------------------------------------------

/**
 * A single item-to-family membership as returned by the API.
 * All fields that are required for rendering are made non-optional here.
 */
export interface FamilyMembership {
  id: string;
  itemId: string;
  familyId: string | null;
  familyName: string | null;
  neighborDocumentId: string | null;
  position: 'before' | 'after' | null;
  source: 'ai' | 'manual';
  manualOverride: boolean;
  aiConfidence: number | null;
  reason: string | null;
}

/** An item in the family-group view. Must carry its memberships. */
export interface FamilyGroupItemShape {
  id: string;
  memberships: FamilyMembership[];
}

/** One named family bucket in the Linking step. */
export interface FamilyGroup<T extends FamilyGroupItemShape = FamilyGroupItemShape> {
  /** Null ⟹ the "Unassigned" bucket. */
  familyId: string | null;
  familyName: string;
  items: T[];
  /**
   * Deduplicated, ordered memberships across all items in this group,
   * keyed by item id, so the row can render its neighbor + position without
   * re-querying.
   */
  membershipByItemId: Map<string, FamilyMembership>;
}

/**
 * Task #1425 – Resolve a flat list of bulk-import items (each carrying their
 * `memberships[]`) into an ordered list of named family groups plus an
 * "Unassigned" bucket for items with no memberships.
 *
 * Items can appear in **multiple** groups (many-to-many).
 *
 * Algorithm:
 *  1. Collect all unique familyIds across all items.
 *  2. Build a map of familyId → { familyId, familyName, items[], membershipByItemId }.
 *  3. Walk every item: for each of its memberships, add it to the appropriate group.
 *  4. Items with zero memberships go into the Unassigned bucket (familyId=null).
 *  5. Sort groups: named families first (alphabetical), Unassigned last.
 */
export function resolveFamilyGroups<T extends FamilyGroupItemShape>(
  items: T[],
): { groups: FamilyGroup<T>[]; unassignedItems: T[] } {
  const groupMap = new Map<string, FamilyGroup<T>>();
  const unassignedItems: T[] = [];

  for (const item of items) {
    const validMemberships = item.memberships.filter(
      (m): m is FamilyMembership & { familyId: string } => !!m.familyId,
    );

    if (validMemberships.length === 0) {
      unassignedItems.push(item);
      continue;
    }

    for (const m of validMemberships) {
      let group = groupMap.get(m.familyId);
      if (!group) {
        group = {
          familyId: m.familyId,
          familyName: m.familyName ?? m.familyId,
          items: [],
          membershipByItemId: new Map(),
        };
        groupMap.set(m.familyId, group);
      }
      // Only add the item once per group even if it has multiple memberships
      // to the same family (defensive: the unique constraint prevents this).
      if (!group.membershipByItemId.has(item.id)) {
        group.items.push(item);
      }
      group.membershipByItemId.set(item.id, m);
    }
  }

  const namedGroups = Array.from(groupMap.values()).sort((a, b) =>
    a.familyName.localeCompare(b.familyName, undefined, { sensitivity: 'base' }),
  );

  return { groups: namedGroups, unassignedItems };
}

/**
 * Pure computation behind "Break group" / `handleLinkingBreakGroup`.
 *
 * Detaches every member of a chain at once: each item ends up with
 * `beforeItemId: null, afterItemId: null`.  Items that are already
 * standalone (both pointers null) are skipped so the persisted batch
 * contains only real diffs.  Returns an empty array when no item in
 * `itemIds` is currently linked.
 *
 * `persistedPointerMap` (Task #1372): when provided, a stale-neighbor
 * sweep scans every item in the map that is NOT in `itemIds`.  If such
 * an item's persisted before/after still points into the break set, a
 * correction entry (nulling that pointer) is added so the server's
 * bidirectional guard never rejects the batch due to a stale invisible
 * neighbor.  This is the direct fix for the "Bidirectional inconsistency"
 * toast reported in Task #1372.
 */
export function computeLinkingBreakGroupChanges(
  itemIds: string[],
  getEffective: (id: string) => LinkingEffective,
  persistedPointerMap?: Map<string, LinkingEffective>,
): LinkingChange[] {
  const breakSet = new Set(itemIds);

  const changesMap = new Map<string, { beforeItemId: string | null; afterItemId: string | null }>();
  for (const id of itemIds) {
    const eff = getEffective(id);
    // Task #1422: When a persistedPointerMap is provided, only skip this item
    // if BOTH the effective (override-walked) state AND the persisted server
    // state are already (null, null).  A stale optimistic override can make an
    // item look standalone on the client while the server still has non-null
    // before/after pointers; without this check, no null/null decision is sent
    // for that item and the server's bidirectional guard rejects the batch.
    if (eff.before === null && eff.after === null) {
      if (!persistedPointerMap) continue;
      const persisted = persistedPointerMap.get(id);
      if (!persisted || (persisted.before === null && persisted.after === null)) continue;
    }
    changesMap.set(id, { beforeItemId: null, afterItemId: null });
  }

  if (persistedPointerMap) {
    for (const [id, persisted] of persistedPointerMap) {
      if (breakSet.has(id)) continue;

      const staleBefore = persisted.before !== null && breakSet.has(persisted.before);
      const staleAfter = persisted.after !== null && breakSet.has(persisted.after);
      if (!staleBefore && !staleAfter) continue;

      const corrBefore = staleBefore ? null : persisted.before;
      const corrAfter = staleAfter ? null : persisted.after;
      changesMap.set(id, { beforeItemId: corrBefore, afterItemId: corrAfter });
    }
  }

  return Array.from(changesMap.entries()).map(([itemId, v]) => ({ itemId, ...v }));
}
