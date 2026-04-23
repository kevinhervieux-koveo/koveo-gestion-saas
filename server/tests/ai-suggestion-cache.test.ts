/**
 * @jest-environment node
 *
 * @file Shared AI suggestion cache — Task #360
 * @description Locks in the behaviour of the database-backed cache that
 *   `server/services/ai-suggestion-cache.ts` introduced. The cache lets
 *   any user benefit from a tag suggestion that any other user (or
 *   another server instance) has already triggered, treats expired rows
 *   as misses (and prunes them lazily), and caps total entries so the
 *   table cannot grow without bound under usage spikes.
 *
 *   Mirrors the real-DB integration pattern used by tests like
 *   `tests/integration/document-manager-only-visibility.test.ts`:
 *   gated on `_INTEGRATION_DB_URL`, lazy `require` of `server/db`
 *   inside `beforeAll` so the unit-tier setup file's DATABASE_URL
 *   override doesn't poison the module cache.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';

// Same trick the other real-DB suites use: jest.config.cjs maps the
// auth/storage/routes paths to in-repo unit-tier mocks, but the AI
// route handler we exercise here pulls in the real `requireAuth`. We
// keep `requireAuth` mocked (the unit-tier mock just calls next()),
// which is exactly what we want: it lets us swap req.user between
// requests so the "different caller" assertion is meaningful.

// `aiService.suggestDocumentTags` is the round-trip we want to count.
// Stub the entire module so importing the route file doesn't pull in
// Gemini/Google dependencies, and so we can assert call counts.
jest.mock('../services/consolidated-ai-service', () => ({
  aiService: {
    suggestDocumentTags: jest.fn(),
    extractBillData: jest.fn(),
  },
  ConsolidatedAIService: {
    TAG_SUGGESTION_SUPPORTED_MIME_TYPES: [
      'application/pdf',
      'image/png',
      'image/jpeg',
    ],
  },
}));

// secureFileStorage is referenced by the analyze-document route but not
// by suggest-document-tags. Stub it so the route module loads without
// touching the real filesystem helpers.
jest.mock('../services/secure-file-storage', () => ({
  secureFileStorage: {
    storeFile: jest.fn().mockResolvedValue({ success: false }),
    retrieveFile: jest.fn().mockResolvedValue({ success: false }),
  },
}));

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('shared AI suggestion cache (Task #360)', () => {
  let db: typeof import('../db').db;
  let aiSuggestionCache: typeof import('@shared/schemas/infrastructure').aiSuggestionCache;
  let getCachedSuggestion: typeof import('../services/ai-suggestion-cache').getCachedSuggestion;
  let setCachedSuggestion: typeof import('../services/ai-suggestion-cache').setCachedSuggestion;
  let clearAiSuggestionCache: typeof import('../services/ai-suggestion-cache').clearAiSuggestionCache;
  let pruneAiSuggestionCache: typeof import('../services/ai-suggestion-cache').pruneAiSuggestionCache;
  let AI_SUGGESTION_CACHE_MAX_ENTRIES: number;
  let registerAiAnalysisRoutes: typeof import('../api/ai-document-analysis').registerAiAnalysisRoutes;
  let aiServiceMock: { suggestDocumentTags: jest.Mock; extractBillData: jest.Mock };
  let drizzleOrm: typeof import('drizzle-orm');

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';

    db = require('../db').db;
    aiSuggestionCache = require('@shared/schemas/infrastructure').aiSuggestionCache;
    drizzleOrm = require('drizzle-orm');

    const cacheModule = require('../services/ai-suggestion-cache');
    getCachedSuggestion = cacheModule.getCachedSuggestion;
    setCachedSuggestion = cacheModule.setCachedSuggestion;
    clearAiSuggestionCache = cacheModule.clearAiSuggestionCache;
    pruneAiSuggestionCache = cacheModule.pruneAiSuggestionCache;
    AI_SUGGESTION_CACHE_MAX_ENTRIES = cacheModule.AI_SUGGESTION_CACHE_MAX_ENTRIES;

    const routeModule = require('../api/ai-document-analysis');
    registerAiAnalysisRoutes = routeModule.registerAiAnalysisRoutes;

    aiServiceMock = require('../services/consolidated-ai-service').aiService;
  });

  beforeEach(async () => {
    if (!REAL_DB_URL) return;
    await clearAiSuggestionCache();
    aiServiceMock.suggestDocumentTags.mockReset();
  });

  afterAll(async () => {
    if (!REAL_DB_URL) return;
    await clearAiSuggestionCache();
  });

  describe('cross-caller sharing via the API', () => {
    it('returns the same cached suggestion to a second caller and skips the AI round-trip', async () => {
      const express = require('express');
      const supertest = require('supertest');

      // Two separate Express apps with two different "users" stand in
      // for two callers (different sessions, different processes).
      // The cache key is content-derived, so the second app must hit
      // the row written by the first.
      const buildApp = (userId: string) => {
        const app = express();
        app.use(express.json());
        app.use((req: any, _res: any, next: any) => {
          req.user = { id: userId, role: 'admin', email: `${userId}@test` };
          next();
        });
        registerAiAnalysisRoutes(app);
        return app;
      };

      aiServiceMock.suggestDocumentTags.mockResolvedValue(['tag-a', 'tag-b']);

      const tagsField = JSON.stringify([
        { id: 'tag-a', name: 'Insurance', description: 'Insurance docs' },
        { id: 'tag-b', name: 'Utilities', description: 'Utility bills' },
      ]);
      const fileBuf = Buffer.from(`shared-cache-task360-${Date.now()}-payload`);

      const appA = buildApp('user-A-task360');
      const respA = await supertest(appA)
        .post('/api/ai/suggest-document-tags')
        .field('tags', tagsField)
        .field('category', 'general')
        .attach('document', fileBuf, {
          filename: 'doc.pdf',
          contentType: 'application/pdf',
        });

      expect(respA.status).toBe(200);
      expect(respA.body.success).toBe(true);
      expect(respA.body.tagIds).toEqual(['tag-a', 'tag-b']);
      expect(respA.body.cached).toBe(false);
      expect(aiServiceMock.suggestDocumentTags).toHaveBeenCalledTimes(1);

      const appB = buildApp('user-B-task360');
      const respB = await supertest(appB)
        .post('/api/ai/suggest-document-tags')
        .field('tags', tagsField)
        .field('category', 'general')
        .attach('document', fileBuf, {
          filename: 'doc.pdf',
          contentType: 'application/pdf',
        });

      expect(respB.status).toBe(200);
      expect(respB.body.success).toBe(true);
      expect(respB.body.tagIds).toEqual(['tag-a', 'tag-b']);
      expect(respB.body.cached).toBe(true);
      // The whole point of the shared cache: the second caller must
      // not trigger another AI round-trip.
      expect(aiServiceMock.suggestDocumentTags).toHaveBeenCalledTimes(1);
    });
  });

  describe('expiry handling', () => {
    it('treats expired entries as a miss and prunes the stale row', async () => {
      const { eq } = drizzleOrm;
      const key = `task360:expired:${Date.now()}:${Math.random()}`;

      await setCachedSuggestion(key, ['x', 'y'], 60_000);
      expect(await getCachedSuggestion<string[]>(key)).toEqual(['x', 'y']);

      // Force the row to look stale without waiting for the TTL.
      await db
        .update(aiSuggestionCache)
        .set({ expiresAt: new Date(Date.now() - 1_000) })
        .where(eq(aiSuggestionCache.cacheKey, key));

      const miss = await getCachedSuggestion<string[]>(key);
      expect(miss).toBeNull();

      // The reader prunes the stale row lazily so the table doesn't
      // accumulate tombstones for keys nobody re-requests.
      const survivors = await db
        .select()
        .from(aiSuggestionCache)
        .where(eq(aiSuggestionCache.cacheKey, key));
      expect(survivors).toHaveLength(0);
    });
  });

  describe('size cap (via pruneAiSuggestionCache)', () => {
    it('evicts the oldest entries once usage pushes the table past the cap', async () => {
      const { eq, like } = drizzleOrm;
      const PREFIX = `task360:cap:${Date.now()}:${Math.random()}:`;

      // Use a small per-test cap rather than the full default
      // (AI_SUGGESTION_CACHE_MAX_ENTRIES = 1000) so the test stays
      // fast. The pruner accepts an override for exactly this kind of
      // scenario.
      const TEST_CAP = 5;
      expect(typeof AI_SUGGESTION_CACHE_MAX_ENTRIES).toBe('number');

      // Pre-fill with TEST_CAP + 2 live entries with strictly
      // ascending createdAt so we know which two will be evicted
      // first.
      const baseTime = Date.now();
      const rows = Array.from({ length: TEST_CAP + 2 }, (_, i) => ({
        cacheKey: `${PREFIX}${String(i).padStart(4, '0')}`,
        value: { idx: i } as object,
        // Far in the future so the expiry sweep inside
        // pruneAiSuggestionCache() doesn't delete them and undercount.
        expiresAt: new Date(baseTime + 24 * 60 * 60 * 1000),
        createdAt: new Date(baseTime + i),
      }));
      await db.insert(aiSuggestionCache).values(rows);

      const oldestKey = rows[0].cacheKey;
      const secondOldestKey = rows[1].cacheKey;
      const newestKey = rows[rows.length - 1].cacheKey;

      // Sanity check: the oldest preload row exists before pruning.
      const beforeOldest = await db
        .select()
        .from(aiSuggestionCache)
        .where(eq(aiSuggestionCache.cacheKey, oldestKey));
      expect(beforeOldest).toHaveLength(1);

      // The maintenance job calls pruneAiSuggestionCache; eviction is
      // no longer on the write path. Drive it directly with a tighter
      // cap so the assertion is deterministic.
      const result = await pruneAiSuggestionCache(TEST_CAP);
      expect(result.overflowDeleted).toBe(2);

      // The two oldest preload rows must have been evicted, the
      // newest row must survive.
      const afterOldest = await db
        .select()
        .from(aiSuggestionCache)
        .where(eq(aiSuggestionCache.cacheKey, oldestKey));
      expect(afterOldest).toHaveLength(0);

      const afterSecondOldest = await db
        .select()
        .from(aiSuggestionCache)
        .where(eq(aiSuggestionCache.cacheKey, secondOldestKey));
      expect(afterSecondOldest).toHaveLength(0);

      const afterNewest = await db
        .select()
        .from(aiSuggestionCache)
        .where(eq(aiSuggestionCache.cacheKey, newestKey));
      expect(afterNewest).toHaveLength(1);

      // Cleanup the prefixed rows so other suites don't see them.
      await db
        .delete(aiSuggestionCache)
        .where(like(aiSuggestionCache.cacheKey, `${PREFIX}%`));
    });

    it('prunes expired rows on a maintenance pass', async () => {
      const { eq, like } = drizzleOrm;
      const PREFIX = `task360:expire-batch:${Date.now()}:${Math.random()}:`;

      // Insert a mix of expired and live rows. The pruner should
      // delete only the expired ones in a single pass and leave the
      // live ones untouched.
      const baseTime = Date.now();
      const rows = [
        {
          cacheKey: `${PREFIX}expired-1`,
          value: { stale: 1 } as object,
          expiresAt: new Date(baseTime - 60_000),
          createdAt: new Date(baseTime - 120_000),
        },
        {
          cacheKey: `${PREFIX}expired-2`,
          value: { stale: 2 } as object,
          expiresAt: new Date(baseTime - 30_000),
          createdAt: new Date(baseTime - 90_000),
        },
        {
          cacheKey: `${PREFIX}live-1`,
          value: { live: 1 } as object,
          expiresAt: new Date(baseTime + 60 * 60 * 1000),
          createdAt: new Date(baseTime),
        },
      ];
      await db.insert(aiSuggestionCache).values(rows);

      const result = await pruneAiSuggestionCache(
        AI_SUGGESTION_CACHE_MAX_ENTRIES
      );
      expect(result.expiredDeleted).toBeGreaterThanOrEqual(2);

      const survivingExpired = await db
        .select()
        .from(aiSuggestionCache)
        .where(eq(aiSuggestionCache.cacheKey, `${PREFIX}expired-1`));
      expect(survivingExpired).toHaveLength(0);

      const survivingLive = await db
        .select()
        .from(aiSuggestionCache)
        .where(eq(aiSuggestionCache.cacheKey, `${PREFIX}live-1`));
      expect(survivingLive).toHaveLength(1);

      await db
        .delete(aiSuggestionCache)
        .where(like(aiSuggestionCache.cacheKey, `${PREFIX}%`));
    });
  });
});
