/**
 * @jest-environment node
 *
 * End-to-end integration test for the AI tag suggestion upload route with
 * real Office documents.
 *
 * Unlike `suggest-document-tags-office.test.ts` (which mocks mammoth and
 * xlsx) and `ai-document-tag-suggestion.test.ts` (which mocks the entire
 * `aiService`), this test exercises the full pipeline:
 *   - The actual `/api/ai/suggest-document-tags` route handler
 *   - The real `ConsolidatedAIService.suggestDocumentTags` implementation
 *   - The real mammoth and xlsx libraries against genuine fixture files
 *
 * Only the Gemini SDK (`@google/genai`) is stubbed at the network layer so
 * we don't actually contact Google's API. This is the layer most likely to
 * regress when extraction libraries change or the upload wiring is altered.
 */

import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import express from 'express';
import request from 'supertest';

type GeminiPart = { text: string } | { inlineData: { data: string; mimeType: string } };
type GenerateContentArg = {
  model: string;
  contents: Array<{ role: string; parts: GeminiPart[] }>;
};
type GeminiResponse = {
  candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
};

const generateContentMock =
  jest.fn<(arg: GenerateContentArg) => Promise<GeminiResponse>>();

jest.mock('@google/genai', () => ({
  __esModule: true,
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: generateContentMock },
  })),
}));

jest.mock('../services/secure-file-storage', () => ({
  __esModule: true,
  secureFileStorage: {
    storeFile: jest.fn(),
    retrieveFile: jest.fn(),
  },
}));

// Stub the suggestion cache so the test does not need a live database.
// The cache layer itself is exercised by `ai-document-tag-suggestion.test.ts`;
// here we care about the extraction pipeline, not the cache.
jest.mock('../services/ai-suggestion-cache', () => {
  const store = new Map<string, unknown>();
  return {
    __esModule: true,
    getCachedSuggestion: jest.fn(async (key: string) => store.get(key) ?? null),
    setCachedSuggestion: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    clearAiSuggestionCache: jest.fn(async () => {
      store.clear();
    }),
  };
});

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

import {
  registerAiAnalysisRoutes,
  __clearTagSuggestionCacheForTests,
} from '../api/ai-document-analysis';

const FIXTURES_DIR = path.join(process.cwd(), 'server/tests/fixtures');
const DOCX_FIXTURE = path.join(FIXTURES_DIR, 'sample-minutes.docx');
const XLSX_FIXTURE = path.join(FIXTURES_DIR, 'sample-budget.xlsx');

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const TAGS = [
  { id: 'tag-budget', name: 'Budget', description: 'Annual budgets and forecasts' },
  { id: 'tag-minutes', name: 'Meeting Minutes', description: 'Board meeting minutes' },
  { id: 'tag-insurance', name: 'Insurance', description: 'Insurance policies and renewals' },
  { id: 'tag-other', name: 'Other', description: null },
];

function makeGeminiResponse(ids: string[]): GeminiResponse {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(ids) }] } }],
  };
}

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  registerAiAnalysisRoutes(app);
  return app;
}

describe('POST /api/ai/suggest-document-tags - real DOCX/XLSX end-to-end', () => {
  let app: express.Express;

  beforeAll(() => {
    // Sanity-check that the fixtures actually exist on disk. If a developer
    // accidentally deletes them, fail loudly with a useful message rather
    // than producing a misleading "no text extracted" assertion failure.
    expect(fs.existsSync(DOCX_FIXTURE)).toBe(true);
    expect(fs.existsSync(XLSX_FIXTURE)).toBe(true);
  });

  beforeEach(async () => {
    await __clearTagSuggestionCacheForTests();
    generateContentMock.mockReset();
    app = buildApp();
  });

  it('extracts text from a real .docx via mammoth and forwards it to Gemini', async () => {
    generateContentMock.mockResolvedValue(makeGeminiResponse(['tag-minutes']));

    const response = await request(app)
      .post('/api/ai/suggest-document-tags')
      .field('tags', JSON.stringify(TAGS))
      .field('category', 'minutes')
      .field('scope', 'building')
      .attach('document', DOCX_FIXTURE, {
        filename: 'sample-minutes.docx',
        contentType: DOCX_MIME,
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      tagIds: ['tag-minutes'],
      source: 'ai',
      cached: false,
    });

    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const call = generateContentMock.mock.calls[0][0];
    const parts = call.contents[0].parts;

    // DOCX must take the text-extraction path, not the inlineData path.
    expect(parts.some((p) => 'inlineData' in p)).toBe(false);

    const joined = parts
      .filter((p): p is { text: string } => 'text' in p)
      .map((p) => p.text)
      .join('\n');

    // Content actually extracted by the real mammoth library from the
    // fixture must reach the Gemini prompt.
    expect(joined).toContain('Annual Board Meeting Minutes');
    expect(joined).toContain('insurance renewal');
    expect(joined).toContain(DOCX_MIME);
  });

  it('extracts CSV text from a real .xlsx via xlsx and forwards it to Gemini', async () => {
    generateContentMock.mockResolvedValue(
      makeGeminiResponse(['tag-budget', 'tag-insurance'])
    );

    const response = await request(app)
      .post('/api/ai/suggest-document-tags')
      .field('tags', JSON.stringify(TAGS))
      .field('category', 'finance')
      .field('scope', 'building')
      .attach('document', XLSX_FIXTURE, {
        filename: 'sample-budget.xlsx',
        contentType: XLSX_MIME,
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      tagIds: ['tag-budget', 'tag-insurance'],
      source: 'ai',
      cached: false,
    });

    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const call = generateContentMock.mock.calls[0][0];
    const parts = call.contents[0].parts;

    expect(parts.some((p) => 'inlineData' in p)).toBe(false);

    const joined = parts
      .filter((p): p is { text: string } => 'text' in p)
      .map((p) => p.text)
      .join('\n');

    // Real xlsx parsing must surface the sheet name header and row data
    // produced by sheet_to_csv.
    expect(joined).toContain('# Budget');
    expect(joined).toContain('Elevator Maintenance,1500');
    expect(joined).toContain('Annual Insurance Premium,4800');
    expect(joined).toContain(XLSX_MIME);
  });

  it('drops AI-suggested tag IDs that are not in the candidate list', async () => {
    // Even with a real extraction pipeline, the route/service must defend
    // against the model hallucinating unknown tag IDs.
    generateContentMock.mockResolvedValue(
      makeGeminiResponse(['tag-budget', 'tag-not-a-real-tag'])
    );

    const response = await request(app)
      .post('/api/ai/suggest-document-tags')
      .field('tags', JSON.stringify(TAGS))
      .attach('document', XLSX_FIXTURE, {
        filename: 'sample-budget.xlsx',
        contentType: XLSX_MIME,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.tagIds).toEqual(['tag-budget']);
  });
});
