import { and, eq, ne, or, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  documents,
  documentLinks,
  documentTagAssignments,
  type Document,
  type DocumentLink,
} from '../../shared/schema';

export type LinkPosition = 'before' | 'after';

export interface ResolvedNeighbor {
  document: Document | null;
  source: 'explicit' | 'date' | null;
  isChainEnd: boolean;
}

export interface DocumentNeighbors {
  current: Document;
  previous: ResolvedNeighbor;
  next: ResolvedNeighbor;
}

/**
 * Visibility filter applied to neighbor candidates and suggestions.
 *
 * The rules mirror those used by the documents listing endpoint in
 * `server/api/documents.ts` (around the manager-only / tenant-visibility
 * checks):
 *   - `isManagerOnly` documents are restricted to admins and managers
 *     (regular `manager` and `demo_manager`), so residents AND tenants
 *     cannot see them — even when scope would otherwise allow it.
 *   - `isVisibleToTenants=false` additionally hides documents from the
 *     `tenant` and `demo_tenant` roles (residents are NOT restricted by
 *     this flag, matching the existing listing semantics).
 *
 * Centralizing these checks here ensures neighbor/suggestion responses do
 * not leak document metadata that the viewer is not allowed to see via the
 * normal listing endpoints.
 */
export interface ViewerContext {
  role?: string | null;
}

const MANAGER_ROLES = new Set(['admin', 'manager', 'demo_manager']);
const TENANT_ROLES = new Set(['tenant', 'demo_tenant']);

function applyVisibility(ctx: ViewerContext | undefined, doc: Document | null): Document | null {
  if (!doc) return null;
  const role = ctx?.role ?? '';
  if (doc.isManagerOnly && !MANAGER_ROLES.has(role)) return null;
  if (TENANT_ROLES.has(role) && !doc.isVisibleToTenants) return null;
  return doc;
}

/**
 * Build the date-comparison value for a document. Falls back to createdAt
 * when effectiveDate is missing so the resolver always has SOMETHING to
 * compare. Returns Date | null.
 */
function pickDate(doc: Document): Date {
  return doc.effectiveDate ?? doc.createdAt ?? new Date(0);
}

/**
 * Same-scope predicate: a candidate document is in the same sequence as
 * the source iff it has the same residenceId AND buildingId. Both null is
 * also "same scope" (rare org-only documents).
 */
function buildScopeFilter(source: Document) {
  const conditions = [];
  if (source.residenceId) {
    conditions.push(eq(documents.residenceId, source.residenceId));
  } else {
    conditions.push(sql`${documents.residenceId} is null`);
  }
  if (source.buildingId) {
    conditions.push(eq(documents.buildingId, source.buildingId));
  } else {
    conditions.push(sql`${documents.buildingId} is null`);
  }
  return and(...conditions);
}

async function loadDocument(documentId: string): Promise<Document | null> {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  return doc ?? null;
}

/**
 * Find the explicit neighbor for a document considering links in BOTH
 * directions. The explicit-link semantics are:
 *  - previous of A = doc X such that {from=A, position='before', to=X}
 *    OR {from=X, position='after', to=A}.
 *  - next of A = doc X such that {from=A, position='after', to=X}
 *    OR {from=X, position='before', to=A}.
 * The schema's `(from, position)` and `(to, position)` unique indexes
 * guarantee at most one explicit row per side.
 */
async function findExplicitNeighbor(
  documentId: string,
  side: 'previous' | 'next',
): Promise<Document | null> {
  const outgoingPosition: LinkPosition = side === 'previous' ? 'before' : 'after';
  const incomingPosition: LinkPosition = side === 'previous' ? 'after' : 'before';

  const [outgoing] = await db
    .select()
    .from(documentLinks)
    .where(
      and(eq(documentLinks.fromDocumentId, documentId), eq(documentLinks.position, outgoingPosition)),
    )
    .limit(1);
  if (outgoing) return loadDocument(outgoing.toDocumentId);

  const [incoming] = await db
    .select()
    .from(documentLinks)
    .where(
      and(eq(documentLinks.toDocumentId, documentId), eq(documentLinks.position, incomingPosition)),
    )
    .limit(1);
  if (incoming) return loadDocument(incoming.fromDocumentId);

  return null;
}

