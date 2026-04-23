/**
 * Shared, database-backed cache for AI-generated suggestions.
 *
 * The previous implementation lived in process memory: each server instance
 * kept its own Map and a restart wiped everything. Moving the cache to
 * Postgres lets every running instance benefit from a suggestion that any
 * user has already triggered, and entries survive deploys.
 *
 * Entries carry an `expiresAt` so readers transparently treat stale rows as
 * misses, and writers opportunistically prune expired rows on insert. A
 * soft cap on total entries keeps the table from growing without bound when
 * usage spikes.
 */

import { asc, eq, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { aiSuggestionCache } from '@shared/schemas/infrastructure';

const MAX_ENTRIES = 1000;

export async function getCachedSuggestion<T>(key: string): Promise<T | null> {
  try {
    const rows = await db
      .select()
      .from(aiSuggestionCache)
      .where(eq(aiSuggestionCache.cacheKey, key))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() <= Date.now()) {
      // Expired: drop it lazily and report a miss.
      await db
        .delete(aiSuggestionCache)
        .where(eq(aiSuggestionCache.cacheKey, key))
        .catch(() => {});
      return null;
    }
    return row.value as T;
  } catch (error) {
    console.warn(
      '[AI SUGGESTION CACHE] Read failed, treating as miss:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export async function setCachedSuggestion<T>(
  key: string,
  value: T,
  ttlMs: number
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(Date.now() + ttlMs);
  try {
    await db
      .insert(aiSuggestionCache)
      .values({
        cacheKey: key,
        value: value as unknown as object,
        expiresAt,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: aiSuggestionCache.cacheKey,
        set: {
          value: value as unknown as object,
          expiresAt,
          createdAt: now,
        },
      });

    // Opportunistic cleanup so the table stays small. Both queries are
    // best-effort: failures here must not break the request that produced
    // the cache write.
    await db
      .delete(aiSuggestionCache)
      .where(lt(aiSuggestionCache.expiresAt, new Date()))
      .catch(() => {});

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiSuggestionCache);
    if (count > MAX_ENTRIES) {
      const overflow = count - MAX_ENTRIES;
      const oldest = await db
        .select({ cacheKey: aiSuggestionCache.cacheKey })
        .from(aiSuggestionCache)
        .orderBy(asc(aiSuggestionCache.createdAt))
        .limit(overflow);
      if (oldest.length > 0) {
        for (const row of oldest) {
          await db
            .delete(aiSuggestionCache)
            .where(eq(aiSuggestionCache.cacheKey, row.cacheKey))
            .catch(() => {});
        }
      }
    }
  } catch (error) {
    console.warn(
      '[AI SUGGESTION CACHE] Write failed, suggestion will not be cached:',
      error instanceof Error ? error.message : error
    );
  }
}

export async function clearAiSuggestionCache(): Promise<void> {
  await db.delete(aiSuggestionCache);
}
