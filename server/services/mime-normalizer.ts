/**
 * Extension-aware MIME normalisation for spreadsheet (and other tabular)
 * uploads.
 *
 * Browsers frequently send `application/octet-stream` for `.xls`, `.xlsm`,
 * `.ods`, `.csv` and even `.tsv` files, causing the bulk-import analyzer to
 * mark them `unsupported_mime` before Claude ever sees their contents.
 *
 * This helper accepts the browser-reported MIME together with the file's
 * original name and returns the canonical MIME that the rest of the pipeline
 * should treat the file as. When the browser MIME is anything other than
 * `application/octet-stream` it is returned unchanged, so the normaliser is
 * a pure pass-through for well-behaved browsers.
 *
 * Covered extensions: .xlsx .xls .xlsm .ods .csv .tsv .txt
 */

const OCTET_STREAM = 'application/octet-stream';

const EXT_TO_MIME: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  txt: 'text/plain',
};

/**
 * Return the canonical MIME type for a file.
 *
 * - If `browserMime` is not `application/octet-stream` it is returned as-is.
 * - Otherwise the extension from `originalName` is used to look up the
 *   canonical MIME. Unknown extensions fall back to `application/octet-stream`.
 */
export function normalizeMimeType(
  originalName: string,
  browserMime: string,
): string {
  const mime = browserMime.toLowerCase().trim();
  if (mime !== OCTET_STREAM) return mime;

  const ext = originalName.toLowerCase().split('.').pop() ?? '';
  return EXT_TO_MIME[ext] ?? OCTET_STREAM;
}
