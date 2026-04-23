/**
 * @jest-environment node
 */
/**
 * End-to-end test for the inline-data path of POST /api/ai/suggest-document-tags.
 *
 * Task #359 covered the DOCX/XLSX text-extraction path with real fixtures.
 * This test exercises the complementary inline-data path (PDFs and images)
 * with real fixture buffers, going through the full Express route + the
 * real `ConsolidatedAIService.suggestDocumentTags` implementation. Only
 * `@google/genai` is stubbed so we can assert the route packages each
 * upload as a Gemini `inlineData` part with the correct mimeType and a
 * base64 encoding of the original file buffer.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';

type GeminiTextPart = { text: string };
type GeminiInlinePart = { inlineData: { data: string; mimeType: string } };
type GeminiPart = GeminiTextPart | GeminiInlinePart;
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
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: generateContentMock },
  })),
}));

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

import {
  registerAiAnalysisRoutes,
  __clearTagSuggestionCacheForTests,
} from '../api/ai-document-analysis';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const PDF_BUFFER = fs.readFileSync(path.join(FIXTURES_DIR, 'sample.pdf'));
const PNG_BUFFER = fs.readFileSync(path.join(FIXTURES_DIR, 'sample.png'));
const JPG_BUFFER = fs.readFileSync(path.join(FIXTURES_DIR, 'sample.jpg'));

const TAGS = [
  { id: 'tag-insurance', name: 'Insurance', description: 'Insurance documents' },
  { id: 'tag-lease', name: 'Lease', description: 'Lease agreements' },
  { id: 'tag-tax', name: 'Tax', description: 'Tax documents' },
];

function makeGeminiResponse(ids: string[]): GeminiResponse {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(ids) }] } }],
  };
}

function isInlinePart(part: GeminiPart): part is GeminiInlinePart {
  return 'inlineData' in part;
}

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  registerAiAnalysisRoutes(app);
  return app;
}

async function postSuggestion(
  app: express.Express,
  file: Buffer,
  filename: string,
  contentType: string,
  tagIds: typeof TAGS = TAGS
) {
  return request(app)
    .post('/api/ai/suggest-document-tags')
    .field('tags', JSON.stringify(tagIds))
    .attach('document', file, { filename, contentType });
}

describe('POST /api/ai/suggest-document-tags - inline-data path (PDF + images)', () => {
  let app: express.Express;

  beforeEach(async () => {
    // The cache clear hits Postgres; tolerate an unavailable test DB since
    // the read/write paths already swallow errors and treat them as misses,
    // so each test still starts from an effectively empty cache.
    await __clearTagSuggestionCacheForTests().catch(() => {});
    generateContentMock.mockReset();
    app = buildApp();
  });

  it('packages a PDF upload as an inlineData part with the correct mimeType and base64 buffer', async () => {
    generateContentMock.mockResolvedValue(makeGeminiResponse(['tag-insurance']));

    const res = await postSuggestion(app, PDF_BUFFER, 'sample.pdf', 'application/pdf');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      tagIds: ['tag-insurance'],
      source: 'ai',
      cached: false,
    });

    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const parts = generateContentMock.mock.calls[0][0].contents[0].parts;
    const inlineParts = parts.filter(isInlinePart);
    expect(inlineParts).toHaveLength(1);
    expect(inlineParts[0].inlineData.mimeType).toBe('application/pdf');
    expect(inlineParts[0].inlineData.data).toBe(PDF_BUFFER.toString('base64'));
    // Sanity-check that the base64 round-trips back to the original bytes.
    expect(Buffer.from(inlineParts[0].inlineData.data, 'base64').equals(PDF_BUFFER)).toBe(true);
  });

  it('packages a PNG upload as an inlineData part with the correct mimeType and base64 buffer', async () => {
    generateContentMock.mockResolvedValue(makeGeminiResponse(['tag-lease', 'tag-tax']));

    const res = await postSuggestion(app, PNG_BUFFER, 'sample.png', 'image/png');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      tagIds: ['tag-lease', 'tag-tax'],
      source: 'ai',
      cached: false,
    });

    const parts = generateContentMock.mock.calls[0][0].contents[0].parts;
    const inlineParts = parts.filter(isInlinePart);
    expect(inlineParts).toHaveLength(1);
    expect(inlineParts[0].inlineData.mimeType).toBe('image/png');
    expect(inlineParts[0].inlineData.data).toBe(PNG_BUFFER.toString('base64'));
    expect(Buffer.from(inlineParts[0].inlineData.data, 'base64').equals(PNG_BUFFER)).toBe(true);
  });

  it('packages a JPEG upload as an inlineData part with the correct mimeType and base64 buffer', async () => {
    generateContentMock.mockResolvedValue(makeGeminiResponse(['tag-insurance']));

    const res = await postSuggestion(app, JPG_BUFFER, 'sample.jpg', 'image/jpeg');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      tagIds: ['tag-insurance'],
      source: 'ai',
      cached: false,
    });

    const parts = generateContentMock.mock.calls[0][0].contents[0].parts;
    const inlineParts = parts.filter(isInlinePart);
    expect(inlineParts).toHaveLength(1);
    expect(inlineParts[0].inlineData.mimeType).toBe('image/jpeg');
    expect(inlineParts[0].inlineData.data).toBe(JPG_BUFFER.toString('base64'));
    expect(Buffer.from(inlineParts[0].inlineData.data, 'base64').equals(JPG_BUFFER)).toBe(true);
  });

  it('packages a WEBP upload as an inlineData part with the correct mimeType and base64 buffer', async () => {
    // The route accepts the buffer as-is; we reuse the PNG fixture bytes but
    // declare them as image/webp to confirm the route preserves whatever
    // mimeType the client uploaded under (this exercises the inline branch
    // for the webp entry in INLINE_TAG_SUGGESTION_TYPES).
    generateContentMock.mockResolvedValue(makeGeminiResponse(['tag-lease']));

    const res = await postSuggestion(app, PNG_BUFFER, 'sample.webp', 'image/webp');

    expect(res.status).toBe(200);
    expect(res.body.tagIds).toEqual(['tag-lease']);

    const parts = generateContentMock.mock.calls[0][0].contents[0].parts;
    const inlineParts = parts.filter(isInlinePart);
    expect(inlineParts).toHaveLength(1);
    expect(inlineParts[0].inlineData.mimeType).toBe('image/webp');
    expect(inlineParts[0].inlineData.data).toBe(PNG_BUFFER.toString('base64'));
  });

  it('drops AI-returned IDs that are not in the candidate tag list', async () => {
    generateContentMock.mockResolvedValue(
      makeGeminiResponse(['tag-insurance', 'tag-not-in-list'])
    );

    const res = await postSuggestion(app, PDF_BUFFER, 'sample.pdf', 'application/pdf');

    expect(res.status).toBe(200);
    expect(res.body.tagIds).toEqual(['tag-insurance']);
  });
});