/**
 * Fetch the closest date-ordered candidates in the requested direction.
 * Returns up to `limit` rows so the caller can pick the first visible one
 * — important when role-based visibility filtering would otherwise drop
 * the single closest candidate and produce an empty neighbor.
 */
async function findDateNeighborCandidates(
  source: Document,
  direction: 'previous' | 'next',
  limit = 20,
): Promise<Document[]> {
  const sourceDate = pickDate(source);
  const orderDir = direction === 'previous' ? 'desc' : 'asc';
  const cmpOp = direction === 'previous' ? '<' : '>';

  // Compare against effectiveDate first, fallback to createdAt. We build
  // the comparison and ordering with `sql` so the coalesce is evaluated
  // server-side and we don't need to cast the expression to bypass typing.
  const dateExpr = sql`coalesce(${documents.effectiveDate}, ${documents.createdAt})`;
  const cmpClause = sql`${dateExpr} ${sql.raw(cmpOp)} ${sourceDate.toISOString()}`;
  const orderClause = sql`${dateExpr} ${sql.raw(orderDir)}`;

  return db
    .select()
    .from(documents)
    .where(and(ne(documents.id, source.id), buildScopeFilter(source), cmpClause))
    .orderBy(orderClause)
    .limit(limit);
}

/**
 * Resolve previous/next documents for `documentId`. Combines explicit
 * `documentLinks` rows (in both directions) with date-based fallback
 * ordering, scoped to the same building/residence. The optional viewer
 * context applies tenant visibility filtering: if the resolved neighbor
 * isn't visible to the viewer, it's dropped (rather than leaking a name).
 */
export async function resolveDocumentNeighbors(
  documentId: string,
  viewer?: ViewerContext,
): Promise<DocumentNeighbors | null> {
  const current = await loadDocument(documentId);
  if (!current) return null;

  const [explicitPrev, explicitNext] = await Promise.all([
    findExplicitNeighbor(current.id, 'previous'),
    findExplicitNeighbor(current.id, 'next'),
  ]);

  // The document is "in an explicit chain" if it has any explicit link on
  // either side. When in a chain, we never fall back to the date-based
  // neighbor on a side that has no explicit link — instead we mark that
  // side as the chain end so the UI can render a disabled prev/next button
  // ("First/Last document of chain") rather than wrap around to an
  // unrelated date neighbor.
  const inChain = !!explicitPrev || !!explicitNext;

  // For the date-based fallback we fetch a small batch and walk it until we
  // find a document the viewer is allowed to see, so role-based visibility
  // filtering does not silently produce a missing neighbor when valid ones
  // exist further down the date-ordered list.
  const resolveSide = async (
    explicit: Document | null,
    direction: 'previous' | 'next',
  ): Promise<ResolvedNeighbor> => {
    if (explicit) {
      const visibleExplicit = applyVisibility(viewer, explicit);
      if (visibleExplicit) {
        return { document: visibleExplicit, source: 'explicit', isChainEnd: false };
      }
      // Explicit link exists but is not visible to this viewer — treat as
      // chain end rather than leaking a date neighbor.
      return { document: null, source: null, isChainEnd: true };
    }
    if (inChain) {
      return { document: null, source: null, isChainEnd: true };
    }
    const candidates = await findDateNeighborCandidates(current, direction);
    for (const c of candidates) {
      const visible = applyVisibility(viewer, c);
      if (visible) {
        return { document: visible, source: 'date', isChainEnd: false };
      }
    }
    return { document: null, source: null, isChainEnd: false };
  };

  const previous = await resolveSide(explicitPrev, 'previous');
  const next = await resolveSide(explicitNext, 'next');

  return { current, previous, next };
}

