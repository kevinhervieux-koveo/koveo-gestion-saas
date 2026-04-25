// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * @jest-environment node
 *
 * @file Document text endpoint — Task #598
 * @description Locks down the contract of `GET /api/documents/:id/text`,
 *   the cheap server-side text-extraction route the document edit dialog
 *   uses to refresh keyword tag suggestions for legacy documents.
 *
 *   Behaviours pinned down here:
 *     1. Happy paths: text/plain, text/csv, .docx, .xlsx all return
 *        `text` extracted by the real `documentTextExtractor` plus
 *        `hasText: true` and the document's mimeType.
 *     2. Unsupported types (PDFs, images) short-circuit with
 *        `{ text: '', hasText: false, reason: 'unsupported_mime' }` and
 *        never touch object storage.
 *     3. Access control:
 *          - A user whose `getDocumentWithScope` lookup misses gets a
 *            404 (existence is not leaked).
 *          - For ACL-protected files (paths under `/objects/...`), a
 *            denied object-level ACL check returns 403 — guarding against
 *            path-rebinding attacks where the caller has access to the
 *            row but not to the underlying object.
 *     4. Extraction failures (storage outage / corrupt object) collapse
 *        to a clean soft-fallback shape (`reason: 'extraction_failed'`)
 *        without leaking the underlying error message to the client.
 *
 *   The test mocks only what's strictly needed:
 *     - `../objectStorage` so we can hand the route a controllable buffer
 *       (or force a download failure) without standing up a real bucket.
 *     - `../services/document-service` so ACL behaviour for `/objects/...`
 *       paths can be flipped per test.
 *   The real `document-text-extractor` is exercised against real Office
 *   fixtures, which is the whole point: regressions in mammoth/exceljs
 *   wiring or in the route's response shape must surface here.
 */

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import path from 'path';
import fs from 'fs';

// Object storage is reached via `await import('../objectStorage')` inside
// the handler, so this module-level mock takes effect even though the
// import is lazy. `objectDownloadMock` lets each test return its own
// buffer (or throw to simulate a storage failure).
const objectDownloadMock = jest.fn();
const getObjectEntityFileMock = jest.fn();
jest.mock('../objectStorage', () => ({
  __esModule: true,
  ObjectStorageService: jest.fn().mockImplementation(() => ({
    getObjectEntityFile: getObjectEntityFileMock,
  })),
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
}));

// Stub document-service so we don't need to construct a real one (which
// would pull in object storage + ACL evaluator wiring). Only two methods
// are touched: `normalizePath` (passthrough) and `canUserAccessDocument`
// (toggled per test for the path-rebinding assertion).
const canUserAccessDocumentMock = jest.fn();
jest.mock('../services/document-service', () => ({
  __esModule: true,
  documentService: {
    normalizePath: (p: string) => p,
    canUserAccessDocument: (...args: any[]) =>
      canUserAccessDocumentMock(...args),
  },
}));

// `secure-file-storage` is imported transitively by other route files
// loaded along the way; stub it so module load doesn't try to spin up
// the real disk-backed helper.
jest.mock('../services/secure-file-storage', () => ({
  __esModule: true,
  secureFileStorage: {
    storeFile: jest.fn(),
    retrieveFile: jest.fn(),
  },
}));

import express from 'express';
import request from 'supertest';
import { storage } from '../storage';
import { registerDocumentRoutes } from '../api/documents';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const DOCX_FIXTURE = path.join(FIXTURES_DIR, 'sample-minutes.docx');
const XLSX_FIXTURE = path.join(FIXTURES_DIR, 'sample-budget.xlsx');

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function buildApp(userId = 'user-text-endpoint', role = 'admin') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = { id: userId, role, email: `${userId}@test.local` };
    next();
  });
  registerDocumentRoutes(app);
  return app;
}

const storageAny = storage as any;

