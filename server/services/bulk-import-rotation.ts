// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * Staged-file rotation helper for the bulk-import pipeline (Task #767).
 *
 * After Screening returns a `rotationDegrees` value of 90, 180, or 270,
 * this module rewrites the staged file in place so every later analyzer
 * call (Branching, Identification, etc.) reads the document in its
 * upright orientation.
 *
 * Supported formats:
 *   - PDFs  → rotated page-by-page via `pdf-lib`
 *   - Images (png/jpeg/webp) → rotated via `sharp`
 *
 * Unsupported formats (docx/xlsx/csv/txt/etc.) are skipped silently —
 * rotation only makes sense for visual formats.
 *
 * Failures are also silent: the original file is left untouched and the
 * caller logs the error. The `rotationDegrees` value recorded by
 * Screening is still surfaced in the UI so admins know the AI thought
 * the file was sideways even when automatic rotation could not be applied.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { logError, logInfo } from '../utils/logger';

const PDF_MIME = 'application/pdf';
const SUPPORTED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

/**
 * Rotate a staged PDF or image file in place by the given number of
 * clockwise degrees.  Returns the new SHA-256 content hash of the
 * rewritten file, or `null` when rotation was skipped or failed.
 *
 * The hash is computed over the raw bytes *after* rotation, matching the
 * same algorithm used in `loadFileForClaude` (mime + separator + bytes)
 * so the analyzer cache keys reflect the rotated content and don't
 * collide with the pre-rotation version.
 */
export async function rotateAndRewriteStagedFile(opts: {
  stagedPath: string;
  mimeType: string | null | undefined;
  rotationDegrees: 0 | 90 | 180 | 270;
}): Promise<string | null> {
  const { stagedPath, mimeType, rotationDegrees } = opts;

  if (rotationDegrees === 0) return null;

  const mime = (mimeType ?? '').toLowerCase();

  if (mime === PDF_MIME) {
    return rotatePdf(stagedPath, rotationDegrees);
  }
  if (SUPPORTED_IMAGE_MIMES.has(mime)) {
    return rotateImage(stagedPath, mime, rotationDegrees);
  }

  logInfo('[bulk-import-rotation] skipping rotation for unsupported MIME', {
    metadata: { mime, rotationDegrees },
  });
  return null;
}

async function rotatePdf(
  stagedPath: string,
  rotationDegrees: 90 | 180 | 270,
): Promise<string | null> {
  try {
    const { PDFDocument, degrees } = await import('pdf-lib');
    const original = fs.readFileSync(stagedPath);
    const pdfDoc = await PDFDocument.load(new Uint8Array(original), { ignoreEncryption: true });
    for (const page of pdfDoc.getPages()) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + rotationDegrees) % 360));
    }
    const rotated = await pdfDoc.save();
    const buf = Buffer.from(rotated);
    fs.writeFileSync(stagedPath, buf);
    const newHash = computeContentHash(PDF_MIME, buf);
    logInfo('[bulk-import-rotation] PDF rotated', {
      metadata: { stagedPath, rotationDegrees, newBytes: buf.length },
    });
    return newHash;
  } catch (err) {
    logError('[bulk-import-rotation] PDF rotation failed', err as Error);
    return null;
  }
}

async function rotateImage(
  stagedPath: string,
  mime: string,
  rotationDegrees: 90 | 180 | 270,
): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default;
    const original = fs.readFileSync(stagedPath);
    const rotated = await sharp(original)
      .rotate(rotationDegrees)
      .toBuffer();
    fs.writeFileSync(stagedPath, rotated);
    const newHash = computeContentHash(mime, rotated);
    logInfo('[bulk-import-rotation] image rotated', {
      metadata: { stagedPath, rotationDegrees, newBytes: rotated.length },
    });
    return newHash;
  } catch (err) {
    logError('[bulk-import-rotation] image rotation failed', err as Error);
    return null;
  }
}

/** Matches the hashing scheme in `loadFileForClaude` in bulk-import-analyzer.ts. */
function computeContentHash(mime: string, buf: Buffer): string {
  return crypto
    .createHash('sha256')
    .update(mime)
    .update('\x1f')
    .update(buf)
    .digest('hex');
}