/**
 * Link summary used by the documents list view: which documents have an
 * explicit `before` and/or `after` neighbor, and a tiny preview (id + name)
 * of each so the UI can show "previous: X / next: Y" on hover without an
 * extra round-trip per row.
 *
 * Implementation: a single batched query over `documentLinks` where either
 * end of the link is in the requested set, then a single batched lookup of
 * the involved documents to fill in display names. The returned map only
 * contains entries for documents that have at least one explicit link.
 */
export interface DocumentLinkSummary {
  previous?: { id: string; name: string };
  next?: { id: string; name: string };
}

export async function getLinkSummariesForDocuments(
  documentIds: string[],
  viewer?: ViewerContext,
): Promise<Map<string, DocumentLinkSummary>> {
  const result = new Map<string, DocumentLinkSummary>();
  if (documentIds.length === 0) return result;

  const links = await db
    .select()
    .from(documentLinks)
    .where(
      or(
        inArray(documentLinks.fromDocumentId, documentIds),
        inArray(documentLinks.toDocumentId, documentIds),
      ),
    );
  if (links.length === 0) return result;

  // Collect every document id we need to display a name for: both endpoints
  // of every relevant link, even when one endpoint is outside the original
  // set (so the hover preview can still show that name).
  const neighborIds = new Set<string>();
  for (const l of links) {
    neighborIds.add(l.fromDocumentId);
    neighborIds.add(l.toDocumentId);
  }
  // Fetch the visibility-relevant fields too so we can hide neighbor names
  // the viewer is not allowed to see (manager-only / tenant-restricted).
  // Without this filter, the linked-indicator hover would leak document
  // names that the listing endpoint itself would never return.
  const docs = neighborIds.size
    ? await db
        .select({
          id: documents.id,
          name: documents.name,
          isManagerOnly: documents.isManagerOnly,
          isVisibleToTenants: documents.isVisibleToTenants,
        })
        .from(documents)
        .where(inArray(documents.id, Array.from(neighborIds)))
    : [];
  const visibleById = new Map<string, { id: string; name: string }>();
  for (const d of docs) {
    // Reuse the same visibility predicate the viewer/resolver uses so that
    // list-view link previews can never expose a document the user could
    // not open directly.
    const visible = applyVisibility(viewer, {
      ...(d as unknown as Document),
    });
    if (visible) visibleById.set(d.id, { id: d.id, name: d.name });
  }

  const ensure = (id: string): DocumentLinkSummary => {
    let s = result.get(id);
    if (!s) {
      s = {};
      result.set(id, s);
    }
    return s;
  };

  // For each link {from=A, to=B, position=P}:
  //   - A's side P is B
  //   - B's side opposite(P) is A
  // Mirror the bidirectional resolver so the list view agrees with the
  // viewer about what counts as a "previous" or "next" neighbor.
  // Skip a side entirely when the neighbor isn't visible to the viewer —
  // we'd rather drop the indicator than reveal a hidden document's name.
  for (const l of links) {
    const fromIsTracked = documentIds.includes(l.fromDocumentId);
    const toIsTracked = documentIds.includes(l.toDocumentId);
    const visibleFrom = visibleById.get(l.fromDocumentId);
    const visibleTo = visibleById.get(l.toDocumentId);
    if (fromIsTracked && visibleTo) {
      const side = l.position === 'before' ? 'previous' : 'next';
      const summary = ensure(l.fromDocumentId);
      summary[side] = visibleTo;
    }
    if (toIsTracked && visibleFrom) {
      const side = l.position === 'before' ? 'next' : 'previous';
      const summary = ensure(l.toDocumentId);
      summary[side] = visibleFrom;
    }
  }

  return result;
}

/**
 * List explicit links for a document (both `from` and `to` directions).
 */
