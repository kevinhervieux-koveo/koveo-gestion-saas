import { and, eq, ne, or, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  documents,
  documentLinks,
  documentLinkFamilies,
  documentTagAssignments,
  type Document,
  type DocumentLink,
  type DocumentLinkFamily,
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

export interface FamilyNeighbors {
  family: DocumentLinkFamily;
  previous: ResolvedNeighbor;
  next: ResolvedNeighbor;
}

/**
 * Visibility filter applied to neighbor candidates and suggestions.
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

function pickDate(doc: Document): Date {
  return doc.effectiveDate ?? doc.createdAt ?? new Date(0);
}

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

async function loadFamily(familyId: string): Promise<DocumentLinkFamily | null> {
  const [fam] = await db
    .select()
    .from(documentLinkFamilies)
    .where(eq(documentLinkFamilies.id, familyId))
    .limit(1);
  return fam ?? null;
}

/**
 * Find the explicit neighbor for a document in a specific family, considering
 * links in BOTH directions. The explicit-link semantics are:
 *  - previous of A in family F = doc X such that {from=A, position='before', to=X, family=F}
 *    OR {from=X, position='after', to=A, family=F}.
 *  - next of A in family F = doc X such that {from=A, position='after', to=X, family=F}
 *    OR {from=X, position='before', to=A, family=F}.
 */
async function findExplicitNeighbor(
  documentId: string,
  side: 'previous' | 'next',
  familyId: string,
): Promise<Document | null> {
  const outgoingPosition: LinkPosition = side === 'previous' ? 'before' : 'after';
  const incomingPosition: LinkPosition = side === 'previous' ? 'after' : 'before';

  const [outgoing] = await db
    .select()
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.fromDocumentId, documentId),
        eq(documentLinks.position, outgoingPosition),
        eq(documentLinks.familyId, familyId),
      ),
    )
    .limit(1);
  if (outgoing) {
    const [doc] = await db.select().from(documents).where(eq(documents.id, outgoing.toDocumentId)).limit(1);
    return doc ?? null;
  }

  const [incoming] = await db
    .select()
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.toDocumentId, documentId),
        eq(documentLinks.position, incomingPosition),
        eq(documentLinks.familyId, familyId),
      ),
    )
    .limit(1);
  if (incoming) {
    const [doc] = await db.select().from(documents).where(eq(documents.id, incoming.fromDocumentId)).limit(1);
    return doc ?? null;
  }

  return null;
}

/**
 * Find all families that a document belongs to (i.e. has at least one link in).
 */
async function getFamiliesForDocument(documentId: string): Promise<DocumentLinkFamily[]> {
  const linkRows = await db
    .select({ familyId: documentLinks.familyId })
    .from(documentLinks)
    .where(
      or(
        eq(documentLinks.fromDocumentId, documentId),
        eq(documentLinks.toDocumentId, documentId),
      ),
    );

  if (linkRows.length === 0) return [];

  // Deduplicate family IDs in code (avoids selectDistinct which is not
  // available in all mock setups used by unit tests).
  const uniqueFamilyIds = Array.from(new Set(linkRows.map((r) => r.familyId)));
  const familyIdRows = uniqueFamilyIds.map((id) => ({ familyId: id }));

  if (familyIdRows.length === 0) return [];

  const ids = familyIdRows.map((r) => r.familyId);
  const families = await db
    .select()
    .from(documentLinkFamilies)
    .where(inArray(documentLinkFamilies.id, ids));

  families.sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return families;
}

/**
 * Resolve previous/next documents for `documentId` within a specific family.
 * Navigation within a family is purely explicit — no date-based fallback.
 */
export async function resolveDocumentNeighborsForFamily(
  documentId: string,
  familyId: string,
  viewer?: ViewerContext,
): Promise<DocumentNeighbors | null> {
  const current = await loadDocument(documentId);
  if (!current) return null;

  const [explicitPrev, explicitNext] = await Promise.all([
    findExplicitNeighbor(current.id, 'previous', familyId),
    findExplicitNeighbor(current.id, 'next', familyId),
  ]);

  const inChain = !!explicitPrev || !!explicitNext;

  const resolveSide = (explicit: Document | null): ResolvedNeighbor => {
    if (explicit) {
      const visible = applyVisibility(viewer, explicit);
      if (visible) return { document: visible, source: 'explicit', isChainEnd: false };
      return { document: null, source: null, isChainEnd: true };
    }
    if (inChain) {
      return { document: null, source: null, isChainEnd: true };
    }
    return { document: null, source: null, isChainEnd: false };
  };

  return {
    current,
    previous: resolveSide(explicitPrev),
    next: resolveSide(explicitNext),
  };
}

