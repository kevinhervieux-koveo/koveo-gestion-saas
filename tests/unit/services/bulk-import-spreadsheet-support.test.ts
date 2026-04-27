/**
 * Unit tests for Task #1536 — Reliable spreadsheet support in bulk import.
 *
 * Covers:
 *   1. Multi-sheet .xlsx with cells containing commas/newlines surfaces a
 *      `Spreadsheet contents:` block in the Claude prompt for screening,
 *      branching and identification with RFC 4180 quoting.
 *   2. A .csv with browser-reported `application/octet-stream` MIME is
 *      normalised to `text/csv` and not marked `unsupported_mime`.
 *   3. An .ods upload is extracted via the xlsx library.
 *   4. Unit-level CSV serializer: a cell containing `","\n` round-trips
 *      correctly through the RFC 4180 quoting layer.
 */

const cacheMockStore = new Map<string, unknown>();
const getCachedMock = jest.fn(async (key: string) => {
  return cacheMockStore.has(key) ? cacheMockStore.get(key) : null;
});
const setCachedMock = jest.fn(async (key: string, value: unknown) => {
  cacheMockStore.set(key, value);
});
jest.mock('../../../server/services/ai-suggestion-cache', () => ({
  getCachedSuggestion: (key: string) => getCachedMock(key),
  setCachedSuggestion: (key: string, value: unknown, ttl: number) =>
    setCachedMock(key, value, ttl),
  clearAiSuggestionCache: jest.fn(),
}));

jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockRejectedValue(new Error('forced mammoth failure')),
}));

jest.mock('pdf-parse', () => {
  const fn = jest.fn().mockResolvedValue({ text: 'Extracted PDF text' });
  (fn as unknown as Record<string, unknown>).default = fn;
  return fn;
});

jest.mock('pdf-lib', () => ({
  PDFDocument: {
    load: jest.fn().mockResolvedValue({ getPageCount: jest.fn().mockReturnValue(10) }),
  },
}));

import { bulkImportAnalyzer } from '../../../server/services/bulk-import-analyzer';
import { normalizeMimeType } from '../../../server/services/mime-normalizer';

