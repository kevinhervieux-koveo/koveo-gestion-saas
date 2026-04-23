/**
 * @jest-environment node
 *
 * Tests for AI tag suggestion:
 *   - ConsolidatedAIService.suggestDocumentTags (Gemini client mocked)
 *   - POST /api/ai/suggest-document-tags route handler (validation, fallback)
 *   - POST /api/ai/suggest-document-tags caching behavior
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// --- Mock the Gemini client used by ConsolidatedAIService ---
// Used by the service-level unit tests, which instantiate the *real*
// ConsolidatedAIService via requireActual below.
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: (...args: any[]) => mockGenerateContent(...args) },
  })),
}));

// --- Make requireAuth a no-op for route tests ---
// The route imports `'../auth'` which resolves to `server/auth.ts`. The same
// resolved path is used here, so jest will share the mock module.
jest.mock('../auth', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

// --- Mock the AI service singleton used by the route ---
// Keep the real `ConsolidatedAIService` class export (used by the service-level
// unit tests below) but replace the singleton `aiService` with a mock so the
// route tests and the cache tests can drive its `suggestDocumentTags` method
// without hitting Gemini.
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

// Ensure the service thinks the API key is configured before instantiation
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

// `jest.polyfills.js` stashes the real DATABASE_URL into `_INTEGRATION_DB_URL`
// and `jest.setup.simple.ts` then overrides DATABASE_URL with a fake unit-tier
// value. The route module transitively imports `server/db`, which builds a
// Pool eagerly from DATABASE_URL — so for the route + caching describes that
// hit the real Postgres-backed cache we need to restore the integration URL
// before the route module is loaded.
if (process.env._INTEGRATION_DB_URL) {
  process.env.DATABASE_URL = process.env._INTEGRATION_DB_URL;
  process.env.USE_MOCK_DB = 'false';
}

// Imports after mocks
import { ConsolidatedAIService, aiService } from '../services/consolidated-ai-service';
import {
  registerAiAnalysisRoutes,
  __clearTagSuggestionCacheForTests,
} from '../api/ai-document-analysis';

const suggestMock = aiService.suggestDocumentTags as jest.Mock;

function geminiTextResponse(text: string) {
  return {
    candidates: [{ content: { parts: [{ text }] } }],
  };
}

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  registerAiAnalysisRoutes(app);
  return app;
}

const sampleTags = [
  { id: 'tag-1', name: 'Insurance' },
  { id: 'tag-2', name: 'Maintenance' },
  { id: 'tag-3', name: 'Lease', description: 'Rental agreements' },
  { id: 'tag-4', name: 'Utilities' },
];

describe('ConsolidatedAIService.suggestDocumentTags', () => {
  let service: ConsolidatedAIService;

  beforeEach(() => {
    mockGenerateContent.mockReset();
    service = new ConsolidatedAIService();
  });

  it('only returns IDs that exist in the supplied tag list', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextResponse('["tag-2","unknown-tag","tag-4"]')
    );

    const result = await service.suggestDocumentTags(
      Buffer.from('pdf-bytes'),
      'application/pdf',
      sampleTags,
      undefined,
      5
    );

    expect(result).toEqual(['tag-2', 'tag-4']);
  });

  it('caps the number of returned IDs at the requested max', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextResponse('["tag-1","tag-2","tag-3","tag-4"]')
    );

    const result = await service.suggestDocumentTags(
      Buffer.from('pdf-bytes'),
      'application/pdf',
      sampleTags,
      undefined,
      2
    );

    expect(result).toEqual(['tag-1', 'tag-2']);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('deduplicates repeated IDs in the AI response', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextResponse('["tag-1","tag-1","tag-2"]')
    );

    const result = await service.suggestDocumentTags(
      Buffer.from('pdf-bytes'),
      'application/pdf',
      sampleTags,
      undefined,
      5
    );

    expect(result).toEqual(['tag-1', 'tag-2']);
  });

  it('returns an empty list when the AI response is malformed JSON', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextResponse('this is not json at all')
    );

    const result = await service.suggestDocumentTags(
      Buffer.from('pdf-bytes'),
      'application/pdf',
      sampleTags
    );

    expect(result).toEqual([]);
  });

  it('returns an empty list when the AI response is not a JSON array', async () => {
    // A bare JSON object with no embedded array — the parser cannot recover
    // any tag IDs from this and must degrade to an empty list.
    mockGenerateContent.mockResolvedValue(
      geminiTextResponse('{"answer":"none"}')
    );

    const result = await service.suggestDocumentTags(
      Buffer.from('pdf-bytes'),
      'application/pdf',
      sampleTags
    );

    expect(result).toEqual([]);
  });

  it('strips markdown code fences before parsing the response', async () => {
    mockGenerateContent.mockResolvedValue(
      geminiTextResponse('```json\n["tag-3"]\n```')
    );

    const result = await service.suggestDocumentTags(
      Buffer.from('pdf-bytes'),
      'application/pdf',
      sampleTags
    );

    expect(result).toEqual(['tag-3']);
  });

  it('throws when the MIME type is not in the supported list', async () => {
    await expect(
      service.suggestDocumentTags(
        Buffer.from('zzz'),
        'application/zip',
        sampleTags
      )
    ).rejects.toThrow(/Unsupported file type for tag suggestion/);

    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('returns [] without calling Gemini when no tags are supplied', async () => {
    const result = await service.suggestDocumentTags(
      Buffer.from('pdf-bytes'),
      'application/pdf',
      []
    );

    expect(result).toEqual([]);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});

// The route's tag-suggestion cache is now Postgres-backed
// (see server/services/ai-suggestion-cache.ts), so the route + cache
// describes below need a real database. Mirror the gating pattern used
// by `server/tests/ai-suggestion-cache.test.ts`.
const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('POST /api/ai/suggest-document-tags', () => {
  let app: express.Express;

  beforeEach(() => {
    // Route uses an in-memory TTL cache keyed by file bytes + tag list, so
    // identical-payload tests would otherwise hit a previous test's result.
    __clearTagSuggestionCacheForTests();
    suggestMock.mockReset();
    app = buildApp();
  });

  it('returns the AI-suggested tag IDs on success', async () => {
    suggestMock.mockResolvedValue(['tag-2', 'tag-4']);

    const res = await request(app)
      .post('/api/ai/suggest-document-tags')
      .field('tags', JSON.stringify(sampleTags))
      .field('max', '3')
      .attach('document', Buffer.from('pdf-bytes'), {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      tagIds: ['tag-2', 'tag-4'],
      source: 'ai',
    });
    expect(res.body.metadata).toMatchObject({
      fileName: 'doc.pdf',
      mimeType: 'application/pdf',
      consideredTags: sampleTags.length,
    });
    expect(suggestMock).toHaveBeenCalledTimes(1);
  });

  it("returns source: 'unavailable' with HTTP 200 when the AI service is unconfigured", async () => {
    suggestMock.mockRejectedValue(
      new Error('AI service is not available. Please ensure GEMINI_API_KEY is configured.')
    );

    const res = await request(app)
      .post('/api/ai/suggest-document-tags')
      .field('tags', JSON.stringify(sampleTags))
      .attach('document', Buffer.from('pdf-bytes'), {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: false,
      tagIds: [],
      source: 'unavailable',
    });
    expect(typeof res.body.error).toBe('string');
  });

  it('returns 400 when no document is uploaded', async () => {
    const res = await request(app)
      .post('/api/ai/suggest-document-tags')
      .field('tags', JSON.stringify(sampleTags));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the tags payload is malformed JSON', async () => {
    const res = await request(app)
      .post('/api/ai/suggest-document-tags')
      .field('tags', 'not-json')
      .attach('document', Buffer.from('pdf-bytes'), {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('short-circuits to an empty list (without calling AI) when no tags are supplied', async () => {
    const res = await request(app)
      .post('/api/ai/suggest-document-tags')
      .field('tags', JSON.stringify([]))
      .attach('document', Buffer.from('pdf-bytes'), {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      tagIds: [],
      source: 'ai',
    });
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported MIME types at the multer layer', async () => {
    const res = await request(app)
      .post('/api/ai/suggest-document-tags')
      .field('tags', JSON.stringify(sampleTags))
      .attach('document', Buffer.from('zzz'), {
        filename: 'archive.zip',
        contentType: 'application/zip',
      });

    // multer's fileFilter throws -> Express default error handler -> 500
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(suggestMock).not.toHaveBeenCalled();
  });
});

describeIfDb('POST /api/ai/suggest-document-tags caching', () => {
  let app: express.Express;

  const FILE_BUFFER = Buffer.from('%PDF-1.4 hello world tag-suggestion-test\n');
  const TAGS_A = [
    { id: 'tag-1', name: 'Insurance', description: 'Insurance documents' },
    { id: 'tag-2', name: 'Lease', description: 'Lease agreements' },
  ];
  const TAGS_B = [
    ...TAGS_A,
    { id: 'tag-3', name: 'Tax', description: 'Tax documents' },
  ];

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