export async function listLinksForDocument(documentId: string): Promise<DocumentLink[]> {
  return db
    .select()
    .from(documentLinks)
    .where(or(eq(documentLinks.fromDocumentId, documentId), eq(documentLinks.toDocumentId, documentId)));
}

export interface CreateLinkInput {
  fromDocumentId: string;
  toDocumentId: string;
  position: LinkPosition;
  ordinal?: number | null;
}

export class DocumentLinkValidationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'DocumentLinkValidationError';
  }
}

/**
 * Create or replace an explicit link. The unique (fromDocumentId, position)
 * constraint means each document has at most one explicit `before` and one
 * explicit `after` — calling this with an existing position upserts.
 */
export async function upsertDocumentLink(input: CreateLinkInput): Promise<DocumentLink> {
  if (input.fromDocumentId === input.toDocumentId) {
    throw new DocumentLinkValidationError('A document cannot link to itself', 'self_link');
  }
  const [from, to] = await Promise.all([
    loadDocument(input.fromDocumentId),
    loadDocument(input.toDocumentId),
  ]);
  if (!from) throw new DocumentLinkValidationError('Source document not found', 'from_not_found');
  if (!to) throw new DocumentLinkValidationError('Target document not found', 'to_not_found');
  // Cross-scope guard: same-building or same-residence only.
  const sameBuilding = (from.buildingId ?? null) === (to.buildingId ?? null);
  const sameResidence = (from.residenceId ?? null) === (to.residenceId ?? null);
  if (!sameBuilding || !sameResidence) {
    throw new DocumentLinkValidationError(
      'Linked documents must belong to the same building and residence',
      'scope_mismatch',
    );
  }
  // Enforce the global invariant: every document has at most one previous
  // and at most one next neighbor. A document's neighbor on side P can be
  // expressed in TWO equivalent ways:
  //   (a) outgoing row {from=doc, position=P, to=X}
  //   (b) incoming row {from=X, to=doc, position=opposite(P)}
  // The new link {from=A, to=B, position=P} sets A's side P to B AND B's
  // side opposite(P) to A. To prevent contradictory state across the dataset
  // we delete every existing equivalent representation on BOTH endpoints
  // before inserting. This makes the new link the single source of truth
  // and lets the unique indexes safely catch any remaining race.
  const opposite: LinkPosition = input.position === 'before' ? 'after' : 'before';
  // Clear A's outgoing P  — A's side P will be set to B.
  await db
    .delete(documentLinks)
    .where(and(eq(documentLinks.fromDocumentId, input.fromDocumentId), eq(documentLinks.position, input.position)));
  // Clear A's incoming opposite(P) (other docs claiming A as their side P).
  await db
    .delete(documentLinks)
    .where(and(eq(documentLinks.toDocumentId, input.fromDocumentId), eq(documentLinks.position, opposite)));
  // Clear B's outgoing opposite(P) — B's side opposite(P) will be set to A.
  await db
    .delete(documentLinks)
    .where(and(eq(documentLinks.fromDocumentId, input.toDocumentId), eq(documentLinks.position, opposite)));
  // Clear B's incoming P (other docs that previously claimed B as their P).
  await db
    .delete(documentLinks)
    .where(and(eq(documentLinks.toDocumentId, input.toDocumentId), eq(documentLinks.position, input.position)));
  try {
    const [row] = await db
      .insert(documentLinks)
      .values({
        fromDocumentId: input.fromDocumentId,
        toDocumentId: input.toDocumentId,
        position: input.position,
        ordinal: input.ordinal ?? null,
        updatedAt: new Date(),
      })
      .returning();
    return row;
  } catch (e: any) {
    // Postgres unique_violation -> surface as validation error so the API
    // can return a 400 instead of a generic 500.
    if (e?.code === '23505') {
      throw new DocumentLinkValidationError(
        'A conflicting document link already exists',
        'unique_violation',
      );
    }
    throw e;
  }
}

