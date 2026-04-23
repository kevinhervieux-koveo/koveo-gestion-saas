// Locks the DOCX/XLSX text-extraction path for suggestDocumentTags.

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

type GeminiTextPart = { text: string };
type GeminiInlinePart = { inlineData: { data: string; mimeType: string } };
type GeminiPart = GeminiTextPart | GeminiInlinePart;
type GenerateContentArg = {
  model: string;
  contents: Array<{ role: string; parts: GeminiPart[] }>;
};
type GeminiResponse = {
  candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
};

const generateContentMock =
  jest.fn<(arg: GenerateContentArg) => Promise<GeminiResponse>>();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: generateContentMock },
  })),
}));

type MammothResult = { value: string };
const extractRawTextMock =
  jest.fn<(opts: { buffer: Buffer }) => Promise<MammothResult>>();
jest.mock('mammoth', () => ({
  __esModule: true,
  default: { extractRawText: (opts: { buffer: Buffer }) => extractRawTextMock(opts) },
  extractRawText: (opts: { buffer: Buffer }) => extractRawTextMock(opts),
}));

type XlsxWorkbook = { SheetNames: string[]; Sheets: Record<string, unknown> };
const xlsxReadMock =
  jest.fn<(buf: Buffer, opts: { type: string }) => XlsxWorkbook>();
const sheetToCsvMock = jest.fn<(sheet: unknown) => string>();
jest.mock('xlsx', () => ({
  __esModule: true,
  read: (buf: Buffer, opts: { type: string }) => xlsxReadMock(buf, opts),
  utils: { sheet_to_csv: (s: unknown) => sheetToCsvMock(s) },
  default: {
    read: (buf: Buffer, opts: { type: string }) => xlsxReadMock(buf, opts),
    utils: { sheet_to_csv: (s: unknown) => sheetToCsvMock(s) },
  },
}));

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

import { ConsolidatedAIService } from '../services/consolidated-ai-service';

interface TagSuggestionService {
  suggestDocumentTags(
    fileBuffer: Buffer,
    mimeType: string,
    tags: Array<{ id: string; name: string; description?: string | null }>,
    context?: { category?: string; scope?: 'building' | 'residence' },
    maxSuggestions?: number
  ): Promise<string[]>;
}

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const TAGS = [
  { id: 'tag-budget', name: 'Budget', description: 'Annual budget' },
  { id: 'tag-minutes', name: 'Meeting Minutes', description: 'Board minutes' },
  { id: 'tag-other', name: 'Other', description: null },
];

function makeGeminiResponse(ids: string[]): GeminiResponse {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(ids) }] } }],
  };
}

function getPartsFromCall(call: GenerateContentArg): GeminiPart[] {
  return call.contents[0].parts;
}

function isInlinePart(part: GeminiPart): part is GeminiInlinePart {
  return 'inlineData' in part;
}

function isTextPart(part: GeminiPart): part is GeminiTextPart {
  return 'text' in part && typeof (part as GeminiTextPart).text === 'string';
}

