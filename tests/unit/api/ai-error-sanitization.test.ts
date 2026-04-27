/**
 * @jest-environment node
 *
 * Task #1307 — AI endpoint error sanitization tests.
 *
 * Verifies that `POST /api/ai/analyze-document` and
 * `POST /api/ai/suggest-document-tags` never echo raw AI exception
 * messages (stack traces, SQL text, or internal error strings) back to
 * the client when the underlying AI call fails.
 *
 * Coverage:
 *   - analyze-document: inner AI failure → 500 with generic message only
 *   - analyze-document: unexpected outer failure → 500 with generic message only
 *   - suggest-document-tags: AI failure → 200 with generic unavailability message
 *   - Neither endpoint leaks the raw error string in the response body
 */

jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn(() => ({ from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })) })),
    execute: jest.fn(() => Promise.resolve({ rows: [] })),
  },
  pool: {},
  sql: jest.fn(),
}));

jest.mock('../../../server/config/index', () => ({
  config: {
    rateLimit: { windowMs: 60000 },
    server: { isProduction: false, domain: 'localhost' },
    session: { secret: 'test-secret', cookie: {} },
  },
}));

jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: jest.fn().mockResolvedValue(true),
}));

const INTERNAL_AI_ERROR = 'DB connection failed: pg_hba.conf rejects connection';

jest.mock('../../../server/services/consolidated-ai-service', () => ({
  aiService: {
    isAiAvailable: jest.fn(() => true),
    extractBillData: jest.fn(() => Promise.reject(new Error(INTERNAL_AI_ERROR))),
    suggestDocumentTags: jest.fn(() => Promise.reject(new Error(INTERNAL_AI_ERROR))),
  },
  ConsolidatedAIService: {
    TAG_SUGGESTION_SUPPORTED_MIME_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
  },
}));

jest.mock('../../../server/services/secure-file-storage', () => ({
  secureFileStorage: {
    storeFile: jest.fn(() => Promise.resolve({ success: false })),
    retrieveFile: jest.fn(() => Promise.resolve({ success: false })),
  },
}));

jest.mock('../../../server/services/ai-suggestion-cache', () => ({
  getCachedSuggestion: jest.fn(() => Promise.resolve(null)),
  setCachedSuggestion: jest.fn(() => Promise.resolve()),
  clearAiSuggestionCache: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../server/utils/org-scope', () => ({
  resolveOrgScope: jest.fn(async () => ({ orgIds: ['org-1'], organizationId: 'org-1' })),
}));

jest.mock('../../../server/query-cache', () => ({
  queryCache: { get: jest.fn(() => null), set: jest.fn(), delete: jest.fn(), clear: jest.fn(), invalidate: jest.fn() },
  CacheInvalidator: { invalidate: jest.fn(), invalidateUserCaches: jest.fn() },
}));

import { describe, it, expect, beforeAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { registerAiAnalysisRoutes } from '../../../server/api/ai-document-analysis';

const TEST_USER_ID = 'test-user-001';

describe('AI endpoint error sanitization (Task #1307)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.session = { userId: TEST_USER_ID };
      req.user = { id: TEST_USER_ID, role: 'manager', email: 'manager@test.com' };
      next();
    });
    registerAiAnalysisRoutes(app);
  });

  describe('POST /api/ai/analyze-document', () => {
    it('returns 500 with a generic error message when AI fails', async () => {
      const res = await request(app)
        .post('/api/ai/analyze-document')
        .attach('document', Buffer.from('%PDF-1.4 mock'), 'test.pdf')
        .field('formType', 'bills');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(typeof res.body.error).toBe('string');
    });

    it('does NOT include the raw AI error message in the response', async () => {
      const res = await request(app)
        .post('/api/ai/analyze-document')
        .attach('document', Buffer.from('%PDF-1.4 mock'), 'test.pdf')
        .field('formType', 'bills');

      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain(INTERNAL_AI_ERROR);
      expect(bodyStr).not.toContain('pg_hba');
      expect(bodyStr).not.toContain('DB connection');
      expect(res.body).not.toHaveProperty('details');
    });

    it('returns a user-friendly (non-technical) error message', async () => {
      const res = await request(app)
        .post('/api/ai/analyze-document')
        .attach('document', Buffer.from('%PDF-1.4 mock'), 'test.pdf')
        .field('formType', 'bills');

      expect(res.body.error).toMatch(/failed|unavailable|error|try again/i);
    });
  });

  describe('POST /api/ai/suggest-document-tags', () => {
    const sampleTags = JSON.stringify([
      { id: 'tag-1', name: 'Invoice', description: 'Invoice documents' },
    ]);

    it('returns 200 with empty tagIds when AI fails (graceful degradation)', async () => {
      const res = await request(app)
        .post('/api/ai/suggest-document-tags')
        .attach('document', Buffer.from('%PDF-1.4 mock'), 'test.pdf')
        .field('tags', sampleTags);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(Array.isArray(res.body.tagIds)).toBe(true);
      expect(res.body.tagIds.length).toBe(0);
    });

    it('does NOT include the raw AI error message in the response', async () => {
      const res = await request(app)
        .post('/api/ai/suggest-document-tags')
        .attach('document', Buffer.from('%PDF-1.4 mock'), 'test.pdf')
        .field('tags', sampleTags);

      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain(INTERNAL_AI_ERROR);
      expect(bodyStr).not.toContain('pg_hba');
      expect(bodyStr).not.toContain('DB connection');
    });

    it('returns a user-friendly (non-technical) error message', async () => {
      const res = await request(app)
        .post('/api/ai/suggest-document-tags')
        .attach('document', Buffer.from('%PDF-1.4 mock'), 'test.pdf')
        .field('tags', sampleTags);

      expect(res.body.source).toBe('unavailable');
      expect(res.body.error).toMatch(/unavailable|failed|try again/i);
    });
  });
});
