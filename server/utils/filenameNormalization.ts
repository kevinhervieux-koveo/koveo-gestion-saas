import { v4 as uuidv4 } from 'uuid';

/**
 * Detect and fix a Latin-1 mis-decoded filename.
 *
 * Modern browsers send multipart filenames as UTF-8, but some middleware
 * (including older multer defaults) decodes the bytes as Latin-1. The result
 * is mojibake: `é` (UTF-8: 0xC3 0xA9) becomes the two-character sequence `Ã©`.
 *
 * This helper re-interprets the string's bytes as UTF-8. If the result is
 * valid UTF-8 (no replacement character U+FFFD) and differs from the input,
 * the corrected value is returned. ASCII-only names and already-correct UTF-8
 * names are returned unchanged.
 *
 * @example
 * fixLatin1MisdecodeFilename('Budget prÃ©visionnel 2023-2024.pdf')
 * // => 'Budget prévisionnel 2023-2024.pdf'
 *
 * fixLatin1MisdecodeFilename('report.pdf')
 * // => 'report.pdf'  (unchanged)
 */
export function fixLatin1MisdecodeFilename(filename: string): string {
  const reinterpreted = Buffer.from(filename, 'latin1').toString('utf8');
  if (reinterpreted !== filename && !reinterpreted.includes('\uFFFD')) {
    return reinterpreted;
  }
  return filename;
}

/**
 * Normalize an uploaded filename so it is safe to use as both a database
 * `fileName` value and as part of an Object Storage / filesystem path.
 *
 * This is the SINGLE canonical normalizer used by every upload site:
 *   - server/api/documents.ts
 *   - server/api/bills.ts
 *   - server/api/maintenance.ts
 *   - server/services/document-service.ts (buildHierarchicalPath)
 *
 * Behaviour:
 *   - Strips Unicode diacritics via NFD decomposition (handles French
 *     accents and any other combining marks).
 *   - Lowercases the result for consistency.
 *   - Replaces every character outside `[a-z0-9._-]` with `_`.
 *   - Collapses runs of underscores into a single underscore and trims
 *     leading/trailing underscores.
 *   - Truncates to 200 characters while preserving the extension.
 *   - Falls back to `file_<uuid8>` when the input is empty or normalises
 *     to nothing meaningful.
 *
 * @param filename - The original (possibly unsafe) filename.
 * @returns A filesystem-safe, lowercase filename.
 *
 * @example
 * normalizeFilename("reçu purlift 2025.pdf") // "recu_purlift_2025.pdf"
 * normalizeFilename("Côté & Associés.docx")  // "cote_associes.docx"
 */
export function normalizeFilename(filename: string | null | undefined): string {
  if (!filename || typeof filename !== 'string') {
    return `file_${uuidv4().substring(0, 8)}`;
  }

  let normalized = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (normalized.length > 200) {
    const ext = normalized.includes('.')
      ? normalized.substring(normalized.lastIndexOf('.'))
      : '';
    normalized = normalized.substring(0, 200 - ext.length) + ext;
  }

  if (!normalized || normalized === '.' || normalized === '_') {
    normalized = `file_${uuidv4().substring(0, 8)}`;
  }

  return normalized;
}