describe('ConsolidatedAIService.suggestDocumentTags - Office text extraction', () => {
  let service: TagSuggestionService;

  beforeEach(() => {
    generateContentMock.mockReset();
    extractRawTextMock.mockReset();
    xlsxReadMock.mockReset();
    sheetToCsvMock.mockReset();
    service = new ConsolidatedAIService() as unknown as TagSuggestionService;
  });

  test('DOCX upload sends extracted text (not inlineData) to Gemini', async () => {
    extractRawTextMock.mockResolvedValue({
      value: 'Annual budget summary for 2026 fiscal year',
    });
    generateContentMock.mockResolvedValue(makeGeminiResponse(['tag-budget']));

    const result = await service.suggestDocumentTags(
      Buffer.from('fake-docx-bytes'),
      DOCX_MIME,
      TAGS
    );

    expect(result).toEqual(['tag-budget']);
    expect(extractRawTextMock).toHaveBeenCalledTimes(1);
    expect(generateContentMock).toHaveBeenCalledTimes(1);

    const parts = getPartsFromCall(generateContentMock.mock.calls[0][0]);
    expect(parts.some(isInlinePart)).toBe(false);
    const textParts = parts.filter(isTextPart);
    expect(textParts.length).toBeGreaterThanOrEqual(2);
    const joined = textParts.map((p) => p.text).join('\n');
    expect(joined).toContain('Annual budget summary for 2026 fiscal year');
    expect(joined).toContain(DOCX_MIME);
  });

  test('XLSX upload sends extracted CSV text (not inlineData) to Gemini', async () => {
    xlsxReadMock.mockReturnValue({
      SheetNames: ['Budget'],
      Sheets: { Budget: { fake: true } },
    });
    sheetToCsvMock.mockReturnValue('Item,Amount\nElevator,1500\nRoof,3200');
    generateContentMock.mockResolvedValue(makeGeminiResponse(['tag-budget']));

    const result = await service.suggestDocumentTags(
      Buffer.from('fake-xlsx-bytes'),
      XLSX_MIME,
      TAGS
    );

    expect(result).toEqual(['tag-budget']);
    expect(xlsxReadMock).toHaveBeenCalledTimes(1);
    expect(sheetToCsvMock).toHaveBeenCalledTimes(1);

    const parts = getPartsFromCall(generateContentMock.mock.calls[0][0]);
    expect(parts.some(isInlinePart)).toBe(false);
    const joined = parts.filter(isTextPart).map((p) => p.text).join('\n');
    expect(joined).toContain('Elevator,1500');
    expect(joined).toContain('# Budget');
  });

  test('Empty DOCX extraction returns [] without calling Gemini', async () => {
    extractRawTextMock.mockResolvedValue({ value: '   ' });

    const result = await service.suggestDocumentTags(
      Buffer.from('empty-docx'),
      DOCX_MIME,
      TAGS
    );

    expect(result).toEqual([]);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  test('Failed DOCX extraction returns [] without calling Gemini', async () => {
    extractRawTextMock.mockRejectedValue(new Error('mammoth boom'));

    const result = await service.suggestDocumentTags(
      Buffer.from('broken-docx'),
      DOCX_MIME,
      TAGS
    );

    expect(result).toEqual([]);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  test('Empty XLSX extraction returns [] without calling Gemini', async () => {
    xlsxReadMock.mockReturnValue({ SheetNames: [], Sheets: {} });

    const result = await service.suggestDocumentTags(
      Buffer.from('empty-xlsx'),
      XLSX_MIME,
      TAGS
    );

    expect(result).toEqual([]);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  test('Failed XLSX extraction returns [] without calling Gemini', async () => {
    xlsxReadMock.mockImplementation(() => {
      throw new Error('xlsx boom');
    });

    const result = await service.suggestDocumentTags(
      Buffer.from('broken-xlsx'),
      XLSX_MIME,
      TAGS
    );

    expect(result).toEqual([]);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  test('Office extractors are invoked with the upload buffer', async () => {
    extractRawTextMock.mockResolvedValue({ value: 'hello world' });
    generateContentMock.mockResolvedValue(makeGeminiResponse([]));
    const docxBuf = Buffer.from('docx-arg-check');
    await service.suggestDocumentTags(docxBuf, DOCX_MIME, TAGS);
    expect(extractRawTextMock).toHaveBeenCalledWith({ buffer: docxBuf });

    xlsxReadMock.mockReturnValue({
      SheetNames: ['S1'],
      Sheets: { S1: {} },
    });
    sheetToCsvMock.mockReturnValue('a,b\n1,2');
    const xlsxBuf = Buffer.from('xlsx-arg-check');
    await service.suggestDocumentTags(xlsxBuf, XLSX_MIME, TAGS);
    expect(xlsxReadMock).toHaveBeenCalledWith(xlsxBuf, { type: 'buffer' });
  });
});