describe('GET /api/documents/:id/text - text extraction endpoint (Task #598)', () => {
  beforeAll(() => {
    // Sanity-check the Office fixtures exist on disk so a deleted file
    // produces a useful failure rather than a misleading "extracted text
    // is empty" assertion.
    expect(fs.existsSync(DOCX_FIXTURE)).toBe(true);
    expect(fs.existsSync(XLSX_FIXTURE)).toBe(true);
  });

  beforeEach(() => {
    objectDownloadMock.mockReset();
    getObjectEntityFileMock.mockReset();
    canUserAccessDocumentMock.mockReset();
    // Default to a working object-storage path; happy-path tests just
    // override the buffer their `objectDownloadMock` resolves with.
    getObjectEntityFileMock.mockResolvedValue({ download: objectDownloadMock });
    canUserAccessDocumentMock.mockResolvedValue({ allowed: true });

    // Storage is the unit-tier mock (a plain object); install only the
    // two methods this endpoint touches.
    storageAny.getDocumentWithScope = jest.fn();
    storageAny.getUserOrganizations = jest.fn().mockResolvedValue([
      { organizationId: 'org-text-endpoint' },
    ]);
  });

  describe('happy paths — extracted text per supported MIME type', () => {
    it('returns plain-text contents verbatim for text/plain', async () => {
      const body = 'Hello world\nThis is a plain text document.';
      storageAny.getDocumentWithScope.mockResolvedValue({
        id: 'doc-txt',
        mimeType: 'text/plain',
        // Non-`/objects/` filePath so the ACL re-check is intentionally
        // skipped; that branch is exercised in its own block below.
        filePath: '/uploads/notes.txt',
      });
      objectDownloadMock.mockResolvedValue([Buffer.from(body, 'utf8')]);

      const res = await request(buildApp()).get('/api/documents/doc-txt/text');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        text: body,
        hasText: true,
        mimeType: 'text/plain',
      });
      // ACL re-check must be skipped for non-/objects/ paths.
      expect(canUserAccessDocumentMock).not.toHaveBeenCalled();
    });

    it('returns CSV contents verbatim for text/csv', async () => {
      const csv = 'name,amount\nElevator,1500\nInsurance,4800';
      storageAny.getDocumentWithScope.mockResolvedValue({
        id: 'doc-csv',
        mimeType: 'text/csv',
        filePath: '/uploads/budget.csv',
      });
      objectDownloadMock.mockResolvedValue([Buffer.from(csv, 'utf8')]);

      const res = await request(buildApp()).get('/api/documents/doc-csv/text');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        text: csv,
        hasText: true,
        mimeType: 'text/csv',
      });
    });

    it('extracts text from a real .docx via the real mammoth pipeline', async () => {
      const buffer = fs.readFileSync(DOCX_FIXTURE);
      storageAny.getDocumentWithScope.mockResolvedValue({
        id: 'doc-docx',
        mimeType: DOCX_MIME,
        filePath: '/uploads/minutes.docx',
      });
      objectDownloadMock.mockResolvedValue([buffer]);

      const res = await request(buildApp()).get('/api/documents/doc-docx/text');

      expect(res.status).toBe(200);
      expect(res.body.mimeType).toBe(DOCX_MIME);
      expect(res.body.hasText).toBe(true);
      // Substrings from the real fixture content; if mammoth or the
      // extractor regress we'll see it here rather than in a downstream
      // tag-suggestion test.
      expect(res.body.text).toContain('Annual Board Meeting Minutes');
      expect(res.body.text).toContain('insurance renewal');
    });

    it('extracts CSV-style text from a real .xlsx via the real exceljs pipeline', async () => {
      const buffer = fs.readFileSync(XLSX_FIXTURE);
      storageAny.getDocumentWithScope.mockResolvedValue({
        id: 'doc-xlsx',
        mimeType: XLSX_MIME,
        filePath: '/uploads/budget.xlsx',
      });
      objectDownloadMock.mockResolvedValue([buffer]);

      const res = await request(buildApp()).get('/api/documents/doc-xlsx/text');

      expect(res.status).toBe(200);
      expect(res.body.mimeType).toBe(XLSX_MIME);
      expect(res.body.hasText).toBe(true);
      // Sheet header + a couple of rows the extractor must surface as
      // CSV text.
      expect(res.body.text).toContain('# Budget');
      expect(res.body.text).toContain('Elevator Maintenance,1500');
      expect(res.body.text).toContain('Annual Insurance Premium,4800');
    });
  });

  describe('unsupported MIME types — short-circuit without storage I/O', () => {
    it.each([
      ['pdf', 'application/pdf', '/uploads/sample.pdf'],
      ['jpeg', 'image/jpeg', '/uploads/sample.jpg'],
      ['png', 'image/png', '/uploads/sample.png'],
    ])(
      'returns the unsupported_mime soft-fallback shape for %s',
      async (slug, mimeType, filePath) => {
        storageAny.getDocumentWithScope.mockResolvedValue({
          id: `doc-${slug}`,
          mimeType,
          filePath,
        });

        const res = await request(buildApp()).get(
          `/api/documents/doc-${slug}/text`
        );

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          text: '',
          hasText: false,
          mimeType,
          reason: 'unsupported_mime',
        });
        // No object-storage I/O should be attempted for unsupported
        // types — that's the whole point of the cheap path.
        expect(getObjectEntityFileMock).not.toHaveBeenCalled();
        expect(objectDownloadMock).not.toHaveBeenCalled();
      }
    );

    it('returns the unsupported_mime shape for documents that have no stored file', async () => {
      // A row that exists in the documents table with no underlying
      // object — the route must still respond cleanly so the client can
      // fall back to filename-only suggestions.
      storageAny.getDocumentWithScope.mockResolvedValue({
        id: 'doc-no-file',
        mimeType: 'text/plain',
        filePath: null,
      });

      const res = await request(buildApp()).get('/api/documents/doc-no-file/text');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        text: '',
        hasText: false,
        mimeType: 'text/plain',
        reason: 'no_file',
      });
      expect(getObjectEntityFileMock).not.toHaveBeenCalled();
    });
  });

  describe('access control', () => {
    it('returns 404 when the requesting user has no scope on the document', async () => {
      // `getDocumentWithScope` returning null is the storage layer's way
      // of saying "either the document does not exist or this caller
      // can't see it". The endpoint must collapse both into a 404 so
      // existence isn't leaked to unscoped users.
      storageAny.getUserOrganizations.mockResolvedValue([]);
      storageAny.getDocumentWithScope.mockResolvedValue(null);

      const res = await request(buildApp('user-without-access')).get(
        '/api/documents/doc-no-access/text'
      );

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Document not found or access denied' });
      // The 404 must short-circuit before any object-storage / extractor
      // work happens.
      expect(getObjectEntityFileMock).not.toHaveBeenCalled();
      expect(objectDownloadMock).not.toHaveBeenCalled();
      expect(canUserAccessDocumentMock).not.toHaveBeenCalled();
    });

    it('returns 403 when an /objects/... file fails the object-level ACL re-check (path-rebinding guard)', async () => {
      // The caller can read the documents row (so the scope-based check
      // passes) but the underlying object lives behind an object-level
      // ACL they don't satisfy. Mirroring `/api/documents/:id/file`,
      // the text endpoint must reject path-rebinding attempts where
      // someone swaps in a privileged file path on a row they own.
      storageAny.getDocumentWithScope.mockResolvedValue({
        id: 'doc-acl-protected',
        mimeType: 'text/plain',
        filePath: '/objects/buildings/secret/documents/secret.txt',
      });
      canUserAccessDocumentMock.mockResolvedValue({ allowed: false });

      const res = await request(buildApp('user-without-acl')).get(
        '/api/documents/doc-acl-protected/text'
      );

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: 'Access denied to file' });
      // ACL must be consulted with the caller's identity + the requested
      // path before any storage I/O happens.
      expect(canUserAccessDocumentMock).toHaveBeenCalledWith(
        'user-without-acl',
        'admin',
        '/objects/buildings/secret/documents/secret.txt'
      );
      expect(objectDownloadMock).not.toHaveBeenCalled();
    });

    it('proceeds with extraction when the /objects/... ACL check allows the caller', async () => {
      // Companion to the 403 case above: when the ACL says yes, the
      // route must continue into the normal download + extract path.
      const body = 'allowed body content';
      storageAny.getDocumentWithScope.mockResolvedValue({
        id: 'doc-acl-allowed',
        mimeType: 'text/plain',
        filePath: '/objects/buildings/permitted/documents/notes.txt',
      });
      canUserAccessDocumentMock.mockResolvedValue({ allowed: true });
      objectDownloadMock.mockResolvedValue([Buffer.from(body, 'utf8')]);

      const res = await request(buildApp('user-with-acl')).get(
        '/api/documents/doc-acl-allowed/text'
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        text: body,
        hasText: true,
        mimeType: 'text/plain',
      });
      expect(canUserAccessDocumentMock).toHaveBeenCalledTimes(1);
      expect(objectDownloadMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('extraction failures — clean soft-fallback without leaking internals', () => {
    it('collapses object-storage download failures into reason: "extraction_failed"', async () => {
      // The whole point of the soft-fallback shape: an outage at the
      // object-storage layer must not bubble up as a 5xx and must not
      // leak the storage error message back to the client.
      const internalError = new Error(
        'storage offline: secret-internal-bucket-info'
      );
      storageAny.getDocumentWithScope.mockResolvedValue({
        id: 'doc-storage-down',
        mimeType: DOCX_MIME,
        filePath: '/uploads/missing.docx',
      });
      objectDownloadMock.mockRejectedValue(internalError);

      const res = await request(buildApp()).get(
        '/api/documents/doc-storage-down/text'
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        text: '',
        hasText: false,
        mimeType: DOCX_MIME,
        reason: 'extraction_failed',
      });
      // Internal error details must not surface to the client.
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain('secret-internal-bucket-info');
      expect(serialized).not.toContain('storage offline');
    });

    it('returns an empty string (no reason) when the underlying file is corrupt', async () => {
      // The extractor swallows mammoth/exceljs parse errors and returns
      // ''. The route still considers that a successful extraction with
      // no text content — so the response is the regular shape with
      // `hasText: false` and NO `reason` field, mirroring the
      // contract the edit dialog expects when text is unavailable but
      // nothing went wrong on our side.
      storageAny.getDocumentWithScope.mockResolvedValue({
        id: 'doc-corrupt',
        mimeType: DOCX_MIME,
        filePath: '/uploads/corrupt.docx',
      });
      // Anything that obviously isn't a valid DOCX zip — mammoth will
      // throw internally and the extractor will return '' silently.
      objectDownloadMock.mockResolvedValue([
        Buffer.from('this is definitely not a valid docx', 'utf8'),
      ]);

      const res = await request(buildApp()).get(
        '/api/documents/doc-corrupt/text'
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        text: '',
        hasText: false,
        mimeType: DOCX_MIME,
      });
      // Confirm the route went through the extraction path rather than
      // bailing early via `unsupported_mime` / `no_file`.
      expect(objectDownloadMock).toHaveBeenCalledTimes(1);
    });
  });
});