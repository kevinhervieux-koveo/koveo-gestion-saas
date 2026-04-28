/**
 * Task #1643 — Client-side deduplication of document link families.
 *
 * The backend GET /api/document-link-families endpoint already strips
 * non-canonical duplicates via `buildCanonicalResult`. This helper applies
 * the same dedup pass on the client as a belt-and-suspenders safety net,
 * so the main Link Families settings page never shows duplicate cards even
 * if a future backend regression or a partially-completed startup backfill
 * leaves residual duplicates in the response.
 *
 * Dedup rules (must match `pickWinner` in
 * `server/services/canonical-family-resolver.ts`):
 *   1. Family is keyed by normalized name (trim + casefold).
 *   2. System family (organizationId IS NULL or isSystem = true) wins over
 *      any org-scoped family with the same normalized name.
 *   3. Otherwise the one with the oldest `createdAt` wins.
 *   4. Tie-break by id (lexicographic) for determinism.
 */

export interface DedupeLinkFamilyShape {
  id: string;
  name: string;
  isSystem: boolean;
  organizationId: string | null;
  createdAt?: string | Date | null;
}

function normalizeFamilyName(name: string): string {
  return name.trim().toLowerCase();
}

function toMillis(value: string | Date | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function pickWinner<T extends DedupeLinkFamilyShape>(a: T, b: T): T {
  const aIsSystem = a.isSystem || a.organizationId === null;
  const bIsSystem = b.isSystem || b.organizationId === null;
  if (aIsSystem && !bIsSystem) return a;
  if (bIsSystem && !aIsSystem) return b;

  const diff = toMillis(a.createdAt) - toMillis(b.createdAt);
  if (diff !== 0) return diff < 0 ? a : b;

  return a.id < b.id ? a : b;
}

/**
 * Return the canonical family per normalized name. The input order is
 * preserved for canonical winners; non-canonical duplicates are dropped.
 */
export function dedupeLinkFamilies<T extends DedupeLinkFamilyShape>(
  families: T[],
): T[] {
  const winnerByNorm = new Map<string, T>();
  for (const f of families) {
    const norm = normalizeFamilyName(f.name);
    const existing = winnerByNorm.get(norm);
    if (!existing) {
      winnerByNorm.set(norm, f);
      continue;
    }
    winnerByNorm.set(norm, pickWinner(existing, f));
  }

  const winners = new Set(winnerByNorm.values());
  return families.filter((f) => winners.has(f));
}
