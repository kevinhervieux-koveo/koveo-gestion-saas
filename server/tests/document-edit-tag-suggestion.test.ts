/**
 * @jest-environment node
 *
 * @file Edit-time tag suggestion endpoint — Task #543
 * @description Locks in the contract of `POST /api/documents/:id/suggest-tags`,
 *   the endpoint Task #498 added so the document edit dialog can refresh AI
 *   tag suggestions without re-uploading the file. The endpoint shares its
 *   cache key format with the upload-time `/api/ai/suggest-document-tags`
 *   route, and falls back gracefully when AI can't classify the file so the
 *   client can drop back to the keyword scorer.
 *
 *   The four behaviours this suite pins down:
 *     1. Cross-flow cache hit: a freshly-uploaded file already has an entry
 *        in the shared DB cache from the create-time call, so the edit-time
 *        call skips the AI round-trip entirely and reports `cached: true`.
 *     2. ACL: a caller whose `getDocumentWithScope` lookup misses gets a
 *        404 (and the AI/object-storage paths are never touched).
 *     3. Soft-fallback contract — every shape returns HTTP 200 with
 *        `success: false`, `tagIds: []` and a `source` discriminator the
 *        client uses to switch over to the keyword scorer:
 *          - `unsupported_mime` for MIME types Gemini can't classify
 *          - `no_file` when the document row has no stored file
 *          - `unavailable` when the file can't be downloaded from object
 *            storage, and again when the AI service throws.
 *
 *   Mirrors the real-DB integration pattern used by
 *   `server/tests/ai-suggestion-cache.test.ts`: gated on
 *   `_INTEGRATION_DB_URL`, lazy `require` of `server/db` inside `beforeAll`
 *   so the unit-tier setup file's DATABASE_URL override doesn't poison the
 *   module cache.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';

// `aiService.suggestDocumentTags` is the round-trip we want to count and to
// flip between resolve/reject for the "AI unavailable" assertion. Stub the
// whole module so importing the route file doesn't pull in Gemini and so the
// MIME allow-list is deterministic for the unsupported-MIME assertion.
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

// Referenced by the analyze-document route (which sits in the same module
// we register for the create-time call). Stub it so loading the AI route
// module doesn't need real filesystem helpers.
jest.mock('../services/secure-file-storage', () => ({
  secureFileStorage: {
    storeFile: jest.fn().mockResolvedValue({ success: false }),
    retrieveFile: jest.fn().mockResolvedValue({ success: false }),
  },
}));

// The edit-time route streams the file from object storage. Stub the whole
// module so we can hand back a controllable buffer (and force a download
// failure for the "unavailable" assertion) without standing up a real
// object store. `documents.ts` does a dynamic `await import('../objectStorage')`
// inside the handler, so the stub takes effect even though the import is
// lazy.
const objectDownloadMock = jest.fn();
const getObjectEntityFileMock = jest.fn();
jest.mock('../objectStorage', () => ({
  ObjectStorageService: jest.fn().mockImplementation(() => ({
    getObjectEntityFile: getObjectEntityFileMock,
  })),
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
}));

// `documentService` pulls in heavy dependencies (the real ObjectStorageService,
// drizzle relations, etc.). The edit endpoint only needs `normalizePath` for
// the download and `canUserAccessDocument` for `/objects/...` paths — neither
// of which we exercise in detail here, so a minimal stub keeps module load
// fast and side-effect free.
jest.mock('../services/document-service', () => ({
  documentService: {
    normalizePath: jest.fn((p: string) => p),
    canUserAccessDocument: jest.fn().mockResolvedValue({ allowed: true }),
  },
}));

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

describeIfDb('POST /api/documents/:id/suggest-tags - edit-time tag suggestion (Task #543)', () => {
  let express: typeof import('express');
  let supertest: typeof import('supertest');
  let storageMock: any;
  let registerDocumentRoutes: typeof import('../api/documents').registerDocumentRoutes;
  let registerAiAnalysisRoutes: typeof import('../api/ai-document-analysis').registerAiAnalysisRoutes;
  let __clearTagSuggestionCacheForTests: typeof import('../api/ai-document-analysis').__clearTagSuggestionCacheForTests;
  let aiServiceMock: { suggestDocumentTags: jest.Mock; extractBillData: jest.Mock };
  let getDocumentWithScopeMock: jest.Mock;
  let getUserOrganizationsMock: jest.Mock;

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';

    express = require('express');
    supertest = require('supertest');

    // Force the storage import inside `documents.ts` to resolve to the
    // unit-tier mock (which is just a plain object), then hang on to it so
    // each test can swap the two methods the edit-time endpoint calls.
    storageMock = require('../storage').storage;
    getDocumentWithScopeMock = jest.fn();
    getUserOrganizationsMock = jest.fn();
    storageMock.getDocumentWithScope = getDocumentWithScopeMock;
    storageMock.getUserOrganizations = getUserOrganizationsMock;

    aiServiceMock = require('../services/consolidated-ai-service').aiService;

    registerDocumentRoutes = require('../api/documents').registerDocumentRoutes;
    const aiAnalysisModule = require('../api/ai-document-analysis');
    registerAiAnalysisRoutes = aiAnalysisModule.registerAiAnalysisRoutes;
    __clearTagSuggestionCacheForTests = aiAnalysisModule.__clearTagSuggestionCacheForTests;
  });

  beforeEach(async () => {
    if (!REAL_DB_URL) return;
    aiServiceMock.suggestDocumentTags.mockReset();
    objectDownloadMock.mockReset();
    getObjectEntityFileMock.mockReset();
    getDocumentWithScopeMock.mockReset();
    getUserOrganizationsMock.mockReset();
    // Default to a working object-storage path; individual tests override
    // this when they want to exercise download failure.
    getObjectEntityFileMock.mockResolvedValue({ download: objectDownloadMock });
    // Surface cache-clear errors loudly — a silent swallow would mask
    // environment issues and let stale rows leak across cases.
    await __clearTagSuggestionCacheForTests();
  });

  afterAll(async () => {
    if (!REAL_DB_URL) return;
    await __clearTagSuggestionCacheForTests();
  });

  function buildApp(userId = 'user-edit-task543', role = 'admin') {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      req.user = { id: userId, role, email: `${userId}@test.local` };
      next();
    });
    registerDocumentRoutes(app);
    registerAiAnalysisRoutes(app);
    return app;
  }

  describe('cross-flow cache reuse', () => {
    it('returns cached:true on the edit-time call when the create-time upload already populated the cache for the same file', async () => {
      const documentId = `doc-cache-${Date.now()}`;
      // Unique payload per test run so we don't collide with whatever else
      // is sitting in the shared cache table.
      const fileBuffer = Buffer.from(`task543-cache-${Date.now()}-${Math.random()}-payload`);
      const tags = [
        { id: 'tag-insurance', name: 'Insurance', description: 'Insurance docs' },
        { id: 'tag-utilities', name: 'Utilities', description: 'Utility bills' },
      ];

      aiServiceMock.suggestDocumentTags.mockResolvedValue(['tag-insurance']);
      getUserOrganizationsMock.mockResolvedValue([{ organizationId: 'org-task543' }]);
      // The edit handler reads the document row by ID and then re-downloads
      // the same buffer the upload endpoint cached against. Reusing the same
      // buffer + same tag list is what lets the cache key collide.
      getDocumentWithScopeMock.mockResolvedValue({
        id: documentId,
        mimeType: 'application/pdf',
        // A non-`/objects/`-prefixed path skips the canUserAccessDocument
        // re-check; that branch is exercised by the document-acl suite.
        filePath: '/uploads/cached-doc.pdf',
      });
      objectDownloadMock.mockResolvedValue([fileBuffer]);

      const app = buildApp();

      const createRes = await supertest(app)
        .post('/api/ai/suggest-document-tags')
        .field('tags', JSON.stringify(tags))
        .attach('document', fileBuffer, {
          filename: 'cached-doc.pdf',
          contentType: 'application/pdf',
        });

      expect(createRes.status).toBe(200);
      expect(createRes.body).toMatchObject({
        success: true,
        tagIds: ['tag-insurance'],
        source: 'ai',
        cached: false,
      });
      expect(aiServiceMock.suggestDocumentTags).toHaveBeenCalledTimes(1);

      const editRes = await supertest(app)
        .post(`/api/documents/${documentId}/suggest-tags`)
        .send({ tags });

      expect(editRes.status).toBe(200);
      expect(editRes.body).toMatchObject({
        success: true,
        tagIds: ['tag-insurance'],
        source: 'ai',
        cached: true,
      });
      expect(editRes.body.metadata).toMatchObject({
        documentId,
        mimeType: 'application/pdf',
        consideredTags: tags.length,
      });
      // The whole point of sharing the cache key with the upload flow: the
      // edit-time call must NOT trigger a second AI round-trip.
      expect(aiServiceMock.suggestDocumentTags).toHaveBeenCalledTimes(1);
    });
  });

  describe('access control', () => {
    it('returns 404 when the requesting user has no scope on the document', async () => {
      // `getDocumentWithScope` returning null is the storage layer's way of
      // signalling "either the document does not exist or this caller can't
      // see it". The endpoint must collapse both cases into a 404 so the
      // existence of a document isn't leaked to unscoped users.
      getUserOrganizationsMock.mockResolvedValue([]);
      getDocumentWithScopeMock.mockResolvedValue(null);

      const app = buildApp('user-without-access');
      const res = await supertest(app)
        .post('/api/documents/doc-no-access/suggest-tags')
        .send({
          tags: [{ id: 'tag-x', name: 'X', description: null }],
        });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        success: false,
        tagIds: [],
        error: 'Document not found or access denied',
      });
      // The 404 must short-circuit before any AI or object-storage work.
      expect(aiServiceMock.suggestDocumentTags).not.toHaveBeenCalled();
      expect(getObjectEntityFileMock).not.toHaveBeenCalled();
      expect(objectDownloadMock).not.toHaveBeenCalled();
    });
  });

  describe('soft-fallback contract', () => {
    it('returns source: "unsupported_mime" when the document MIME is outside the AI allow-list', async () => {
      // DOCX falls outside TAG_SUGGESTION_SUPPORTED_MIME_TYPES; the route
      // must short-circuit so the client can fall back to the keyword
      // scorer instead of waiting for an AI call that would never happen.
      getUserOrganizationsMock.mockResolvedValue([{ organizationId: 'org-task543' }]);
      getDocumentWithScopeMock.mockResolvedValue({
        id: 'doc-docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        filePath: '/uploads/policy.docx',
      });

      const app = buildApp();
      const res = await supertest(app)
        .post('/api/documents/doc-docx/suggest-tags')
        .send({ tags: [{ id: 't', name: 'T', description: null }] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: false,
        tagIds: [],
        source: 'unsupported_mime',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      expect(aiServiceMock.suggestDocumentTags).not.toHaveBeenCalled();
      expect(getObjectEntityFileMock).not.toHaveBeenCalled();
    });

    it('returns source: "no_file" when the document row has no stored file path', async () => {
      // Documents that exist as metadata-only (e.g. a manually-created row
      // whose upload was wiped) must surface the "no_file" shape so the
      // client knows to skip AI entirely.
      getUserOrganizationsMock.mockResolvedValue([{ organizationId: 'org-task543' }]);
      getDocumentWithScopeMock.mockResolvedValue({
        id: 'doc-empty',
        mimeType: 'application/pdf',
        filePath: null,
      });

      const app = buildApp();
      const res = await supertest(app)
        .post('/api/documents/doc-empty/suggest-tags')
        .send({ tags: [{ id: 't', name: 'T', description: null }] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: false,
        tagIds: [],
        source: 'no_file',
        mimeType: 'application/pdf',
      });
      expect(aiServiceMock.suggestDocumentTags).not.toHaveBeenCalled();
      expect(getObjectEntityFileMock).not.toHaveBeenCalled();
    });

    it('returns success:false / source:"unavailable" when the file cannot be downloaded from object storage', async () => {
      // Object-storage outages must NOT propagate as a 5xx — the dialog
      // already has a keyword fallback path waiting on a soft-fail JSON
      // shape. Status stays 200 so the client treats it as a clean fall-
      // back signal rather than a network/server error.
      getUserOrganizationsMock.mockResolvedValue([{ organizationId: 'org-task543' }]);
      getDocumentWithScopeMock.mockResolvedValue({
        id: 'doc-unreachable',
        mimeType: 'application/pdf',
        filePath: '/uploads/missing.pdf',
      });
      objectDownloadMock.mockRejectedValue(new Error('storage offline'));

      const app = buildApp();
      const res = await supertest(app)
        .post('/api/documents/doc-unreachable/suggest-tags')
        .send({ tags: [{ id: 't', name: 'T', description: null }] });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: false,
        tagIds: [],
        source: 'unavailable',
      });
      // We never got the bytes, so the AI service must not have been
      // invoked.
      expect(aiServiceMock.suggestDocumentTags).not.toHaveBeenCalled();
    });

    it('returns success:false / source:"unavailable" when the AI service throws after the file was fetched', async () => {
      // Same soft-fallback shape, but this time the failure happens
      // downstream of the buffer download. The fact that both failures
      // collapse to the same response shape is what lets the client share
      // a single fallback branch.
      const fileBuffer = Buffer.from(`task543-ai-throws-${Date.now()}-${Math.random()}`);
      getUserOrganizationsMock.mockResolvedValue([{ organizationId: 'org-task543' }]);
      getDocumentWithScopeMock.mockResolvedValue({
        id: 'doc-ai-throws',
        mimeType: 'application/pdf',
        filePath: '/uploads/present-but-ai-down.pdf',
      });
      objectDownloadMock.mockResolvedValue([fileBuffer]);
      aiServiceMock.suggestDocumentTags.mockRejectedValue(
        new Error('Gemini unavailable')
      );

      const app = buildApp();
      const res = await supertest(app)
        .post('/api/documents/doc-ai-throws/suggest-tags')
        .send({ tags: [{ id: 't', name: 'T', description: null }] });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: false,
        tagIds: [],
        source: 'unavailable',
      });
      // The AI service WAS reached this time — that's the whole point of
      // this branch — but the failure is swallowed into the soft-fallback
      // shape rather than bubbled up as a 5xx.
      expect(aiServiceMock.suggestDocumentTags).toHaveBeenCalledTimes(1);
    });
  });
});
