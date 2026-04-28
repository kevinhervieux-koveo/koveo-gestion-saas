/**
 * Task #1636 — Canonical family resolver.
 *
 * Given an organization ID, returns the visible document-link families
 * deduplicated by normalized name (trim + casefold). Deduplication rules:
 *
 *   1. System family (organizationId IS NULL, isSystem = true) always wins
 *      over any org-scoped family with the same normalized name.
 *   2. When two org-scoped families collide (legacy data), the one with the
 *      oldest `createdAt` wins.
 *
 * The resolver exposes:
 *  - `canonical`: deduplicated list of families (one per normalized name)
 *  - `duplicateToCanonical`: map of duplicate family id → canonical family id
 *  - `canonicalIdForFamilyId(id)`: look up canonical id for any (possibly
 *    duplicate) family id, returning the input unchanged when it is already
 *    canonical or unknown.
 */

import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '../db';
import { documentLinkFamilies, documentLinks } from '../../shared/schemas/documents';
import type { DocumentLinkFamily } from '../../shared/schemas/documents';
import { bulkImportItemFamilyMemberships } from '../../shared/schemas/bulk-import';
import { organizations } from '../../shared/schemas/core';

export type CanonicalFamilyResult = {
  canonical: DocumentLinkFamily[];
  duplicateToCanonical: Map<string, string>;
  canonicalIdForFamilyId: (id: string) => string;
};

/**
 * Normalize a family name for deduplication purposes:
 * trim surrounding whitespace and casefold (lowercase).
 */
export function normalizeFamilyName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Resolve all families visible to `organizationId` (system families +
 * org-scoped families) and deduplicate them by normalized name.
 *
 * Returns the canonical list and a map from every non-canonical (duplicate)
 * family id to the canonical id that won the collision.
 */
export async function resolveCanonicalFamilies(
  organizationId: string,
): Promise<CanonicalFamilyResult> {
  const rows = await db
    .select()
    .from(documentLinkFamilies)
    .where(
      or(
        isNull(documentLinkFamilies.organizationId),
        eq(documentLinkFamilies.organizationId, organizationId),
      ),
    );

  return buildCanonicalResult(rows);
}

/**
 * Resolve the canonical id for a single family id within an org's visible set.
 * Uses a full DB fetch of the org's family list to build the canonical map.
 * Returns the same id if it is already canonical or not found.
 */
export async function resolveCanonicalFamilyId(
  familyId: string,
  organizationId: string,
): Promise<string> {
  const { canonicalIdForFamilyId } = await resolveCanonicalFamilies(organizationId);
  return canonicalIdForFamilyId(familyId);
}

/**
 * Same as resolveCanonicalFamilies but accepts a pre-fetched set of rows
 * (useful when the caller already has the rows to avoid a redundant DB query).
 */
export function buildCanonicalResult(rows: DocumentLinkFamily[]): CanonicalFamilyResult {
  const byNorm = new Map<string, DocumentLinkFamily>();
  const duplicateToCanonical = new Map<string, string>();

  for (const row of rows) {
    const norm = normalizeFamilyName(row.name);
    const existing = byNorm.get(norm);

    if (!existing) {
      byNorm.set(norm, row);
      continue;
    }

    const winner = pickWinner(existing, row);
    const loser = winner === existing ? row : existing;

    byNorm.set(norm, winner);
    duplicateToCanonical.set(loser.id, winner.id);
  }

  for (const [loserId, canonId] of duplicateToCanonical) {
    let cur = canonId;
    while (duplicateToCanonical.has(cur)) {
      cur = duplicateToCanonical.get(cur)!;
    }
    if (cur !== canonId) {
      duplicateToCanonical.set(loserId, cur);
    }
  }

  const canonical = Array.from(byNorm.values());

  const canonicalIdForFamilyId = (id: string): string =>
    duplicateToCanonical.get(id) ?? id;

  return { canonical, duplicateToCanonical, canonicalIdForFamilyId };
}

/**
 * Given two families with the same normalized name, return the one that
 * should be the canonical representative.
 *
 * Rules:
 *  1. System family (isSystem = true / organizationId IS NULL) wins.
 *  2. Otherwise the one with the oldest createdAt wins.
 *  3. Tie-break by id (lexicographic) for determinism.
 */