/**
 * Resolve neighbors for all families the document belongs to. Returns one
 * FamilyNeighbors entry per family (sorted: system families first, then alphabetically).
 */
export async function resolveAllFamilyNeighbors(
  documentId: string,
  viewer?: ViewerContext,
): Promise<FamilyNeighbors[]> {
  const families = await getFamiliesForDocument(documentId);
  if (families.length === 0) return [];

  const results = await Promise.all(
    families.map(async (family) => {
      const neighbors = await resolveDocumentNeighborsForFamily(documentId, family.id, viewer);
      if (!neighbors) return null;
      return {
        family,
        previous: neighbors.previous,
        next: neighbors.next,
      } as FamilyNeighbors;
    }),
  );

  return results
    .filter((r): r is FamilyNeighbors => r !== null)
    .sort((a, b) => a.family.name.localeCompare(b.family.name, undefined, { sensitivity: 'base' }));
}

/**
 * Keep a legacy single-family resolver for backward compatibility where needed.
 * Falls back to date-based ordering when the document is not in any explicit chain,
 * so existing documents without family links still have sequential navigation.
 */
async function findDateNeighborCandidates(
  source: Document,
  direction: 'previous' | 'next',
  limit = 20,
): Promise<Document[]> {
  const sourceDate = pickDate(source);
  const orderDir = direction === 'previous' ? 'desc' : 'asc';
  const cmpOp = direction === 'previous' ? '<' : '>';

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
 * Family-agnostic explicit-neighbor lookup (for the legacy resolver only).
 * Finds the immediate neighbor in any family — outgoing first, then incoming.
 */
async function findExplicitNeighborAnyFamily(
  documentId: string,
  side: 'previous' | 'next',
): Promise<Document | null> {
  const outgoingPosition: LinkPosition = side === 'previous' ? 'before' : 'after';
  const incomingPosition: LinkPosition = side === 'previous' ? 'after' : 'before';

  const [outgoing] = await db
    .select()
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.fromDocumentId, documentId),
        eq(documentLinks.position, outgoingPosition),
      ),
    )
    .limit(1);
  if (outgoing) {
    const [doc] = await db.select().from(documents).where(eq(documents.id, outgoing.toDocumentId)).limit(1);
    return doc ?? null;
  }

  const [incoming] = await db
    .select()
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.toDocumentId, documentId),
        eq(documentLinks.position, incomingPosition),
      ),
    )
    .limit(1);
  if (incoming) {
    const [doc] = await db.select().from(documents).where(eq(documents.id, incoming.fromDocumentId)).limit(1);
    return doc ?? null;
  }

  return null;
}

/**
 * Legacy resolver kept for the non-family-aware list view link summaries.
 * Checks for explicit links (in any family) first; falls back to date ordering.
 * Source is 'explicit', 'date', or null (no neighbor found).
 */
export async function resolveDocumentNeighbors(
  documentId: string,
  viewer?: ViewerContext,
): Promise<DocumentNeighbors | null> {
  const current = await loadDocument(documentId);
  if (!current) return null;

  const [explicitPrev, explicitNext] = await Promise.all([
    findExplicitNeighborAnyFamily(documentId, 'previous'),
    findExplicitNeighborAnyFamily(documentId, 'next'),
  ]);

  const inChain = !!explicitPrev || !!explicitNext;

  const resolveSide = async (
    explicit: Document | null,
    direction: 'previous' | 'next',
  ): Promise<ResolvedNeighbor> => {
    if (explicit) {
      const visible = applyVisibility(viewer, explicit);
      if (visible) return { document: visible, source: 'explicit', isChainEnd: false };
      return { document: null, source: null, isChainEnd: true };
    }
    if (inChain) {
      return { document: null, source: null, isChainEnd: true };
    }
    // Date fallback — only when no explicit chain exists on either side.
    const candidates = await findDateNeighborCandidates(current, direction);
    for (const c of candidates) {
      const visible = applyVisibility(viewer, c);
      if (visible) return { document: visible, source: 'date', isChainEnd: false };
    }
    return { document: null, source: null, isChainEnd: false };
  };

  const [previous, next] = await Promise.all([
    resolveSide(explicitPrev, 'previous'),
    resolveSide(explicitNext, 'next'),
  ]);

  return { current, previous, next };
}

/**
 * Link summary used by the documents list view.
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

  const neighborIds = new Set<string>();
  for (const l of links) {
    neighborIds.add(l.fromDocumentId);
    neighborIds.add(l.toDocumentId);
  }
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
    const visible = applyVisibility(viewer, { ...(d as unknown as Document) });
    if (visible) visibleById.set(d.id, { id: d.id, name: d.name });
  }

  const ensure = (id: string): DocumentLinkSummary => {
    let s = result.get(id);
    if (!s) { s = {}; result.set(id, s); }
    return s;
  };

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
 * List explicit links for a document (optionally filtered by family).
 */
