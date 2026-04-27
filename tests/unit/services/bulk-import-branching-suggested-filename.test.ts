/**
 * Unit tests for Task #1401 — AI-suggested filenames in the Branching
 * (a.k.a. Sorting) step of the Bulk Document Import wizard.
 *
 * Coverage:
 *   - `suggestBranch` parses `suggestedFilename` from a well-formed
 *     Anthropic response and surfaces it as `suggestedFinalFileName`.
 *   - `suggestedSplitFilenames` is parsed into `suggestedSplitFinalNames`
 *     when the AI returns a clean two-element array.
 *   - The sanitiser drops file extensions, path separators, control /
 *     NTFS-reserved characters, leading dots, and caps long values at
 *     210 chars.
 *   - Empty / missing / non-string suggestions become `null` so the UI
 *     falls back to the original-stem placeholder.
 *   - A half-valid split pair (only one part sanitises cleanly) is
 *     dropped entirely so the "matches verbatim" hint can't be confused
 *     by a half-AI / half-original combination.
 *   - The fallback path (no API key) returns BOTH suggestion fields as
 *     `null` so fallback / api_error rows never default to an AI value.
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
  setCachedSuggestion: (key: string, value: unknown, _ttl: number) =>
    setCachedMock(key, value, _ttl),
  clearAiSuggestionCache: jest.fn(),
}));

jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockRejectedValue(new Error('forced mammoth failure')),
}));

import {
  bulkImportAnalyzer,
  sanitizeAiSuggestedFileName,
} from '../../../server/services/bulk-import-analyzer';

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

beforeEach(() => {
  cacheMockStore.clear();
  getCachedMock.mockClear();
  setCachedMock.mockClear();
});
afterAll(() => {
  bulkImportAnalyzer.__setClientForTests(null);
  delete process.env.ANTHROPIC_API_KEY;
});

describe('sanitizeAiSuggestedFileName (Task #1401)', () => {
  it('returns null for non-string input', () => {
    expect(sanitizeAiSuggestedFileName(null)).toBeNull();
    expect(sanitizeAiSuggestedFileName(undefined)).toBeNull();
    expect(sanitizeAiSuggestedFileName(42)).toBeNull();
    expect(sanitizeAiSuggestedFileName(['x'])).toBeNull();
  });

  it('returns null for empty / whitespace-only strings', () => {
    expect(sanitizeAiSuggestedFileName('')).toBeNull();
    expect(sanitizeAiSuggestedFileName('   ')).toBeNull();
    expect(sanitizeAiSuggestedFileName('\n\t')).toBeNull();
  });

  it('strips a trailing extension if the AI included one', () => {
    expect(sanitizeAiSuggestedFileName('Procès-verbal AGA.pdf')).toBe('Procès-verbal AGA');
    expect(sanitizeAiSuggestedFileName('Insurance 2024.PDF')).toBe('Insurance 2024');
    expect(sanitizeAiSuggestedFileName('contract.docx')).toBe('contract');
  });

  it('keeps dot-separated text that is not an extension', () => {
    // Periods inside the stem (e.g. version numbers) survive.
    expect(sanitizeAiSuggestedFileName('Bylaws v1.2.3 — 2024')).toBe('Bylaws v1.2.3 — 2024');
  });

  it('strips path separators', () => {
    expect(sanitizeAiSuggestedFileName('foo/bar')).toBe('foobar');
    expect(sanitizeAiSuggestedFileName('foo\\bar')).toBe('foobar');
    expect(sanitizeAiSuggestedFileName('../etc/passwd')).toBeNull();
  });

  it('strips NTFS-reserved and control characters', () => {
    expect(sanitizeAiSuggestedFileName('foo<bar>baz')).toBe('foobarbaz');
    expect(sanitizeAiSuggestedFileName('foo|bar?baz*')).toBe('foobarbaz');
    expect(sanitizeAiSuggestedFileName('foo\x00bar\x1fbaz')).toBe('foobarbaz');
  });

  it('collapses runs of whitespace to a single space', () => {
    expect(sanitizeAiSuggestedFileName('foo    bar\t\tbaz')).toBe('foo bar baz');
  });

  it('forbids leading dots', () => {
    expect(sanitizeAiSuggestedFileName('.hidden')).toBeNull();
    expect(sanitizeAiSuggestedFileName('  .secret')).toBeNull();
  });

  it('caps long stems at 210 characters', () => {
    const long = 'a'.repeat(300);
    const out = sanitizeAiSuggestedFileName(long);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(210);
  });

  it('returns null when nothing meaningful survives sanitisation', () => {
    expect(sanitizeAiSuggestedFileName('|*?<>')).toBeNull();
    expect(sanitizeAiSuggestedFileName('///')).toBeNull();
  });
});

describe('suggestBranch — suggestedFinalFileName parsing (Task #1401)', () => {
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key-task1401';
  });

  it('returns the sanitised suggestion alongside branch / subCategory', async () => {
    makeFakeClient({
      branch: 'building_documents',
      subCategory: 'minutes',
      reason: 'AGM minutes',
      confidence: 0.9,
      suggestedFilename: 'Procès-verbal AGA 2024-09-12.pdf',
    });

    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'IMG_20240912_184231.pdf' });

    expect(r.branch).toBe('building_documents');
    expect(r.suggestedFinalFileName).toBe('Procès-verbal AGA 2024-09-12');
    expect(r.suggestedSplitFinalNames).toBeNull();
  });

  it('returns null suggestedFinalFileName when the AI omits the field', async () => {
    makeFakeClient({
      branch: 'bill',
      subCategory: 'utility',
      reason: 'electricity',
      confidence: 0.8,
    });

    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'electricity.pdf' });

    expect(r.suggestedFinalFileName).toBeNull();
    expect(r.suggestedSplitFinalNames).toBeNull();
  });

  it('returns null when the AI returns an empty / whitespace suggestion', async () => {
    makeFakeClient({
      branch: 'other',
      subCategory: 'other',
      reason: 'unclear',
      confidence: 0.4,
      suggestedFilename: '   ',
    });

    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'mystery.pdf' });

    expect(r.suggestedFinalFileName).toBeNull();
  });

  it('returns null when the suggestion sanitises to an empty stem', async () => {
    makeFakeClient({
      branch: 'other',
      subCategory: 'other',
      reason: 'garbage',
      confidence: 0.3,
      suggestedFilename: '|*?<>',
    });

    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'mystery.pdf' });

    expect(r.suggestedFinalFileName).toBeNull();
  });

  it('parses a clean split-filename pair into suggestedSplitFinalNames', async () => {
    makeFakeClient({
      branch: 'building_documents',
      subCategory: 'minutes',
      reason: 'two stitched documents',
      confidence: 0.85,
      suggestedFilename: 'Combined doc',
      suggestedSplitFilenames: ['AGA minutes 2024-09-12', 'Insurance policy 2024.pdf'],
    });

    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'scan001.pdf' });

    expect(r.suggestedSplitFinalNames).toEqual([
      'AGA minutes 2024-09-12',
      'Insurance policy 2024',
    ]);
  });

  it('drops the entire split pair when one half cannot be sanitised', async () => {
    makeFakeClient({
      branch: 'building_documents',
      subCategory: 'minutes',
      reason: 'two stitched documents',
      confidence: 0.85,
      suggestedFilename: 'Combined doc',
      suggestedSplitFilenames: ['AGA minutes 2024-09-12', '   '],
    });

    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'scan001.pdf' });

    expect(r.suggestedSplitFinalNames).toBeNull();
    // The single suggestion is still kept.
    expect(r.suggestedFinalFileName).toBe('Combined doc');
  });

  it('drops a split pair that is not exactly two elements', async () => {
    makeFakeClient({
      branch: 'building_documents',
      subCategory: 'minutes',
      reason: 'wrong shape',
      confidence: 0.5,
      suggestedFilename: 'Combined',
      suggestedSplitFilenames: ['only one'],
    });

    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'scan001.pdf' });

    expect(r.suggestedSplitFinalNames).toBeNull();
  });
});

describe('suggestBranch — fallback path drops AI suggestions (Task #1401)', () => {
  beforeAll(() => {
    delete process.env.ANTHROPIC_API_KEY;
    bulkImportAnalyzer.__setClientForTests(null);
  });

  it('returns null suggestedFinalFileName / suggestedSplitFinalNames when the client is missing', async () => {
    const r = await bulkImportAnalyzer.suggestBranch({ originalName: 'fallback.pdf' });

    expect(r.fallbackReason).toBe('no_api_key');
    expect(r.suggestedFinalFileName).toBeNull();
    expect(r.suggestedSplitFinalNames).toBeNull();
  });
});