/**
 * Remove the explicit neighbor on the requested side of `fromDocumentId`.
 * Because the resolver treats explicit links bidirectionally, the same
 * neighbor can be encoded as either:
 *   (a) an outgoing row {from=doc, position=P, to=X}
 *   (b) an incoming row {from=X, to=doc, position=opposite(P)}
 * We delete BOTH equivalent representations so the side actually clears.
 */
export async function deleteDocumentLink(params: {
  fromDocumentId: string;
  position: LinkPosition;
}): Promise<boolean> {
  const opposite: LinkPosition = params.position === 'before' ? 'after' : 'before';
  const outgoing = await db
    .delete(documentLinks)
    .where(
      and(
        eq(documentLinks.fromDocumentId, params.fromDocumentId),
        eq(documentLinks.position, params.position),
      ),
    )
    .returning({ id: documentLinks.id });
  const incoming = await db
    .delete(documentLinks)
    .where(
      and(
        eq(documentLinks.toDocumentId, params.fromDocumentId),
        eq(documentLinks.position, opposite),
      ),
    )
    .returning({ id: documentLinks.id });
  return outgoing.length > 0 || incoming.length > 0;
}

// =============================================================================
// Chain resolution & reorder helpers
// =============================================================================

/**
 * Resolve the full chain (connected component via explicit `before`/`after`
 * links) that contains `documentId`. Walks the explicit-link graph in both
 * directions starting from the seed and returns the documents in reading
 * order (oldest → newest from the chain's point of view, i.e. head→tail).
 *
 * Returns `null` if the seed document does not exist. A document with no
 * explicit links resolves to a single-element chain `[doc]`.
 *
 * Cycles cannot occur in a well-formed dataset (each doc has at most one
 * `before` and one `after`), but a `seen` set guards against pathological
 * cases so the walk always terminates.
 */
export async function resolveChain(documentId: string): Promise<Document[] | null> {
  const start = await loadDocument(documentId);
  if (!start) return null;

  const seen = new Set<string>([start.id]);

  const before: Document[] = [];
  let cursor: Document | null = start;
  while (cursor) {
    const prev = await findExplicitNeighbor(cursor.id, 'previous');
    if (!prev || seen.has(prev.id)) break;
    seen.add(prev.id);
    before.unshift(prev);
    cursor = prev;
  }

  const after: Document[] = [];
  cursor = start;
  while (cursor) {
    const nxt = await findExplicitNeighbor(cursor.id, 'next');
    if (!nxt || seen.has(nxt.id)) break;
    seen.add(nxt.id);
    after.push(nxt);
    cursor = nxt;
  }

  return [...before, start, ...after];
}

/**
 * Rewrite the explicit `before`/`after` links for the documents in
 * `orderedIds` so that they form the exact chain `id[0] → id[1] → ... → id[n-1]`.
 *
 * All existing explicit links touching ANY of these documents (in either
 * direction) are deleted before the new chain edges are inserted, so the
 * result is the canonical representation: each pair gets one `after` row,
 * which the resolver also reads as the next doc's `before`.
 *
 * Constraints:
 *  - All ids must exist.
 *  - All documents must share the same building/residence scope (same rule
 *    enforced by `upsertDocumentLink`).
 *  - Duplicates in `orderedIds` are rejected.
 *
 * A single-element list is a no-op for the link table — it still removes
 * any pre-existing links that touched that document, which is the right
 * behavior when the user has just removed every neighbor.
 */
