/**
 * @jest-environment node
 *
 * Filename-encoding regression suite for the two upload routes that were not
 * covered by the original fix (Tasks #891, #897):
 *
 *   1. Bulk-import upload  — POST /api/admin/bulk-import/sessions/:id/items
 *   2. Demand upload       — POST /api/upload  (server/routes.ts)
 *
 * Each describe block mirrors the assertion shape used in the primary-routes
 * normalization suite so CI catches regressions in either set of routes with
 * the same test runner invocation (Task #1470).
 *
 * The tests are intentionally written as pure unit tests against the
 * `fixLatin1MisdecodeFilename` helper and the integration patterns used
 * by each handler, so they run without a live database or network.
 */
import { describe, it, expect } from '@jest/globals';
import path from 'path';
import { fixLatin1MisdecodeFilename } from '../utils/filenameNormalization';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Simulate the Latin-1 mis-decode that multer applies when
 * `defParamCharset` is not set (or the browser sends raw bytes):
 * encode the filename as UTF-8, then re-read those bytes as Latin-1.
 */
function simulateLatin1MisdecodeOf(utf8Name: string): string {
  return Buffer.from(utf8Name, 'utf8').toString('latin1');
}

// ---------------------------------------------------------------------------
// 1. Demand upload route  (POST /api/upload — server/routes.ts)
// ---------------------------------------------------------------------------

describe('Demand upload route (/api/upload) filename encoding (Task #1470)', () => {
  it('corrects a Latin-1 mis-decoded French filename with é (Procès-verbal)', () => {
    const raw = simulateLatin1MisdecodeOf('Procès-verbal été 2024.pdf');
    const corrected = fixLatin1MisdecodeFilename(raw);
    expect(corrected).toBe('Procès-verbal été 2024.pdf');
  });

  it('corrects a filename with multiple diacritics (à ê ç û)', () => {
    const raw = simulateLatin1MisdecodeOf('Résumé assemblée générale.pdf');
    const corrected = fixLatin1MisdecodeFilename(raw);
    expect(corrected).toBe('Résumé assemblée générale.pdf');
  });

  it('leaves a plain ASCII filename unchanged', () => {
    const raw = 'invoice-2024.pdf';
    expect(fixLatin1MisdecodeFilename(raw)).toBe('invoice-2024.pdf');
  });

  it('leaves an already-correct UTF-8 filename unchanged', () => {
    const alreadyCorrect = 'Procès-verbal été 2024.pdf';
    expect(fixLatin1MisdecodeFilename(alreadyCorrect)).toBe(alreadyCorrect);
  });

  it('does not corrupt a genuine Latin-1 byte that is invalid as UTF-8', () => {
    const genuineLatin1 = Buffer.from([0x80]).toString('latin1');
    const input = `demand-attachment${genuineLatin1}.pdf`;
    expect(fixLatin1MisdecodeFilename(input)).toBe(input);
  });

  it('produces the corrected name as the originalName value returned to the client', () => {
    // Reproduce the map() call in the /api/upload handler:
    //   const uploadedFiles = files.map(file => ({
    //     url: `/uploads/demands/${file.filename}`,
    //     originalName: fixLatin1MisdecodeFilename(file.originalname),
    //     size: file.size,
    //   }));
    const fakeFile = {
      filename: 'demand-1714000000000-123456789.pdf',
      originalname: simulateLatin1MisdecodeOf('Procès-verbal été 2024.pdf'),
      size: 12345,
    };

    const result = {
      url: `/uploads/demands/${fakeFile.filename}`,
      originalName: fixLatin1MisdecodeFilename(fakeFile.originalname),
      size: fakeFile.size,
    };

    expect(result.originalName).toBe('Procès-verbal été 2024.pdf');
    expect(result.url).toContain('/uploads/demands/');
  });
});

// ---------------------------------------------------------------------------
// 2. Bulk-import upload handler  (POST /api/admin/bulk-import/sessions/:id/items)
// ---------------------------------------------------------------------------