export async function listLinksForDocument(
  documentId: string,
  familyId?: string,
): Promise<DocumentLink[]> {
  const baseCondition = or(
    eq(documentLinks.fromDocumentId, documentId),
    eq(documentLinks.toDocumentId, documentId),
  );
  if (familyId) {
    return db
      .select()
      .from(documentLinks)
      .where(and(baseCondition, eq(documentLinks.familyId, familyId)));
  }
  return db.select().from(documentLinks).where(baseCondition);
}

export interface CreateLinkInput {
  fromDocumentId: string;
  toDocumentId: string;
  familyId: string;
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
 * Create or replace an explicit link within a family. The unique
 * (fromDocumentId, position, familyId) constraint means each document has at
 * most one explicit `before` and one `after` per family — calling this with an
 * existing position upserts.
 */
export async function upsertDocumentLink(input: CreateLinkInput): Promise<DocumentLink> {
  if (input.fromDocumentId === input.toDocumentId) {
    throw new DocumentLinkValidationError('A document cannot link to itself', 'self_link');
  }
  const [from, to, family] = await Promise.all([
    loadDocument(input.fromDocumentId),
    loadDocument(input.toDocumentId),
    loadFamily(input.familyId),
  ]);
  if (!from) throw new DocumentLinkValidationError('Source document not found', 'from_not_found');
  if (!to) throw new DocumentLinkValidationError('Target document not found', 'to_not_found');
  if (!family) throw new DocumentLinkValidationError('Family not found', 'family_not_found');

  const sameBuilding = (from.buildingId ?? null) === (to.buildingId ?? null);
  const sameResidence = (from.residenceId ?? null) === (to.residenceId ?? null);
  if (!sameBuilding || !sameResidence) {
    throw new DocumentLinkValidationError(
      'Linked documents must belong to the same building and residence',
      'scope_mismatch',
    );
  }

  const opposite: LinkPosition = input.position === 'before' ? 'after' : 'before';
  const fid = input.familyId;

  await db
    .delete(documentLinks)
    .where(
      and(
        eq(documentLinks.fromDocumentId, input.fromDocumentId),
        eq(documentLinks.position, input.position),
        eq(documentLinks.familyId, fid),
      ),
    );
  await db
    .delete(documentLinks)
    .where(
      and(
        eq(documentLinks.toDocumentId, input.fromDocumentId),
        eq(documentLinks.position, opposite),
        eq(documentLinks.familyId, fid),
      ),
    );
  await db
    .delete(documentLinks)
    .where(
      and(
        eq(documentLinks.fromDocumentId, input.toDocumentId),
        eq(documentLinks.position, opposite),
        eq(documentLinks.familyId, fid),
      ),
    );
  await db
    .delete(documentLinks)
    .where(
      and(
        eq(documentLinks.toDocumentId, input.toDocumentId),
        eq(documentLinks.position, input.position),
        eq(documentLinks.familyId, fid),
      ),
    );

  try {
    const [row] = await db
      .insert(documentLinks)
      .values({
        fromDocumentId: input.fromDocumentId,
        toDocumentId: input.toDocumentId,
        familyId: input.familyId,
        position: input.position,
        ordinal: input.ordinal ?? null,
        updatedAt: new Date(),
      })
      .returning();
    return row;
  } catch (e: any) {
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
 * Remove the explicit neighbor on the requested side of `fromDocumentId` within
 * a specific family.
 */
export async function deleteDocumentLink(params: {
  fromDocumentId: string;
  position: LinkPosition;
  familyId: string;
}): Promise<boolean> {
  const opposite: LinkPosition = params.position === 'before' ? 'after' : 'before';
  const outgoing = await db
    .delete(documentLinks)
    .where(
      and(
        eq(documentLinks.fromDocumentId, params.fromDocumentId),
        eq(documentLinks.position, params.position),
        eq(documentLinks.familyId, params.familyId),
      ),
    )
    .returning({ id: documentLinks.id });
  const incoming = await db
    .delete(documentLinks)
    .where(
      and(
        eq(documentLinks.toDocumentId, params.fromDocumentId),
        eq(documentLinks.position, opposite),
        eq(documentLinks.familyId, params.familyId),
      ),
    )
    .returning({ id: documentLinks.id });
  return outgoing.length > 0 || incoming.length > 0;
}

// =============================================================================
// Chain resolution & reorder helpers (all family-scoped)
// =============================================================================

/**
 * Resolve the full chain within a specific family that contains `documentId`.
 * Returns `null` if the seed document does not exist.
 */
export async function resolveChain(
  documentId: string,
  familyId: string,
): Promise<Document[] | null> {
  const start = await loadDocument(documentId);
  if (!start) return null;

  const seen = new Set<string>([start.id]);

  const before: Document[] = [];
  let cursor: Document | null = start;
  while (cursor) {
    const prev = await findExplicitNeighbor(cursor.id, 'previous', familyId);
    if (!prev || seen.has(prev.id)) break;
    seen.add(prev.id);
    before.unshift(prev);
    cursor = prev;
  }

  const after: Document[] = [];
  cursor = start;
  while (cursor) {
    const nxt = await findExplicitNeighbor(cursor.id, 'next', familyId);
    if (!nxt || seen.has(nxt.id)) break;
    seen.add(nxt.id);
    after.push(nxt);
    cursor = nxt;
  }

  return [...before, start, ...after];
}

/**
 * Rewrite the explicit links within a specific family so that the documents
 * in `orderedIds` form the exact chain id[0] → id[1] → ... → id[n-1].
 */
export async function reorderChain(orderedIds: string[], familyId: string): Promise<void> {
  if (orderedIds.length === 0) return;

  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (seen.has(id)) {
      throw new DocumentLinkValidationError('Duplicate document ids in chain', 'duplicate_ids');
    }
    seen.add(id);
  }

  const docs = await db.select().from(documents).where(inArray(documents.id, orderedIds));
  if (docs.length !== orderedIds.length) {
    throw new DocumentLinkValidationError('One or more chain documents not found', 'not_found');
  }
  const first = docs[0];
  for (const d of docs) {
    if (
      (d.buildingId ?? null) !== (first.buildingId ?? null) ||
      (d.residenceId ?? null) !== (first.residenceId ?? null)
    ) {
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
        and(
          or(
            inArray(documentLinks.fromDocumentId, orderedIds),
            inArray(documentLinks.toDocumentId, orderedIds),
          ),
          eq(documentLinks.familyId, familyId),
        ),
      );

    if (orderedIds.length >= 2) {
      const now = new Date();
      const rows = [] as Array<{
        fromDocumentId: string;
        toDocumentId: string;
        familyId: string;
        position: LinkPosition;
        ordinal: number | null;
        updatedAt: Date;
      }>;
      for (let i = 0; i < orderedIds.length - 1; i++) {
        rows.push({
          fromDocumentId: orderedIds[i],
          toDocumentId: orderedIds[i + 1],
          familyId,
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
 * Remove a single document from its chain within a specific family. Deletes every
 * explicit link touching the document in that family and, if it had both a previous
 * AND a next neighbor, stitches them back together.
 */
export async function removeFromChain(
  documentId: string,
  familyId: string,
): Promise<{ previous: Document | null; next: Document | null }> {
  const [prev, next] = await Promise.all([
    findExplicitNeighbor(documentId, 'previous', familyId),
    findExplicitNeighbor(documentId, 'next', familyId),
  ]);

  await db.transaction(async (tx) => {
    await tx
      .delete(documentLinks)
      .where(
        and(
          or(
            eq(documentLinks.fromDocumentId, documentId),
            eq(documentLinks.toDocumentId, documentId),
          ),
          eq(documentLinks.familyId, familyId),
        ),
      );

    if (prev && next) {
      await tx
        .delete(documentLinks)
        .where(
          and(
            eq(documentLinks.fromDocumentId, prev.id),
            eq(documentLinks.position, 'after'),
            eq(documentLinks.familyId, familyId),
          ),
        );
      await tx
        .delete(documentLinks)
        .where(
          and(
            eq(documentLinks.toDocumentId, next.id),
            eq(documentLinks.position, 'after'),
            eq(documentLinks.familyId, familyId),
          ),
        );
      await tx
        .delete(documentLinks)
        .where(
          and(
            eq(documentLinks.fromDocumentId, next.id),
            eq(documentLinks.position, 'before'),
            eq(documentLinks.familyId, familyId),
          ),
        );
      await tx
        .delete(documentLinks)
        .where(
          and(
            eq(documentLinks.toDocumentId, prev.id),
            eq(documentLinks.position, 'before'),
            eq(documentLinks.familyId, familyId),
          ),
        );

      await tx.insert(documentLinks).values({
        fromDocumentId: prev.id,
        toDocumentId: next.id,
        familyId,
        position: 'after',
        ordinal: null,
        updatedAt: new Date(),
      });
    }
  });

  return { previous: prev, next };
}

// =============================================================================
// AI suggestion scorer (unchanged)
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

export function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 1);
}

export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 && setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

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