describe('Task #1536 — mime normalizer', () => {
  it('returns the browser MIME when it is not application/octet-stream', () => {
    expect(normalizeMimeType('file.pdf', 'application/pdf')).toBe('application/pdf');
    expect(normalizeMimeType('file.csv', 'text/csv')).toBe('text/csv');
  });

  it('maps .csv with application/octet-stream to text/csv', () => {
    expect(normalizeMimeType('report.csv', 'application/octet-stream')).toBe('text/csv');
  });

  it('maps .xlsx with application/octet-stream to the xlsx MIME', () => {
    expect(normalizeMimeType('data.xlsx', 'application/octet-stream')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('maps .xls with application/octet-stream to the xls MIME', () => {
    expect(normalizeMimeType('ledger.xls', 'application/octet-stream')).toBe(
      'application/vnd.ms-excel',
    );
  });

  it('maps .xlsm with application/octet-stream to the xlsm MIME', () => {
    expect(normalizeMimeType('macro.xlsm', 'application/octet-stream')).toBe(
      'application/vnd.ms-excel.sheet.macroEnabled.12',
    );
  });

  it('maps .ods with application/octet-stream to the ODS MIME', () => {
    expect(normalizeMimeType('budget.ods', 'application/octet-stream')).toBe(
      'application/vnd.oasis.opendocument.spreadsheet',
    );
  });

  it('maps .tsv with application/octet-stream to text/tab-separated-values', () => {
    expect(normalizeMimeType('data.tsv', 'application/octet-stream')).toBe(
      'text/tab-separated-values',
    );
  });

  it('leaves application/octet-stream unchanged for unknown extensions', () => {
    expect(normalizeMimeType('archive.zip2', 'application/octet-stream')).toBe(
      'application/octet-stream',
    );
  });
});

describe('Task #1536 — analyzer spreadsheet extraction', () => {
  afterAll(() => {
    bulkImportAnalyzer.__setClientForTests(null);
    cacheMockStore.clear();
  });

  beforeEach(() => {
    cacheMockStore.clear();
    getCachedMock.mockClear();
    setCachedMock.mockClear();
  });

  function makeFakeClient(jsonPayload: object) {
    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(jsonPayload) }],
    });
    const fakeClient = {
      messages: { create },
    } as unknown as Parameters<typeof bulkImportAnalyzer.__setClientForTests>[0];
    bulkImportAnalyzer.__setClientForTests(fakeClient);
    return create;
  }

  it('screening prompt contains Spreadsheet contents: block with RFC 4180 quoted cells from multi-sheet xlsx', async () => {
    const XLSX = await import('xlsx');

    const ws1 = XLSX.utils.aoa_to_sheet([
      ['Vendor', 'Amount', 'Note'],
      ['Acme Co.', '1,200.00', 'Payment for "repairs"'],
      ['BuilderX', '450', 'Cost\nwith newline'],
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Month', 'Total'],
      ['January', '1650'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Invoices');
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const create = makeFakeClient({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'invoices.xlsx',
      description: 'Invoice spreadsheet',
      confidence: 0.85,
      quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'bill', reason: 'spreadsheet', confidence: 0.85 },
    });

    const r = await bulkImportAnalyzer.screen({
      originalName: 'invoices.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });

    expect(r.fallbackReason).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);

    const sentPrompt: string = create.mock.calls[0][0].messages[0].content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n');

    expect(sentPrompt).toContain('Spreadsheet contents:');
    expect(sentPrompt).toContain('# Invoices');
    expect(sentPrompt).toContain('# Summary');
    expect(sentPrompt).toContain('Acme Co.');
    expect(sentPrompt).toContain('January');

    expect(sentPrompt).toContain('"1,200.00"');
    expect(sentPrompt).toContain('"Payment for ""repairs"""');
    expect(sentPrompt).toContain('"Cost\nwith newline"');
  });

  it('screening and branching both surface Spreadsheet contents: block for same xlsx', async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['Date', 'Amount'],
      ['2024-01', '500'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const screenCreate = makeFakeClient({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'data.xlsx',
      description: 'Data sheet',
      confidence: 0.8,
      quickAnalysis: { typeGuess: 'unknown', bucketGuess: 'unknown', reason: 'ok', confidence: 0.8 },
    });

    await bulkImportAnalyzer.screen({
      originalName: 'data.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });
    cacheMockStore.clear();

    const branchCreate = makeFakeClient({
      branch: 'building_documents',
      subCategory: 'other',
      reason: 'spreadsheet',
      confidence: 0.7,
      suggestedFilename: 'data.xlsx',
    });

    await bulkImportAnalyzer.suggestBranch({
      originalName: 'data.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });

    for (const create of [screenCreate, branchCreate]) {
      const sent: string = create.mock.calls[0][0].messages[0].content
        .filter((b: { type: string }) => b.type === 'text')
        .map((b: { text: string }) => b.text)
        .join('\n');
      expect(sent).toContain('Spreadsheet contents:');
      expect(sent).toContain('# Data');
    }
  });

  it('treats application/octet-stream + .csv extension as text/csv, not unsupported_mime', async () => {
    const csvContent = 'Name,Amount\nAlice,100\nBob,200';
    const buffer = Buffer.from(csvContent, 'utf8');

    const create = makeFakeClient({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'export.csv',
      description: 'CSV export',
      confidence: 0.75,
      quickAnalysis: { typeGuess: 'unknown', bucketGuess: 'unknown', reason: 'ok', confidence: 0.75 },
    });

    const r = await bulkImportAnalyzer.screen({
      originalName: 'export.csv',
      mimeType: 'application/octet-stream',
      buffer,
    });

    expect(r.fallbackReason).not.toBe('unsupported_mime');
    expect(r.fallbackReason).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);

    const sentPrompt: string = create.mock.calls[0][0].messages[0].content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n');

    expect(sentPrompt).toContain('Alice');
    expect(sentPrompt).toContain('Bob');
  });

  it('treats application/octet-stream + .xlsx extension as xlsx, not unsupported_mime', async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['Col'], ['Val']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    makeFakeClient({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'report.xlsx',
      description: 'Spreadsheet',
      confidence: 0.7,
      quickAnalysis: { typeGuess: 'unknown', bucketGuess: 'unknown', reason: 'ok', confidence: 0.7 },
    });

    const r = await bulkImportAnalyzer.screen({
      originalName: 'report.xlsx',
      mimeType: 'application/octet-stream',
      buffer,
    });

    expect(r.fallbackReason).toBeNull();
    expect(r.fallbackReason).not.toBe('unsupported_mime');
  });

  it('extracts .ods file via the xlsx library (not unsupported_mime)', async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['Poste', 'Montant'],
      ['Loyer', '1200'],
      ['Charges', '300'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Budget');

    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'ods' }));

    const create = makeFakeClient({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'budget.ods',
      description: 'Budget ODS',
      confidence: 0.78,
      quickAnalysis: { typeGuess: 'invoice', bucketGuess: 'bill', reason: 'ods', confidence: 0.78 },
    });

    const r = await bulkImportAnalyzer.screen({
      originalName: 'budget.ods',
      mimeType: 'application/vnd.oasis.opendocument.spreadsheet',
      buffer,
    });

    expect(r.fallbackReason).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);

    const sentPrompt: string = create.mock.calls[0][0].messages[0].content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n');

    expect(sentPrompt).toContain('Spreadsheet contents:');
    expect(sentPrompt).toContain('Budget');
  });

  it('per-sheet truncation: a large first sheet does not starve the second sheet', async () => {
    const XLSX = await import('xlsx');

    const bigRows: string[][] = [['Col1', 'Col2']];
    for (let i = 0; i < 1000; i++) {
      bigRows.push([`Row${i}`, 'A'.repeat(20)]);
    }
    const ws1 = XLSX.utils.aoa_to_sheet(bigRows);
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['SmallSheet', 'Value'],
      ['KeyRow', 'UniqueValue'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'BigSheet');
    XLSX.utils.book_append_sheet(wb, ws2, 'SmallSheet');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const create = makeFakeClient({
      isComplete: true,
      isMultiDocument: false,
      pageOrderHint: null,
      rotationDegrees: 0,
      suggestedFilename: 'multi.xlsx',
      description: 'Multi-sheet',
      confidence: 0.7,
      quickAnalysis: { typeGuess: 'unknown', bucketGuess: 'unknown', reason: 'ok', confidence: 0.7 },
    });

    await bulkImportAnalyzer.screen({
      originalName: 'multi.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });

    const sentPrompt: string = create.mock.calls[0][0].messages[0].content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n');

    expect(sentPrompt).toContain('# BigSheet');
    expect(sentPrompt).toContain('# SmallSheet');
    expect(sentPrompt).toContain('UniqueValue');
  });
});

describe('Task #1536 — RFC 4180 CSV serializer round-trip', () => {
  it('quotes cells containing commas', async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['a,b', 'c']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'S');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        isComplete: true, isMultiDocument: false, pageOrderHint: null,
        rotationDegrees: 0, suggestedFilename: 'f.xlsx', description: '',
        confidence: 0.5, quickAnalysis: { typeGuess: 'unknown', bucketGuess: 'unknown', reason: '', confidence: 0.5 },
      }) }],
    });
    bulkImportAnalyzer.__setClientForTests({ messages: { create } } as any);

    await bulkImportAnalyzer.screen({
      originalName: 'f.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });

    const sentPrompt: string = create.mock.calls[0][0].messages[0].content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n');

    expect(sentPrompt).toContain('"a,b"');
  });

  it('doubles internal quotes in quoted cells', async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['say "hello"']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'S');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        isComplete: true, isMultiDocument: false, pageOrderHint: null,
        rotationDegrees: 0, suggestedFilename: 'f.xlsx', description: '',
        confidence: 0.5, quickAnalysis: { typeGuess: 'unknown', bucketGuess: 'unknown', reason: '', confidence: 0.5 },
      }) }],
    });
    bulkImportAnalyzer.__setClientForTests({ messages: { create } } as any);

    await bulkImportAnalyzer.screen({
      originalName: 'f.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });

    const sentPrompt: string = create.mock.calls[0][0].messages[0].content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n');

    expect(sentPrompt).toContain('"say ""hello"""');
  });

  it('quotes cells containing commas and newlines (",\\n) and round-trips RFC 4180', async () => {
    const XLSX = await import('xlsx');
    const cell = '","\n';
    const ws = XLSX.utils.aoa_to_sheet([[cell]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Test');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        isComplete: true, isMultiDocument: false, pageOrderHint: null,
        rotationDegrees: 0, suggestedFilename: 'f.xlsx', description: '',
        confidence: 0.5, quickAnalysis: { typeGuess: 'unknown', bucketGuess: 'unknown', reason: '', confidence: 0.5 },
      }) }],
    });
    bulkImportAnalyzer.__setClientForTests({ messages: { create } } as any);

    await bulkImportAnalyzer.screen({
      originalName: 'f.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });

    const sentPrompt: string = create.mock.calls[0][0].messages[0].content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n');

    // Cell value `","\n` (4 chars: quote, comma, quote, newline).
    // RFC 4180: internal quotes doubled → `"",""\n`, then wrapped → `""",""\n"`.
    expect(sentPrompt).toContain('""",""\n"');
  });

  it('does not quote plain cells without special characters', async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['hello', 'world']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'S');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const create = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        isComplete: true, isMultiDocument: false, pageOrderHint: null,
        rotationDegrees: 0, suggestedFilename: 'f.xlsx', description: '',
        confidence: 0.5, quickAnalysis: { typeGuess: 'unknown', bucketGuess: 'unknown', reason: '', confidence: 0.5 },
      }) }],
    });
    bulkImportAnalyzer.__setClientForTests({ messages: { create } } as any);

    await bulkImportAnalyzer.screen({
      originalName: 'f.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });

    const sentPrompt: string = create.mock.calls[0][0].messages[0].content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n');

    expect(sentPrompt).toContain('hello,world');
    expect(sentPrompt).not.toContain('"hello"');
  });
});
