/**
 * Best-effort plain-text extraction for stored documents.
 *
 * Used when callers need the text content of an existing document — e.g. so
 * the document edit dialog can refine its keyword tag suggestions using the
 * actual file contents instead of just the filename.
 *
 * Supports the same set of "text-extractable" MIME types we already handle
 * elsewhere (consolidated-ai-service, bulk-import-analyzer): plain text,
 * CSV, TSV, .docx, .xlsx and .xlsm. PDFs and images are intentionally
 * skipped — they require OCR / Gemini and don't have a cheap server-side
 * text path. Legacy binary .xls and .ods formats are not supported by the
 * current parser (exceljs) and return an empty string.
 *
 * Returns an empty string when the type is unsupported or extraction
 * fails; callers should treat that as "no text available" and fall back
 * to whatever heuristic they already had.
 */

const MAX_EXTRACTED_TEXT = 20_000;

const PLAIN_TEXT_MIMES = new Set<string>([
  'text/plain',
  'text/csv',
  'text/tab-separated-values',
]);

const DOCX_MIMES = new Set<string>([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * MIME types for Excel-format spreadsheets supported by ExcelJS.
 * Note: legacy binary .xls (application/vnd.ms-excel) and .ods
 * (application/vnd.oasis.opendocument.spreadsheet) are NOT included
 * because ExcelJS does not support those formats.
 */
const XLSX_MIMES = new Set<string>([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
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
      const workbook = new ExcelJS.default.Workbook();
      // @ts-expect-error ExcelJS Buffer type predates the generic Buffer<T> introduced in @types/node >=22; compatible at runtime
      await workbook.xlsx.load(buffer);
      const sheets = workbook.worksheets;
      const perSheetBudget = Math.floor(MAX_EXTRACTED_TEXT / Math.max(1, sheets.length));
      const lines: string[] = [];
      for (const worksheet of sheets) {
        const rows: string[][] = [];
        const colCount = worksheet.columnCount;
        worksheet.eachRow({ includeEmpty: false }, (row) => {
          const cells: string[] = [];
          for (let i = 1; i <= colCount; i++) {
            const v = row.getCell(i).value;
            cells.push(v == null ? '' : String(v));
          }
          rows.push(cells);
        });
        const csvRows = rows
          .filter((row) => row.some((c) => c !== ''))
          .map((row) =>
            row
              .map((cell) => {
                if (
                  cell.includes('"') ||
                  cell.includes(',') ||
                  cell.includes('\n') ||
                  cell.includes('\r')
                ) {
                  return '"' + cell.replace(/"/g, '""') + '"';
                }
                return cell;
              })
              .join(','),
          );
        const csv = csvRows.join('\n');
        if (csv.trim()) {
          lines.push(`# ${worksheet.name}\n${csv.slice(0, perSheetBudget)}`);
        }
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
