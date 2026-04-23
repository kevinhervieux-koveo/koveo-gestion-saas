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

  // For the date-based fallback we fetch a small batch and walk it until we
  // find a document the viewer is allowed to see, so role-based visibility
  // filtering does not silently produce a missing neighbor when valid ones
  // exist further down the date-ordered list.
  const pickFirstVisible = async (
    explicit: Document | null,
    direction: 'previous' | 'next',
  ): Promise<Document | null> => {
    const visibleExplicit = applyVisibility(viewer, explicit);
    if (visibleExplicit) return visibleExplicit;
    const candidates = await findDateNeighborCandidates(current, direction);
    for (const c of candidates) {
      const visible = applyVisibility(viewer, c);
      if (visible) return visible;
    }
    return null;
  };

  const prevDoc = await pickFirstVisible(explicitPrev, 'previous');
  const nextDoc = await pickFirstVisible(explicitNext, 'next');

  const prev: ResolvedNeighbor = {
    document: prevDoc,
    source: prevDoc ? (prevDoc === explicitPrev ? 'explicit' : 'date') : null,
  };
  const next: ResolvedNeighbor = {
    document: nextDoc,
    source: nextDoc ? (nextDoc === explicitNext ? 'explicit' : 'date') : null,
  };

  return { current, previous: prev, next };
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
