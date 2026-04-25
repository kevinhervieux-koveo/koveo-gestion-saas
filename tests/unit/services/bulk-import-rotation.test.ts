/**
 * Unit tests for the bulk-import staged-file rotation helper (Task #767).
 *
 * Verifies that:
 *   - PDF pages are rotated via pdf-lib and a new content hash is returned.
 *   - Image files are rotated via sharp and a new content hash is returned.
 *   - Unsupported MIME types are skipped silently (returns null).
 *   - rotationDegrees = 0 is a no-op (returns null immediately).
 *   - Rotation failures (corrupt PDF / sharp error) are silent (returns null,
 *     leaves the original file unchanged).
 *
 * Note: we don't try to assert the actual pixel / page orientation here because
 * that would require a genuine image-rendering comparison.  Instead we assert
 * that the helper:
 *   a) returns a non-null hash that differs from the original content hash, and
 *   b) rewrites the file on disk (different byte sequence from the original).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

import { rotateAndRewriteStagedFile } from '../../../server/services/bulk-import-rotation';

function sha256hex(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Same hashing scheme as computeContentHash() inside bulk-import-rotation.ts */
function contentHash(mime: string, buf: Buffer): string {
  return crypto.createHash('sha256').update(mime).update('\x1f').update(buf).digest('hex');
}

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bulk-import-rotation-test-'));
});
afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('rotateAndRewriteStagedFile()', () => {
  it('returns null immediately for rotationDegrees = 0 (no-op)', async () => {
    const p = path.join(tmpDir, 'zero.pdf');
    fs.writeFileSync(p, Buffer.from('%PDF-1.4 zero rotation'));
    const hash = await rotateAndRewriteStagedFile({
      stagedPath: p,
      mimeType: 'application/pdf',
      rotationDegrees: 0,
    });
    expect(hash).toBeNull();
  });

  it('returns null for unsupported MIME (docx) and leaves file unchanged', async () => {
    const p = path.join(tmpDir, 'doc.docx');
    const originalBytes = Buffer.from('PK\x03\x04 fake docx');
    fs.writeFileSync(p, originalBytes);
    const hash = await rotateAndRewriteStagedFile({
      stagedPath: p,
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      rotationDegrees: 90,
    });
    expect(hash).toBeNull();
    expect(fs.readFileSync(p)).toEqual(originalBytes);
  });

  it('rotates a real minimal PDF and returns a different content hash', async () => {
    const { PDFDocument, degrees } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([595, 842]);
    const originalBytes = Buffer.from(await pdfDoc.save());

    const p = path.join(tmpDir, 'rotate-pdf.pdf');
    fs.writeFileSync(p, originalBytes);
    const originalHash = sha256hex(originalBytes);

    const newHash = await rotateAndRewriteStagedFile({
      stagedPath: p,
      mimeType: 'application/pdf',
      rotationDegrees: 90,
    });

    expect(newHash).not.toBeNull();
    expect(newHash).not.toBe(originalHash);

    const rotatedBytes = fs.readFileSync(p);
    expect(contentHash('application/pdf', rotatedBytes)).toBe(newHash!);

    // Verify the page now has 90-degree rotation recorded
    const rotatedDoc = await PDFDocument.load(new Uint8Array(rotatedBytes));
    const page = rotatedDoc.getPages()[0];
    expect(page.getRotation().angle).toBe(90);
  });

  it('rotates a PNG image via sharp and returns a different content hash', async () => {
    const sharp = (await import('sharp')).default;
    // Create a minimal valid 4×2 white PNG
    const originalBuffer = await sharp({
      create: { width: 4, height: 2, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .png()
      .toBuffer();

    const p = path.join(tmpDir, 'rotate-image.png');
    fs.writeFileSync(p, originalBuffer);
    const originalHash = sha256hex(originalBuffer);

    const newHash = await rotateAndRewriteStagedFile({
      stagedPath: p,
      mimeType: 'image/png',
      rotationDegrees: 90,
    });

    expect(newHash).not.toBeNull();
    expect(newHash).not.toBe(originalHash);

    const rotatedBytes = fs.readFileSync(p);
    expect(contentHash('image/png', rotatedBytes)).toBe(newHash!);

    // After 90° rotation a 4×2 image becomes 2×4
    const meta = await sharp(rotatedBytes).metadata();
    expect(meta.width).toBe(2);
    expect(meta.height).toBe(4);
  });

  it('returns null silently when given a corrupt/non-PDF for PDF MIME', async () => {
    const p = path.join(tmpDir, 'corrupt.pdf');
    const corruptBytes = Buffer.from('this is not a pdf at all');
    fs.writeFileSync(p, corruptBytes);

    const hash = await rotateAndRewriteStagedFile({
      stagedPath: p,
      mimeType: 'application/pdf',
      rotationDegrees: 180,
    });

    expect(hash).toBeNull();
    // Original file should remain unchanged on failure
    expect(fs.readFileSync(p)).toEqual(corruptBytes);
  });

  it('rotates a JPEG image (180°) and returns a new hash', async () => {
    const sharp = (await import('sharp')).default;
    const originalBuffer = await sharp({
      create: { width: 8, height: 4, channels: 3, background: { r: 128, g: 64, b: 32 } },
    })
      .jpeg()
      .toBuffer();

    const p = path.join(tmpDir, 'rotate-jpeg.jpg');
    fs.writeFileSync(p, originalBuffer);
    const originalHash = sha256hex(originalBuffer);

    const newHash = await rotateAndRewriteStagedFile({
      stagedPath: p,
      mimeType: 'image/jpeg',
      rotationDegrees: 180,
    });

    expect(newHash).not.toBeNull();
    expect(newHash).not.toBe(originalHash);
  });
});
