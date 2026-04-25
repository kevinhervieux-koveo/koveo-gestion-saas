// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * @jest-environment node
 *
 * Task #842 — ZIP upload blocking in the bulk-import upload handler.
 *
 * The `isZipFile()` helper exported from `server/api/bulk-import.ts`
 * is the single source of truth for the multer `fileFilter`. This
 * suite exercises it directly so the tests are free of HTTP/multer
 * infrastructure and run cleanly in any Jest environment.
 *
 * Coverage:
 *   - ZIP MIME types that must be rejected
 *   - .zip filename extension (regardless of MIME)
 *   - Non-zip files that must be allowed through
 */

import { describe, it, expect, jest } from '@jest/globals';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

jest.mock('../../../server/db', () => ({ db: {} }));
jest.mock('../../../server/auth', () => ({
  requireAuth: jest.fn(),
  requireRole: jest.fn(),
}));
jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: jest.fn(),
}));
jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}));

import { isZipFile } from '../../../server/api/bulk-import';

function fakeFile(mimetype: string, originalname: string) {
  return { mimetype, originalname };
}

describe('Task #842 — isZipFile() filter logic', () => {
  describe('ZIP MIME types are detected as zip', () => {
    it('application/zip', () => {
      expect(isZipFile(fakeFile('application/zip', 'archive.zip'))).toBe(true);
    });

    it('application/x-zip-compressed', () => {
      expect(isZipFile(fakeFile('application/x-zip-compressed', 'backup.zip'))).toBe(true);
    });

    it('application/x-zip', () => {
      expect(isZipFile(fakeFile('application/x-zip', 'docs.zip'))).toBe(true);
    });

    it('multipart/x-zip', () => {
      expect(isZipFile(fakeFile('multipart/x-zip', 'multi.zip'))).toBe(true);
    });

    it('MIME type matching is case-insensitive', () => {
      expect(isZipFile(fakeFile('Application/ZIP', 'archive.zip'))).toBe(true);
    });
  });

  describe('.zip filename extension is detected regardless of MIME', () => {
    it('octet-stream MIME with .zip extension', () => {
      expect(isZipFile(fakeFile('application/octet-stream', 'documents.zip'))).toBe(true);
    });

    it('unknown MIME with .zip extension', () => {
      expect(isZipFile(fakeFile('application/unknown', 'bundle.zip'))).toBe(true);
    });

    it('extension matching is case-insensitive', () => {
      expect(isZipFile(fakeFile('application/octet-stream', 'archive.ZIP'))).toBe(true);
    });

    it('extension matching is case-insensitive (mixed case)', () => {
      expect(isZipFile(fakeFile('application/octet-stream', 'archive.Zip'))).toBe(true);
    });
  });

  describe('Non-zip files are allowed through', () => {
    it('PDF files are not rejected', () => {
      expect(isZipFile(fakeFile('application/pdf', 'lease.pdf'))).toBe(false);
    });

    it('DOCX files are not rejected', () => {
      expect(
        isZipFile(
          fakeFile(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'contract.docx',
          ),
        ),
      ).toBe(false);
    });

    it('XLSX files are not rejected', () => {
      expect(
        isZipFile(
          fakeFile(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'report.xlsx',
          ),
        ),
      ).toBe(false);
    });

    it('image/jpeg files are not rejected', () => {
      expect(isZipFile(fakeFile('image/jpeg', 'photo.jpg'))).toBe(false);
    });

    it('a filename ending in ".zipcode" is not rejected', () => {
      expect(isZipFile(fakeFile('text/plain', 'zipcode.txt'))).toBe(false);
    });
  });
});
