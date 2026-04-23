/**
 * @jest-environment node
 */
/**
 * Integration tests for the cached tag suggestion route.
 *
 * Verifies that POST /api/ai/suggest-document-tags caches Gemini results by
 * file hash + tag fingerprint + context: a second identical upload should
 * return `cached: true` and must NOT invoke `aiService.suggestDocumentTags`
 * a second time. Cache misses are also covered when the candidate tag set,
 * category, or scope change.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

jest.mock('../services/consolidated-ai-service', () => {
  const actual = jest.requireActual<typeof import('../services/consolidated-ai-service')>(
    '../services/consolidated-ai-service'
  );
  return {
    __esModule: true,
    ...actual,
    aiService: {
      suggestDocumentTags: jest.fn(),
    },
  };
});

jest.mock('../services/secure-file-storage', () => ({
  __esModule: true,
  secureFileStorage: {
    storeFile: jest.fn(),
    retrieveFile: jest.fn(),
  },
}));

import {
  registerAiAnalysisRoutes,
  __clearTagSuggestionCacheForTests,
} from '../api/ai-document-analysis';
import { aiService } from '../services/consolidated-ai-service';

const suggestMock = aiService.suggestDocumentTags as jest.Mock;

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  registerAiAnalysisRoutes(app);
  return app;
}

const FILE_BUFFER = Buffer.from('%PDF-1.4 hello world tag-suggestion-test\n');
const TAGS_A = [
  { id: 'tag-1', name: 'Insurance', description: 'Insurance documents' },
  { id: 'tag-2', name: 'Lease', description: 'Lease agreements' },
];
const TAGS_B = [
  ...TAGS_A,
  { id: 'tag-3', name: 'Tax', description: 'Tax documents' },
];

describe('POST /api/ai/suggest-document-tags caching', () => {
  let app: express.Express;

  beforeEach(() => {
    __clearTagSuggestionCacheForTests();
    suggestMock.mockReset();
    suggestMock.mockResolvedValue(['tag-1']);
    app = buildApp();
  });

  async function postSuggestion(opts: {
    tags: typeof TAGS_A;
    category?: string;
    scope?: 'building' | 'residence';
    file?: Buffer;
  }) {
    const req = request(app)
      .post('/api/ai/suggest-document-tags')
      .field('tags', JSON.stringify(opts.tags));
    if (opts.category) req.field('category', opts.category);
    if (opts.scope) req.field('scope', opts.scope);
    return req.attach('document', opts.file ?? FILE_BUFFER, {
      filename: 'test.pdf',
      contentType: 'application/pdf',
    });
  }

  it('returns cached suggestions on a repeat upload and skips the AI call', async () => {
    const first = await postSuggestion({ tags: TAGS_A, category: 'legal', scope: 'building' });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      success: true,
      tagIds: ['tag-1'],
      source: 'ai',
      cached: false,
    });

    const second = await postSuggestion({ tags: TAGS_A, category: 'legal', scope: 'building' });
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({
      success: true,
      tagIds: ['tag-1'],
      source: 'ai',
      cached: true,
    });

    expect(suggestMock).toHaveBeenCalledTimes(1);
  });

  it('treats a different candidate tag set as a cache miss', async () => {
    const first = await postSuggestion({ tags: TAGS_A, category: 'legal', scope: 'building' });
    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);

    const second = await postSuggestion({ tags: TAGS_B, category: 'legal', scope: 'building' });
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(false);

    expect(suggestMock).toHaveBeenCalledTimes(2);
  });

  it('treats a different category as a cache miss', async () => {
    const first = await postSuggestion({ tags: TAGS_A, category: 'legal', scope: 'building' });
    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);

    const second = await postSuggestion({ tags: TAGS_A, category: 'maintenance', scope: 'building' });
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(false);

    expect(suggestMock).toHaveBeenCalledTimes(2);
  });

  it('treats a different scope as a cache miss', async () => {
    const first = await postSuggestion({ tags: TAGS_A, category: 'legal', scope: 'building' });
    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);

    const second = await postSuggestion({ tags: TAGS_A, category: 'legal', scope: 'residence' });
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(false);

    expect(suggestMock).toHaveBeenCalledTimes(2);
  });

  it('treats a re-ordered tag list with identical content as a cache hit', async () => {
    const first = await postSuggestion({ tags: TAGS_A });
    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);

    const reordered = [...TAGS_A].reverse();
    const second = await postSuggestion({ tags: reordered });
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);

    expect(suggestMock).toHaveBeenCalledTimes(1);
  });
});