function pickWinner(a: DocumentLinkFamily, b: DocumentLinkFamily): DocumentLinkFamily {
  const aIsSystem = a.isSystem || a.organizationId === null;
  const bIsSystem = b.isSystem || b.organizationId === null;

  if (aIsSystem && !bIsSystem) return a;
  if (bIsSystem && !aIsSystem) return b;

  const diff = a.createdAt.getTime() - b.createdAt.getTime();
  if (diff !== 0) return diff < 0 ? a : b;

  return a.id < b.id ? a : b;
}

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Return ALL canonical-family rows that would conflict with repointing `link`
 * to `canonicalId`.  A single edge can simultaneously trigger both the
 * from-position and the to-position unique constraints via two distinct rows,
 * so we must collect the full set before any arbitration.
 *
 * Constraints covered:
 *   from_position_family_uniq : (fromDocumentId, position, familyId)
 *   to_position_family_uniq   : (toDocumentId, position, familyId)
 *   edge_family_uniq is implied by the two above together.
 *
 * @param executor Pass `tx` when called inside a transaction so all reads
 *   share the same transaction snapshot.
 */
async function findAllDocumentLinkConflicts(
  link: { id: string; fromDocumentId: string; toDocumentId: string; position: 'before' | 'after' },
  canonicalId: string,
  executor: DbOrTx,
): Promise<Array<{ id: string; createdAt: Date }>> {
  return executor
    .select({ id: documentLinks.id, createdAt: documentLinks.createdAt })
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.familyId, canonicalId),
        or(
          and(
            eq(documentLinks.fromDocumentId, link.fromDocumentId),
            eq(documentLinks.position, link.position),
          ),
          and(
            eq(documentLinks.toDocumentId, link.toDocumentId),
            eq(documentLinks.position, link.position),
          ),
        ),
      ),
    );
}

/**
 * Merge duplicate families for a single organization: repoint all
 * `bulk_import_item_family_memberships.familyId` and
 * `document_links.familyId` rows from duplicates to their canonical id,
 * then delete the now-empty duplicate rows.
 *
 * Each duplicate pair is processed inside a single DB transaction so that
 * either all three steps (repoint memberships, repoint links, delete
 * duplicate) succeed together or none of them are committed.
 *
 * Conflict handling:
 *
 *   memberships — if the item already has a membership in the canonical
 *     family the duplicate membership row is deleted.
 *
 *   document_links — any of the three unique constraints is checked before
 *     repointing; when a collision exists we keep the *older* edge:
 *       • if the duplicate-family link is older → delete the canonical-side
 *         link and repoint the duplicate link to canonicalId.
 *       • otherwise (canonical-side is older) → delete the duplicate link.
 *
 * @returns Number of families merged.
 */