export async function reorderChain(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;

  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (seen.has(id)) {
      throw new DocumentLinkValidationError('Duplicate document ids in chain', 'duplicate_ids');
    }
    seen.add(id);
  }

  const docs = await db
    .select()
    .from(documents)
    .where(inArray(documents.id, orderedIds));
  if (docs.length !== orderedIds.length) {
    throw new DocumentLinkValidationError('One or more chain documents not found', 'not_found');
  }
  const first = docs[0];
  for (const d of docs) {
    if ((d.buildingId ?? null) !== (first.buildingId ?? null)
        || (d.residenceId ?? null) !== (first.residenceId ?? null)) {
      throw new DocumentLinkValidationError(
        'Chain documents must belong to the same building and residence',
        'scope_mismatch',
      );
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(documentLinks)
      .where(
        or(
          inArray(documentLinks.fromDocumentId, orderedIds),
          inArray(documentLinks.toDocumentId, orderedIds),
        ),
      );

    if (orderedIds.length >= 2) {
      const now = new Date();
      const rows = [] as Array<{
        fromDocumentId: string;
        toDocumentId: string;
        position: LinkPosition;
        ordinal: number | null;
        updatedAt: Date;
      }>;
      for (let i = 0; i < orderedIds.length - 1; i++) {
        rows.push({
          fromDocumentId: orderedIds[i],
          toDocumentId: orderedIds[i + 1],
          position: 'after',
          ordinal: null,
          updatedAt: now,
        });
      }
      await tx.insert(documentLinks).values(rows);
    }
  });
}

/**
 * Remove a single document from its chain. Deletes every explicit link
 * touching the document and, if it had both a previous AND a next neighbor,
 * stitches them back together with a single `after` link so the rest of the
 * chain stays connected.
 *
 * Returns the new `[prev, next]` pair (each may be null) so the caller can
 * confirm what was stitched.
 */
export async function removeFromChain(
  documentId: string,
): Promise<{ previous: Document | null; next: Document | null }> {
  const [prev, next] = await Promise.all([
    findExplicitNeighbor(documentId, 'previous'),
    findExplicitNeighbor(documentId, 'next'),
  ]);

  await db.transaction(async (tx) => {
    await tx
      .delete(documentLinks)
      .where(
        or(
          eq(documentLinks.fromDocumentId, documentId),
          eq(documentLinks.toDocumentId, documentId),
        ),
      );

    if (prev && next) {
      // Defensive: clear any link rows that would collide with the new
      // stitched edge before inserting it.
      await tx
        .delete(documentLinks)
        .where(and(eq(documentLinks.fromDocumentId, prev.id), eq(documentLinks.position, 'after')));
      await tx
        .delete(documentLinks)
        .where(and(eq(documentLinks.toDocumentId, next.id), eq(documentLinks.position, 'after')));
      await tx
        .delete(documentLinks)
        .where(and(eq(documentLinks.fromDocumentId, next.id), eq(documentLinks.position, 'before')));
      await tx
        .delete(documentLinks)
        .where(and(eq(documentLinks.toDocumentId, prev.id), eq(documentLinks.position, 'before')));

      await tx.insert(documentLinks).values({
        fromDocumentId: prev.id,
        toDocumentId: next.id,
        position: 'after',
        ordinal: null,
        updatedAt: new Date(),
      });
    }
  });

  return { previous: prev, next };
}

// =============================================================================
// AI suggestion scorer
// =============================================================================

export interface SuggestionExplanation {
  nameSimilarity: number;
  sharedCategory: boolean;
  sharedTagCount: number;
  dateProximityDays: number | null;
  sameBuilding: boolean;
  sameResidence: boolean;
}

export interface DocumentSuggestion {
  document: Document;
  score: number;
  explain: SuggestionExplanation;
}

/**
 * Tokenize a string into lowercase alphanumeric words for similarity scoring.
 * Exported so tests can pin down the behavior.
 */
export function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 1);
}

/**
 * Jaccard similarity (|A ∩ B| / |A ∪ B|) between two tokenized strings.
 * Returns 0 when both sides are empty.
 */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 && setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Pure scorer for one candidate. Deterministic, no external LLM call.
 * Weights:
 *  - name similarity: 0..1 → up to 40 points
 *  - shared category (documentType match): 20 points
 *  - shared tags: 5 points per overlapping tag (capped at 20)
 *  - date proximity (closer in time = better): up to 15 points
 *  - same residence: 5 points
 *  - same building: 5 points
 *
 * Maximum theoretical score is ~105.
 */
