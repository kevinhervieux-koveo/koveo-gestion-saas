/**
 * Shared, database-backed cache for AI-generated suggestions.
 *
 * The previous implementation lived in process memory: each server instance
 * kept its own Map and a restart wiped everything. Moving the cache to
 * Postgres lets every running instance benefit from a suggestion that any
 * user has already triggered, and entries survive deploys.
 *
 * Entries carry an `expiresAt` so readers transparently treat stale rows as
 * misses. A scheduled maintenance job (see `server/jobs/maintenanceJobs.ts`)
 * is responsible for pruning expired rows and enforcing the soft size cap so
 * write-path latency stays predictable.
 */

import { asc, eq, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { aiSuggestionCache } from '@shared/schemas/infrastructure';

export const AI_SUGGESTION_CACHE_MAX_ENTRIES = 1000;

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

/**
 * Result of a cache pruning pass.
 */
export interface AiSuggestionCachePruneResult {
  expiredDeleted: number;
  overflowDeleted: number;
}

/**
 * Prune expired rows and enforce the soft size cap on the suggestion cache.
 *
 * Intended to be called from the maintenance job scheduler. Safe to call
 * concurrently: each step is best-effort and surfaces a result rather than
 * throwing, so callers can log and move on.
 */
export async function pruneAiSuggestionCache(
  maxEntries: number = AI_SUGGESTION_CACHE_MAX_ENTRIES
): Promise<AiSuggestionCachePruneResult> {
  const result: AiSuggestionCachePruneResult = {
    expiredDeleted: 0,
    overflowDeleted: 0,
  };

  try {
    const expired = await db
      .delete(aiSuggestionCache)
      .where(lt(aiSuggestionCache.expiresAt, new Date()))
      .returning({ cacheKey: aiSuggestionCache.cacheKey });
    result.expiredDeleted = expired.length;
  } catch (error) {
    console.warn(
      '[AI SUGGESTION CACHE] Failed to prune expired rows:',
      error instanceof Error ? error.message : error
    );
  }

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiSuggestionCache);

    if (count > maxEntries) {
      const overflow = count - maxEntries;
      const oldest = await db
        .select({ cacheKey: aiSuggestionCache.cacheKey })
        .from(aiSuggestionCache)
        .orderBy(asc(aiSuggestionCache.createdAt))
        .limit(overflow);

      for (const row of oldest) {
        try {
          await db
            .delete(aiSuggestionCache)
            .where(eq(aiSuggestionCache.cacheKey, row.cacheKey));
          result.overflowDeleted++;
        } catch (error) {
          console.warn(
            '[AI SUGGESTION CACHE] Failed to evict overflow row:',
            error instanceof Error ? error.message : error
          );
        }
      }
    }
  } catch (error) {
    console.warn(
      '[AI SUGGESTION CACHE] Failed to enforce size cap:',
      error instanceof Error ? error.message : error
    );
  }

  return result;
}
