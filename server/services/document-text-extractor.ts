/**
 * Best-effort plain-text extraction for stored documents.
 *
 * Used when callers need the text content of an existing document — e.g. so
 * the document edit dialog can refine its keyword tag suggestions using the
 * actual file contents instead of just the filename.
 *
 * Supports the same set of "text-extractable" MIME types we already handle
 * elsewhere (consolidated-ai-service, bulk-import-analyzer): plain text,
 * CSV, .docx and .xlsx. PDFs and images are intentionally skipped — they
 * require OCR / Gemini and don't have a cheap server-side text path.
 *
 * Returns an empty string when the type is unsupported or extraction
 * fails; callers should treat that as "no text available" and fall back
 * to whatever heuristic they already had.
 */

const MAX_EXTRACTED_TEXT = 20_000;

const PLAIN_TEXT_MIMES = new Set<string>([
  'text/plain',
  'text/csv',
]);

const DOCX_MIMES = new Set<string>([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const XLSX_MIMES = new Set<string>([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const TEXT_EXTRACTABLE_MIME_TYPES: ReadonlySet<string> = new Set<string>([
  ...PLAIN_TEXT_MIMES,
  ...DOCX_MIMES,
  ...XLSX_MIMES,
]);

export function isTextExtractableMimeType(
  mimeType: string | null | undefined
): mimeType is string {
  if (!mimeType) return false;
  return TEXT_EXTRACTABLE_MIME_TYPES.has(mimeType);
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  try {
    if (PLAIN_TEXT_MIMES.has(mimeType)) {
      return buffer.toString('utf8').slice(0, MAX_EXTRACTED_TEXT);
    }
    if (DOCX_MIMES.has(mimeType)) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return (result.value || '').slice(0, MAX_EXTRACTED_TEXT);
    }
    if (XLSX_MIMES.has(mimeType)) {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
      const lines: string[] = [];
      for (const worksheet of workbook.worksheets) {
        const rows: string[] = [];
        worksheet.eachRow({ includeEmpty: false }, (row) => {
          const values = (row.values as (string | number | boolean | null | undefined)[]).slice(1);
          rows.push(values.map((v) => (v == null ? '' : String(v))).join(','));
        });
        const csv = rows.join('\n');
        if (csv.trim()) {
          lines.push(`# ${worksheet.name}\n${csv}`);
        }
        if (lines.join('\n').length > MAX_EXTRACTED_TEXT) break;
      }
      return lines.join('\n').slice(0, MAX_EXTRACTED_TEXT);
    }
  } catch (err) {
    console.warn(
      '[documentTextExtractor] Extraction failed for',
      mimeType,
      err instanceof Error ? err.message : err
    );
  }
  return '';
}
