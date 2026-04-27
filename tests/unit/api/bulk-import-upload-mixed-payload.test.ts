// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * @jest-environment node
 *
 * Task #842 — Request-level validation that mixed zip+pdf uploads
 * only stage the PDF.
 *
 * The multer fileFilter in `server/api/bulk-import.ts` silently drops
 * zip files before they reach `req.files`. When a client sends one
 * zip AND one PDF together, the zip must be dropped and the PDF must
 * be processed. This test exercises that behaviour end-to-end at the
 * HTTP layer — verifying that the route does NOT return
 * 400 "No files uploaded" (which would indicate both files were
 * dropped) and that the staged item list contains only the PDF.
 *
 * Task #1061 — the upload route now uses `multer.diskStorage()` so
 * uploads stream straight to the per-session staging directory and
 * the route hashes them off disk. This test lets multer write to a
 * real (per-test) staging directory under the repo's `.staging` root
 * and cleans it up in `afterAll`.
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import * as nodeFs from 'fs';
import * as nodePath from 'path';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

// Inline thenable chain so the factory captures it without hoisting issues.
jest.mock('../../../server/db', () => {
  const FAKE_SESSION = {
    id: 'sess-mixed-test',
    organizationId: 'org-1',
    buildingId: 'bld-1',
    currentStep: 'upload',
    status: 'active',
  };
  const FAKE_ITEM = {
    id: 'item-pdf-1',
    sessionId: 'sess-mixed-test',
    originalName: 'lease.pdf',
    status: 'pending',
    mimeType: 'application/pdf',
    fileSize: 14,
    contentHash: 'deadbeef',
  };
  function chain(resolveWith) {
    return {
      then(res, rej) { return Promise.resolve(resolveWith).then(res, rej); },
      select() { return chain(resolveWith); },
      from()   { return chain(resolveWith); },
      where()  { return chain(resolveWith); },
      limit()  { return Promise.resolve([]); },
      insert() { return chain(resolveWith); },
      values() { return chain(resolveWith); },
      returning() { return Promise.resolve([FAKE_ITEM]); },
    };
  }
  return { db: chain([FAKE_SESSION]) };
});

jest.mock('../../../server/auth', () => ({
  requireAuth: (_req, _res, next) => {
    _req.user = { id: 'admin-1', role: 'admin', organizationId: 'org-1' };
    next();
  },
  requireRole: (_roles) => (_req, _res, next) => next(),
}));

jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

// NOTE: We intentionally do NOT mock `fs` here. With multer's disk
// storage (Task #1061) the route streams uploaded files to disk via
// `fs.createWriteStream()`, then re-hashes them via `fs.createReadStream()`,
// then renames them. Mocking those out would be more complex than just
// letting the test write to a real per-test staging directory under the
// repo's `.staging/bulk-import/<sessionId>/` path, which is what
// production uses anyway. We clean the per-test directory up in
// `afterAll`.

const PDF_BODY = Buffer.from('%PDF-1.4\n%%EOF', 'utf8');
const ZIP_BODY = Buffer.from('PK\x03\x04 fake zip content', 'utf8');

const TEST_STAGING_DIR = nodePath.join(
  process.cwd(),
  '.staging',
  'bulk-import',
  'sess-mixed-test',
);

describe('Task #842 — mixed zip+pdf upload (request-level)', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.resetModules();
    app = express();
    app.use(express.json());
    const { registerBulkImportRoutes } = require('../../../server/api/bulk-import');
    registerBulkImportRoutes(app);
  });

  afterAll(() => {
    try {
      nodeFs.rmSync(TEST_STAGING_DIR, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  });

  it('does NOT return 400 when a zip and a PDF are uploaded together', async () => {
    const res = await request(app)
      .post('/api/admin/bulk-import/sessions/sess-mixed-test/items')
      .attach('files', PDF_BODY, { filename: 'lease.pdf',   contentType: 'application/pdf' })
      .attach('files', ZIP_BODY, { filename: 'archive.zip', contentType: 'application/zip' });

    expect(res.status).not.toBe(400);
  });

  it('staged items contain only the PDF, not the zip', async () => {
    const res = await request(app)
      .post('/api/admin/bulk-import/sessions/sess-mixed-test/items')
      .attach('files', PDF_BODY, { filename: 'lease.pdf',   contentType: 'application/pdf' })
      .attach('files', ZIP_BODY, { filename: 'archive.zip', contentType: 'application/zip' });

    expect(res.status).toBe(201);
    const items: { originalName?: string }[] = res.body.items;
    expect(Array.isArray(items)).toBe(true);
    const hasZip = items.some(i => (i.originalName ?? '').toLowerCase().endsWith('.zip'));
    expect(hasZip).toBe(false);
  });

  it('returns 400 when only a zip is uploaded (both filter branches tested)', async () => {
    const res = await request(app)
      .post('/api/admin/bulk-import/sessions/sess-mixed-test/items')
      .attach('files', ZIP_BODY, { filename: 'archive.zip', contentType: 'application/zip' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'No files uploaded' });
  });
});