export async function mergeOrganizationDuplicateFamilies(
  organizationId: string,
  logger?: (msg: string) => void,
): Promise<number> {
  const log = logger ?? ((msg: string) => console.log(msg));
  const allFamilies = await db
    .select()
    .from(documentLinkFamilies)
    .where(
      or(
        isNull(documentLinkFamilies.organizationId),
        eq(documentLinkFamilies.organizationId, organizationId),
      ),
    );
  const { duplicateToCanonical } = buildCanonicalResult(allFamilies);
  const familyById = new Map(allFamilies.map((f) => [f.id, f]));

  if (duplicateToCanonical.size === 0) return 0;

  let mergedCount = 0;

  for (const [duplicateId, canonicalId] of duplicateToCanonical) {
    const dupFamily = familyById.get(duplicateId);
    const canonFamily = familyById.get(canonicalId);
    const familyName = dupFamily?.name ?? duplicateId;

    try {
      let membershipsRepointed = 0;
      let membershipsDeleted = 0;
      let linksRepointed = 0;
      let linksDeleted = 0;

      await db.transaction(async (tx) => {
        // --- Step 1: Repoint bulk_import_item_family_memberships ---
        const dupMemberships = await tx
          .select()
          .from(bulkImportItemFamilyMemberships)
          .where(eq(bulkImportItemFamilyMemberships.familyId, duplicateId));

        if (dupMemberships.length > 0) {
          const itemIds = dupMemberships.map((m) => m.itemId);
          const canonicalMemberships = await tx
            .select({ itemId: bulkImportItemFamilyMemberships.itemId })
            .from(bulkImportItemFamilyMemberships)
            .where(
              and(
                inArray(bulkImportItemFamilyMemberships.itemId, itemIds),
                eq(bulkImportItemFamilyMemberships.familyId, canonicalId),
              ),
            );
          const alreadyInCanonical = new Set(canonicalMemberships.map((m) => m.itemId));

          const toUpdate = dupMemberships.filter((m) => !alreadyInCanonical.has(m.itemId));
          const toDelete = dupMemberships.filter((m) => alreadyInCanonical.has(m.itemId));

          if (toUpdate.length > 0) {
            await tx
              .update(bulkImportItemFamilyMemberships)
              .set({ familyId: canonicalId })
              .where(inArray(bulkImportItemFamilyMemberships.id, toUpdate.map((m) => m.id)));
            membershipsRepointed = toUpdate.length;
          }
          if (toDelete.length > 0) {
            await tx
              .delete(bulkImportItemFamilyMemberships)
              .where(inArray(bulkImportItemFamilyMemberships.id, toDelete.map((m) => m.id)));
            membershipsDeleted = toDelete.length;
          }
        }

        // --- Step 2: Repoint document_links.familyId (keep older edge) ---
        const dupLinks = await tx
          .select()
          .from(documentLinks)
          .where(eq(documentLinks.familyId, duplicateId));

        for (const link of dupLinks) {
          const conflicts = await findAllDocumentLinkConflicts(
            link as { id: string; fromDocumentId: string; toDocumentId: string; position: 'before' | 'after' },
            canonicalId,
            tx,
          );
          if (conflicts.length > 0) {
            // Keep-oldest-edge: if the duplicate is strictly older than every
            // canonical-side conflict row, win by deleting all conflicts and
            // repointing the duplicate.  Otherwise the canonical side wins and
            // the duplicate is dropped.
            const oldestConflictTs = Math.min(...conflicts.map((c) => c.createdAt.getTime()));
            const dupIsOlder = link.createdAt.getTime() < oldestConflictTs;
            if (dupIsOlder) {
              const conflictIds = conflicts.map((c) => c.id);
              await tx.delete(documentLinks).where(inArray(documentLinks.id, conflictIds));
              await tx
                .update(documentLinks)
                .set({ familyId: canonicalId })
                .where(eq(documentLinks.id, link.id));
              linksRepointed++;
            } else {
              await tx.delete(documentLinks).where(eq(documentLinks.id, link.id));
              linksDeleted++;
            }
          } else {
            await tx
              .update(documentLinks)
              .set({ familyId: canonicalId })
              .where(eq(documentLinks.id, link.id));
            linksRepointed++;
          }
        }

        // --- Step 3: Delete the now-empty duplicate family row ---
        await tx
          .delete(documentLinkFamilies)
          .where(eq(documentLinkFamilies.id, duplicateId));
      });

      const rowsRepointed = membershipsRepointed + linksRepointed;
      log(
        `[canonical-family-resolver] merged: orgId=${organizationId} name="${familyName}" fromId=${duplicateId} → toId=${canonicalId} rowsRepointed=${rowsRepointed} (memberships: +${membershipsRepointed} -${membershipsDeleted}, links: +${linksRepointed} -${linksDeleted})`,
      );
      mergedCount++;
    } catch (err) {
      log(
        `[canonical-family-resolver] WARNING: transaction rolled back for orgId=${organizationId} name="${familyName}" fromId=${duplicateId} → toId=${canonicalId}: ${err}`,
      );
    }
  }

  return mergedCount;
}

/**
 * Run the one-time deduplication backfill across ALL organizations.
 * Called at server startup.
 */
export async function backfillAllOrganizationDuplicateFamilies(
  logger?: (msg: string) => void,
): Promise<void> {
  const log = logger ?? ((msg: string) => console.log(msg));

  const orgs = await db.select({ id: organizations.id }).from(organizations);

  log(
    `[canonical-family-resolver] Starting duplicate-family backfill for ${orgs.length} organizations`,
  );

  let total = 0;
  for (const org of orgs) {
    const merged = await mergeOrganizationDuplicateFamilies(org.id, log);
    total += merged;
  }

  if (total > 0) {
    log(
      `[canonical-family-resolver] Backfill complete — merged ${total} duplicate families total`,
    );
  } else {
    log('[canonical-family-resolver] Backfill complete — no duplicates found');
  }
}