export function scoreCandidate(
  source: Document,
  candidate: Document,
  sourceTagIds: string[],
  candidateTagIds: string[],
): DocumentSuggestion {
  const nameSim = nameSimilarity(source.name, candidate.name);
  const sharedCategory = !!source.documentType && source.documentType === candidate.documentType;

  const sourceTagSet = new Set(sourceTagIds);
  let sharedTagCount = 0;
  for (const t of candidateTagIds) if (sourceTagSet.has(t)) sharedTagCount++;

  const sourceDate = source.effectiveDate ?? source.createdAt ?? null;
  const candidateDate = candidate.effectiveDate ?? candidate.createdAt ?? null;
  let dateProximityDays: number | null = null;
  let dateScore = 0;
  if (sourceDate && candidateDate) {
    const diffMs = Math.abs(new Date(sourceDate).getTime() - new Date(candidateDate).getTime());
    dateProximityDays = diffMs / (1000 * 60 * 60 * 24);
    // Decay: 0 days → 15 pts, 365 days → ~7.5 pts, 3650 days → ~1.4 pts
    dateScore = 15 / (1 + dateProximityDays / 365);
  }

  const sameBuilding = (source.buildingId ?? null) === (candidate.buildingId ?? null);
  const sameResidence = (source.residenceId ?? null) === (candidate.residenceId ?? null);

  const score =
    nameSim * 40 +
    (sharedCategory ? 20 : 0) +
    Math.min(sharedTagCount * 5, 20) +
    dateScore +
    (sameResidence ? 5 : 0) +
    (sameBuilding ? 5 : 0);

  return {
    document: candidate,
    score,
    explain: {
      nameSimilarity: nameSim,
      sharedCategory,
      sharedTagCount,
      dateProximityDays,
      sameBuilding,
      sameResidence,
    },
  };
}

/**
 * Suggest candidate documents to link from `documentId`. Filters to the
 * same building/residence scope and ranks by `scoreCandidate`. Pass an
 * optional free-text `query` to bias the ranking with name-similarity
 * against that query.
 */
export async function suggestLinkTargets(params: {
  documentId: string;
  query?: string;
  limit?: number;
  viewer?: ViewerContext;
}): Promise<{ source: Document; suggestions: DocumentSuggestion[] } | null> {
  const source = await loadDocument(params.documentId);
  if (!source) return null;
  const limit = Math.min(Math.max(params.limit ?? 10, 1), 50);

  const allCandidates = await db
    .select()
    .from(documents)
    .where(and(ne(documents.id, source.id), buildScopeFilter(source)))
    .limit(500);

  // Tenant viewers must not see documents flagged as not visible to tenants;
  // dropping them here keeps them out of the ranking and the response.
  const candidates = allCandidates.filter((c) => applyVisibility(params.viewer, c));

  const allDocIds = [source.id, ...candidates.map((c) => c.id)];
  const tagRows = allDocIds.length
    ? await db
        .select()
        .from(documentTagAssignments)
        .where(inArray(documentTagAssignments.documentId, allDocIds))
    : [];
  const tagsByDoc = new Map<string, string[]>();
  for (const row of tagRows) {
    const list = tagsByDoc.get(row.documentId) ?? [];
    list.push(row.tagId);
    tagsByDoc.set(row.documentId, list);
  }
  const sourceTagIds = tagsByDoc.get(source.id) ?? [];

  let scored = candidates.map((c) =>
    scoreCandidate(source, c, sourceTagIds, tagsByDoc.get(c.id) ?? []),
  );

  if (params.query && params.query.trim()) {
    const q = params.query.trim();
    scored = scored.map((s) => {
      const querySim = nameSimilarity(q, s.document.name);
      return {
        ...s,
        score: s.score + querySim * 30,
        explain: { ...s.explain, nameSimilarity: Math.max(s.explain.nameSimilarity, querySim) },
      };
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return { source, suggestions: scored.slice(0, limit) };
}
