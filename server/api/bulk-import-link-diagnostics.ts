/**
 * Task #1269 — Bidirectional linking-chain diagnostics for bulk-import sessions.
 *
 * The `set-linking-decision` and `batch-set-linking-decisions` endpoints
 * (Task #1254) reject any *write* that would leave the persisted
 * `linkDecisions` graph bidirectionally inconsistent. That guard is
 * defensive but it has a sharp edge: sessions whose database state was
 * already corrupt before the guard shipped (legacy data, half-finished
 * writes from before the guard, a crashed batch, etc.) cannot be edited
 * any more — every admin save bounces with a "Bidirectional
 * inconsistency" error pointing at rows the admin never touched.
 *
 * This module exposes the *same* check as a read-only diagnostic so we
 * can:
 *   - Surface pre-existing corruption to admins via the audit script
 *     (`scripts/audit-bulk-import-link-chains.ts`).
 *   - Optionally repair it by clearing the dangling pointers in place
 *     (`scripts/audit-bulk-import-link-chains.ts --repair`).
 *
 * The function is intentionally pure: no DB access, no logging, no
 * side effects. Callers feed in the `{id, linkDecisions}` rows for one
 * session and get back a list of every offending pointer with the
 * neighbor it was pointing at, so the caller can render or repair the
 * issue without needing to re-derive the diagnosis.
 */

export type LinkDecisionsLike = {
  beforeItemId?: string | null;
  afterItemId?: string | null;
} & Record<string, unknown>;

export interface LinkChainItem {
  id: string;
  linkDecisions: LinkDecisionsLike | null;
}

/**
 * One bidirectional-consistency violation discovered in a session.
 *
 * - `kind` describes the shape of the problem so callers can group /
 *   filter / repair selectively.
 * - `itemId` is the row whose `linkDecisions` carries the bad pointer.
 * - `neighborId` is the row the bad pointer targets.
 * - `neighborMissing` is true when the targeted neighbor is not in the
 *   same session at all (deleted out from under the pointer, or never
 *   belonged here). Otherwise the neighbor exists but its mirror
 *   pointer is wrong; `neighborMirror` reports what the mirror
 *   currently holds (`null` when unset).
 * - `message` is a single human-readable line so the script can print
 *   it verbatim and tests can match on it.
 */
export type LinkChainViolation =
  | {
      kind: 'after_neighbor_missing';
      itemId: string;
      field: 'after';
      neighborId: string;
      neighborMissing: true;
      message: string;
    }
  | {
      kind: 'before_neighbor_missing';
      itemId: string;
      field: 'before';
      neighborId: string;
      neighborMissing: true;
      message: string;
    }
  | {
      kind: 'after_not_mirrored';
      itemId: string;
      field: 'after';
      neighborId: string;
      neighborMissing: false;
      neighborMirror: string | null;
      message: string;
    }
  | {
      kind: 'before_not_mirrored';
      itemId: string;
      field: 'before';
      neighborId: string;
      neighborMissing: false;
      neighborMirror: string | null;
      message: string;
    }
  | {
      kind: 'self_link';
      itemId: string;
      field: 'before' | 'after';
      neighborId: string;
      neighborMissing: false;
      message: string;
    };

function readLink(item: LinkChainItem): {
  before: string | null;
  after: string | null;
} {
  const ld = (item.linkDecisions ?? {}) as LinkDecisionsLike;
  return {
    before: (ld.beforeItemId as string | null | undefined) ?? null,
    after: (ld.afterItemId as string | null | undefined) ?? null,
  };
}

/**
 * Detect every bidirectional-consistency violation in a single
 * bulk-import session. Returns an empty array when the session is
 * clean. Order is deterministic (input order, `after` violations
 * before `before` violations for a given item) so test assertions and
 * audit output stay stable.
 */
export function findBidirectionalLinkInconsistencies(
  items: readonly LinkChainItem[],
): LinkChainViolation[] {
  const before = new Map<string, string | null>();
  const after = new Map<string, string | null>();
  for (const it of items) {
    const links = readLink(it);
    before.set(it.id, links.before);
    after.set(it.id, links.after);
  }

  const violations: LinkChainViolation[] = [];

  for (const it of items) {
    const links = readLink(it);

    if (links.after !== null) {
      if (links.after === it.id) {
        violations.push({
          kind: 'self_link',
          itemId: it.id,
          field: 'after',
          neighborId: links.after,
          neighborMissing: false,
          message: `item ${it.id} has afterItemId pointing at itself`,
        });
      } else if (!before.has(links.after)) {
        violations.push({
          kind: 'after_neighbor_missing',
          itemId: it.id,
          field: 'after',
          neighborId: links.after,
          neighborMissing: true,
          message: `item ${it.id} has afterItemId = ${links.after} but item ${links.after} is not in this session`,
        });
      } else {
        const mirror = before.get(links.after) ?? null;
        if (mirror !== it.id) {
          violations.push({
            kind: 'after_not_mirrored',
            itemId: it.id,
            field: 'after',
            neighborId: links.after,
            neighborMissing: false,
            neighborMirror: mirror,
            message: `item ${it.id} has afterItemId = ${links.after} but item ${links.after}.beforeItemId is ${mirror ?? 'null'} (expected ${it.id})`,
          });
        }
      }
    }

    if (links.before !== null) {
      if (links.before === it.id) {
        violations.push({
          kind: 'self_link',
          itemId: it.id,
          field: 'before',
          neighborId: links.before,
          neighborMissing: false,
          message: `item ${it.id} has beforeItemId pointing at itself`,
        });
      } else if (!after.has(links.before)) {
        violations.push({
          kind: 'before_neighbor_missing',
          itemId: it.id,
          field: 'before',
          neighborId: links.before,
          neighborMissing: true,
          message: `item ${it.id} has beforeItemId = ${links.before} but item ${links.before} is not in this session`,
        });
      } else {
        const mirror = after.get(links.before) ?? null;
        if (mirror !== it.id) {
          violations.push({
            kind: 'before_not_mirrored',
            itemId: it.id,
            field: 'before',
            neighborId: links.before,
            neighborMissing: false,
            neighborMirror: mirror,
            message: `item ${it.id} has beforeItemId = ${links.before} but item ${links.before}.afterItemId is ${mirror ?? 'null'} (expected ${it.id})`,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Build the patch a repair pass would apply to one item: `null`-out
 * any pointer the diagnostic flagged on it. Returned as a partial
 * `linkDecisions` overlay so callers can merge it into the existing
 * JSON without losing unrelated keys (`manualOverride`, future fields,
 * etc.).
 *
 * Returns `null` when the item has no violations to repair, so callers
 * can skip the UPDATE entirely.
 */
export function buildRepairPatchForItem(
  itemId: string,
  violations: readonly LinkChainViolation[],
): { beforeItemId?: null; afterItemId?: null } | null {
  let clearBefore = false;
  let clearAfter = false;
  for (const v of violations) {
    if (v.itemId !== itemId) continue;
    if (v.field === 'before') clearBefore = true;
    if (v.field === 'after') clearAfter = true;
  }
  if (!clearBefore && !clearAfter) return null;
  const patch: { beforeItemId?: null; afterItemId?: null } = {};
  if (clearBefore) patch.beforeItemId = null;
  if (clearAfter) patch.afterItemId = null;
  return patch;
}
