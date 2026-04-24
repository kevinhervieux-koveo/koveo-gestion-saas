/**
 * @jest-environment node
 *
 * @file Bulk-import analyzer per-step cache — Task #483
 * @description The unit suite at
 *   `tests/unit/services/bulk-import-analyzer.test.ts` mocks the shared
 *   AI suggestion cache module with an in-memory Map. That proves the
 *   analyzer talks to the cache, but it does not prove the analyzer
 *   actually round-trips through the real `ai_suggestion_cache`
 *   Postgres table. This suite drives `bulkImportAnalyzer` against a
 *   real database (gated on `_INTEGRATION_DB_URL`, mirroring
 *   `server/tests/ai-suggestion-cache.test.ts`) with a fake Anthropic
 *   client and asserts:
 *     1. A second call with the same step + content hits the row written
 *        by the first call and skips the Anthropic round-trip.
 *     2. Two different analyzer steps for the same file write to two
 *        distinct rows so they cannot clobber each other.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('bulkImportAnalyzer cache against real Postgres (Task #483)', () => {
  let db: typeof import('../db').db;
  let aiSuggestionCache: typeof import('@shared/schemas/infrastructure').aiSuggestionCache;
  let bulkImportAnalyzer: typeof import('../services/bulk-import-analyzer').bulkImportAnalyzer;
  let clearAiSuggestionCache: typeof import('../services/ai-suggestion-cache').clearAiSuggestionCache;
  let drizzleOrm: typeof import('drizzle-orm');

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    // The analyzer skips the Anthropic call entirely when the API key is
    // missing, returning deterministic stubs without consulting the
    // cache. Set a dummy value so `getClient()` doesn't bail — we still
    // override the actual client below so no real network call happens.
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-task483';

    db = require('../db').db;
    aiSuggestionCache = require('@shared/schemas/infrastructure').aiSuggestionCache;
    drizzleOrm = require('drizzle-orm');

    bulkImportAnalyzer = require('../services/bulk-import-analyzer').bulkImportAnalyzer;
    clearAiSuggestionCache = require('../services/ai-suggestion-cache').clearAiSuggestionCache;
  });

  beforeEach(async () => {
    if (!REAL_DB_URL) return;
    await clearAiSuggestionCache();
    bulkImportAnalyzer.__setClientForTests(null);
  });

  afterAll(async () => {
    if (!REAL_DB_URL) return;
    bulkImportAnalyzer.__setClientForTests(null);
    await clearAiSuggestionCache();
  });

  function makeFakeClient(jsonPayload: object) {
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(jsonPayload) }],
    });
    const fakeClient = {
      messages: { create },
    } as unknown as Parameters<typeof bulkImportAnalyzer.__setClientForTests>[0];
    bulkImportAnalyzer.__setClientForTests(fakeClient);
    return create;
  }

  it('reads the row written by the first call on a repeat invocation', async () => {
    const { like } = drizzleOrm;

    const create = makeFakeClient({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'task483-roundtrip.pdf',
      description: 'Cached via real Postgres',
      confidence: 0.91,
    });

    // Unique payload per run so concurrent CI lanes don't collide on the
    // same content hash.
    const args = {
      originalName: 'task483-roundtrip.pdf',
      mimeType: 'application/pdf',
      fileSize: 64,
      buffer: Buffer.from(`%PDF-1.4 task483 roundtrip ${Date.now()} ${Math.random()}`),
    };

    const first = await bulkImportAnalyzer.screen(args);
    const second = await bulkImportAnalyzer.screen(args);

    // The Anthropic client must only be called once: the second call has
    // to come back out of the real `ai_suggestion_cache` row.
    expect(create).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(second.suggestedFilename).toBe('task483-roundtrip.pdf');

    // Sanity check: exactly one row exists in the table for this step,
    // proving the round-trip went through Postgres rather than an
    // in-process cache.
    const rows = await db
      .select()
      .from(aiSuggestionCache)
      .where(like(aiSuggestionCache.cacheKey, 'bulk-import-analyzer:v1:screen:%'));
    expect(rows).toHaveLength(1);
  });

  it('writes two distinct rows when the same file is analyzed by two different steps', async () => {
    const { like } = drizzleOrm;

    const buffer = Buffer.from(`%PDF-1.4 task483 multi-step ${Date.now()} ${Math.random()}`);
    const mimeType = 'application/pdf';
    const originalName = 'task483-multi-step.pdf';

    makeFakeClient({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: originalName,
      description: 'screen step',
      confidence: 0.7,
    });
    await bulkImportAnalyzer.screen({ originalName, mimeType, buffer });

    makeFakeClient({
      branch: 'building_documents',
      reason: 'cover page',
      confidence: 0.8,
    });
    await bulkImportAnalyzer.suggestBranch({ originalName, mimeType, buffer });

    // Two distinct rows must exist — one per step — so step results
    // never clobber each other on the shared content hash.
    const screenRows = await db
      .select()
      .from(aiSuggestionCache)
      .where(like(aiSuggestionCache.cacheKey, 'bulk-import-analyzer:v1:screen:%'));
    const branchRows = await db
      .select()
      .from(aiSuggestionCache)
      .where(like(aiSuggestionCache.cacheKey, 'bulk-import-analyzer:v1:branch:%'));

    expect(screenRows).toHaveLength(1);
    expect(branchRows).toHaveLength(1);
    expect(screenRows[0].cacheKey).not.toBe(branchRows[0].cacheKey);
  });
});