describe('Bulk-import upload handler filename encoding (Task #1470)', () => {
  it('corrects a Latin-1 mis-decoded French filename with é (Procès-verbal)', () => {
    const raw = simulateLatin1MisdecodeOf('Procès-verbal été 2024.pdf');
    expect(fixLatin1MisdecodeFilename(raw)).toBe('Procès-verbal été 2024.pdf');
  });

  it('corrects a filename with mixed diacritics (é, è, ê, à, ç)', () => {
    const raw = simulateLatin1MisdecodeOf('Déclaration de propriété.pdf');
    expect(fixLatin1MisdecodeFilename(raw)).toBe('Déclaration de propriété.pdf');
  });

  it('leaves a plain ASCII filename unchanged', () => {
    expect(fixLatin1MisdecodeFilename('building-report-2024.pdf')).toBe(
      'building-report-2024.pdf',
    );
  });

  it('leaves an already-correct UTF-8 filename unchanged', () => {
    const alreadyCorrect = 'Résumé été çà ô û ï.txt';
    expect(fixLatin1MisdecodeFilename(alreadyCorrect)).toBe(alreadyCorrect);
  });

  it('does not corrupt a genuine Latin-1 byte that is invalid as UTF-8', () => {
    const genuineLatin1 = Buffer.from([0x80]).toString('latin1');
    const input = `file${genuineLatin1}.pdf`;
    expect(fixLatin1MisdecodeFilename(input)).toBe(input);
  });

  it('uses the corrected name when constructing the staging path (stagedPath)', () => {
    // Reproduce the stagedPath construction introduced by Task #1470:
    //   const correctedName = fixLatin1MisdecodeFilename(file.originalname);
    //   const stagedPath = path.join(dir, `${hash}_${correctedName}`);
    const dir = '/tmp/.staging/bulk-import/session-abc';
    const hash = 'deadbeef1234';
    const rawOriginalname = simulateLatin1MisdecodeOf('Procès-verbal été 2024.pdf');

    const correctedName = fixLatin1MisdecodeFilename(rawOriginalname);
    const stagedPath = path.join(dir, `${hash}_${correctedName}`);

    expect(correctedName).toBe('Procès-verbal été 2024.pdf');
    expect(stagedPath).toBe(
      `/tmp/.staging/bulk-import/session-abc/${hash}_Procès-verbal été 2024.pdf`,
    );
    // The mojibake sequence must not appear in the path
    expect(stagedPath).not.toContain('\u00c3\u00a8'); // è mis-decoded
    expect(stagedPath).not.toContain('\u00c3\u00a9'); // é mis-decoded
  });

  it('uses the corrected name as the originalName stored in the database', () => {
    // Reproduce the DB insert field from the handler:
    //   originalName: correctedName
    const rawOriginalname = simulateLatin1MisdecodeOf('Résumé assemblée 2024.pdf');
    const correctedName = fixLatin1MisdecodeFilename(rawOriginalname);

    const insertRow = {
      originalName: correctedName,
      stagedPath: path.join('/staging', `hash_${correctedName}`),
    };

    expect(insertRow.originalName).toBe('Résumé assemblée 2024.pdf');
    expect(insertRow.stagedPath).toContain('Résumé assemblée 2024.pdf');
  });

  it('applies the same fix to every segment of a relativePath (folder names)', () => {
    // Reproduce the relativePath segment correction introduced earlier:
    //   const fixed = segments.map(fixLatin1MisdecodeFilename).join('/');
    const rawSegments = [
      simulateLatin1MisdecodeOf('Exercices'),
      simulateLatin1MisdecodeOf('2024'),
      simulateLatin1MisdecodeOf('Procès-verbal été 2024.pdf'),
    ];

    const fixedPath = rawSegments.map(fixLatin1MisdecodeFilename).join('/');
    expect(fixedPath).toBe('Exercices/2024/Procès-verbal été 2024.pdf');
  });
});
